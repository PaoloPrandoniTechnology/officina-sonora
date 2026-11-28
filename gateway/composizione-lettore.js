// Timeline di riproduzione della Composizione: mostra esattamente ciò che si sta sentendo, anche a chi non legge
// la musica. In grande l'accordo e la nota del momento, i quattro battiti, quattro battute alla volta con la riga
// che avanza, e sotto la mappa dell'intero ascolto (si preme per saltare). Suono: un sintetizzatore semplice.
(function (radice) {
  'use strict';
  const A = radice ? radice.ScoreAbc : require('../src/compositore/abc.js');
  const NOTE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  const LETTERE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SEZIONI = { intro: 'Apertura', verse: 'Strofa', 'pre-chorus': 'Pre-ritornello', chorus: 'Ritornello', bridge: 'Ponte', interlude: 'Assolo', outro: 'Finale', instrumental: 'Strumentale' };
  const nomeNota = (midi) => NOTE[midi % 12];
  // "Bbm7/D" -> "Sib m7 / Re"
  function nomeAccordo(sigla) {
    const nota = (l, a) => NOTE[(LETTERE[l] + (a === '#' ? 1 : a === 'b' ? 11 : 0)) % 12];
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sigla);
    if (!m) return sigla;
    const tipo = m[3] === 'm' ? 'min' : m[3] === 'm7b5' ? 'm7♭5' : m[3];
    return nota(m[1], m[2]) + (tipo ? ' ' + tipo : '') + (m[4] ? ' / ' + nota(m[4], m[5]) : '');
  }

  // Lo score in tempi: note (le legate si fondono), accordi, battute e sezioni, in secondi
  function eventi(score) {
    const unita = 60 / score.bpm / 8;
    const note = [], accordi = [], battute = [], sezioni = [];
    let t = 0, legata = null;
    score.sezioni.forEach((s) => {
      const lunghezza = A.unita(s.metro || score.metro);
      sezioni.push({ nome: SEZIONI[s.nome] || s.nome, da: battute.length, quante: s.battute.length });
      s.battute.forEach((b) => {
        const n = battute.length;
        battute.push({ t, durata: lunghezza * unita, battiti: Math.max(1, Math.round(lunghezza / 8)), sezione: sezioni.length - 1 });
        let pos = 0;
        for (const e of b.ins || []) {
          if (e.midi === null) legata = null;
          else {
            if (legata && legata.midi === e.midi) legata.durata += e.durata * unita;
            else note.push((legata = { midi: e.midi, t: t + pos * unita, durata: e.durata * unita, battuta: n }));
            if (!e.lega) legata = null;
          }
          pos += e.durata;
        }
        (b.accordi || []).forEach((a, i) => {
          const fine = i + 1 < b.accordi.length ? b.accordi[i + 1].pos : lunghezza;
          const c = A.noteAccordo(a.sigla);
          accordi.push({ sigla: a.sigla, nome: nomeAccordo(a.sigla), note: c.note, basso: c.basso, t: t + a.pos * unita, durata: (fine - a.pos) * unita, battuta: n });
        });
        t += lunghezza * unita;
      });
    });
    return { note, accordi, battute, sezioni, totale: t };
  }
  // dove si trova l'ascolto al secondo t
  function posizione(ev, t) {
    let n = ev.battute.findIndex((b) => t < b.t + b.durata);
    if (n < 0) n = ev.battute.length - 1;
    const b = ev.battute[n];
    const quota = Math.max(0, Math.min(0.9999, (t - b.t) / b.durata));
    const dentro = (x) => t >= x.t - 1e-6 && t < x.t + x.durata - 1e-6;
    return { battuta: n, quota, battito: Math.floor(quota * b.battiti), nota: ev.note.findIndex(dentro), accordo: ev.accordi.findIndex(dentro) };
  }

  if (typeof module !== 'undefined') module.exports = { eventi, posizione, nomeAccordo };
  if (!radice) return;

  function voce(ctx) {
    return (midi, da, durata, forma, volume) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), a = da + durata;
      o.type = forma; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      g.gain.setValueAtTime(0, da);
      g.gain.linearRampToValueAtTime(volume, da + 0.015);
      g.gain.setValueAtTime(volume * 0.8, Math.max(da + 0.016, a - 0.05));
      g.gain.linearRampToValueAtTime(0, a);
      o.connect(g).connect(ctx.destination); o.start(da); o.stop(a + 0.02);
    };
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const orologio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const PAGINA = 4; // battute in vista

  // apre il lettore in "box" e parte. giro = battute della voce (0 = nessuna ripetizione da contare)
  function apri(box, score, { giro = 0, spiega = '', suPosizione = () => {}, suFine = () => {} } = {}) {
    const ev = eventi(score);
    const altezze = ev.note.map((n) => n.midi);
    const min = Math.min(...altezze, 60) - 1, max = Math.max(...altezze, 72) + 1;
    const piuSezioni = ev.sezioni.length > 1;
    box.innerHTML = `<div class="lt" role="group" aria-label="Riproduzione">
      <div class="lt-ora">
        <div><small>Accordo</small><strong data-l="accordo">—</strong></div>
        <div><small>Nota</small><strong data-l="nota">—</strong></div>
        <div class="lt-dove"><small data-l="dove"></small><div class="lt-battiti" data-l="battiti" aria-hidden="true"></div></div>
      </div>
      <div class="lt-vista" data-l="vista"></div>
      <div class="lt-mappa" data-l="mappa">${ev.battute.map((b, i) => `<button type="button" data-salta="${i}" class="s${b.sezione % 2}" style="flex:${b.durata} 1 0" title="Vai alla battuta ${i + 1}${piuSezioni ? ' · ' + esc(ev.sezioni[b.sezione].nome) : ''}" aria-label="Vai alla battuta ${i + 1}"></button>`).join('')}<i data-l="avanti"></i></div>
      <div class="lt-tasti"><button type="button" class="btn small" data-l="pausa">❚❚ Pausa</button><button type="button" class="btn small ghost" data-salta="0">↺ Dall’inizio</button><button type="button" class="btn small ghost" data-l="ferma">■ Ferma</button><span data-l="tempo"></span></div>
      <p class="lt-legenda">In alto gli <b>accordi</b>, sotto le <b>note</b>: più in alto sta il rettangolo, più la nota è acuta; più è largo, più dura. La riga verticale è il punto che stai sentendo. Premi la barra in basso per saltare. ${esc(spiega)}</p></div>`;
    const el = (n) => box.querySelector(`[data-l="${n}"]`);
    let ctx = null, inizio = 0, quadro = 0, pagina = -1, ultimo = '', finito = false;

    function disegnaPagina(p) {
      pagina = p;
      const prima = p * PAGINA;
      const barre = Array.from({ length: PAGINA }, (_, i) => ev.battute[prima + i]);
      // larghezza di ogni colonna uguale: le battute hanno tutte la stessa durata, salvo cambi di metro
      el('vista').innerHTML = barre.map((b, i) => {
        if (!b) return '<div class="lt-battuta vuota"></div>';
        const n = prima + i;
        const in100 = (t) => ((t - b.t) / b.durata) * 100;
        // una nota legata che arriva dalla battuta prima si vede anche qui
        const dentro = (x) => x.t < b.t + b.durata - 1e-6 && x.t + x.durata > b.t + 1e-6;
        const blocco = (x, k, classe, testo, stile) => { const da = Math.max(0, in100(x.t)), a = Math.min(100, in100(x.t + x.durata)); return `<div class="${classe}" data-${classe === 'lt-nota' ? 'n' : 'a'}="${k}" style="left:${da}%;width:${a - da}%;${stile}" title="${esc(testo)}"><span>${esc(testo)}</span></div>`; };
        const accordi = ev.accordi.map((a, k) => (dentro(a) ? blocco(a, k, 'lt-accordo', a.nome, '') : '')).join('');
        const note = ev.note.map((x, k) => (dentro(x) ? blocco(x, k, 'lt-nota', nomeNota(x.midi), `bottom:${((x.midi - min) / (max - min)) * 100}%`) : '')).join('');
        const battiti = Array.from({ length: b.battiti }, (_, q) => `<em style="left:${(q / b.battiti) * 100}%">${q + 1}</em>`).join('');
        return `<div class="lt-battuta" data-b="${n}"><header><b>Battuta ${n + 1}</b>${piuSezioni && (ev.sezioni[b.sezione].da === n || i === 0) ? `<span>${esc(ev.sezioni[b.sezione].nome)}</span>` : ''}</header>
          <div class="lt-accordi">${accordi}</div><div class="lt-note">${note || '<p>solo accordi</p>'}</div><div class="lt-righello">${battiti}</div><i class="lt-testa" hidden></i></div>`;
      }).join('');
    }

    function mostra(t) {
      const p = posizione(ev, t);
      if (Math.floor(p.battuta / PAGINA) !== pagina) disegnaPagina(Math.floor(p.battuta / PAGINA));
      const vista = el('vista');
      vista.querySelectorAll('.lt-battuta[data-b]').forEach((b) => {
        const n = Number(b.dataset.b), ora = n === p.battuta;
        b.classList.toggle('ora', ora);
        b.classList.toggle('passata', n < p.battuta);
        const testa = b.querySelector('.lt-testa');
        testa.hidden = !ora;
        if (ora) testa.style.left = p.quota * 100 + '%';
      });
      vista.querySelectorAll('[data-n]').forEach((x) => x.classList.toggle('ora', Number(x.dataset.n) === p.nota));
      vista.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('ora', Number(x.dataset.a) === p.accordo));
      el('avanti').style.left = Math.min(100, (t / ev.totale) * 100) + '%';
      el('tempo').textContent = `${orologio(Math.max(0, t))} di ${orologio(ev.totale)}`;
      suPosizione(p);
      // il testo cambia solo quando cambia qualcosa
      const chiave = `${p.battuta}.${p.battito}.${p.nota}.${p.accordo}`;
      if (chiave === ultimo) return;
      ultimo = chiave;
      const b = ev.battute[p.battuta];
      el('accordo').textContent = p.accordo < 0 ? '—' : ev.accordi[p.accordo].nome;
      el('nota').textContent = p.nota < 0 ? 'pausa' : nomeNota(ev.note[p.nota].midi);
      const ripetizioni = giro ? Math.ceil(ev.battute.length / giro) : 1;
      el('dove').textContent = [`Battuta ${p.battuta + 1} di ${ev.battute.length}`, `battito ${p.battito + 1} di ${b.battiti}`, ripetizioni > 1 ? `giro ${Math.floor(p.battuta / giro) + 1} di ${ripetizioni}` : '', piuSezioni ? ev.sezioni[b.sezione].nome : ''].filter(Boolean).join(' · ');
      el('battiti').innerHTML = Array.from({ length: b.battiti }, (_, q) => `<span class="${q === p.battito ? 'ora' : ''}">${q + 1}</span>`).join('');
    }

    // il suono parte dal secondo richiesto
    function suonaDa(da) {
      ctx?.close();
      ctx = new AudioContext();
      const nota = voce(ctx);
      inizio = ctx.currentTime + 0.12 - da;
      const metti = (x, midi, forma, volume) => { const a = x.t + x.durata; if (a > da + 0.02) { const t = Math.max(x.t, da); nota(midi, inizio + t, a - t, forma, volume); } };
      for (const a of ev.accordi) { metti(a, 36 + a.basso, 'triangle', 0.11); for (const n of a.note) metti(a, 48 + n, 'sine', 0.05); }
      for (const x of ev.note) metti(x, x.midi, 'triangle', 0.22);
      finito = false;
      el('pausa').textContent = '❚❚ Pausa';
      cancelAnimationFrame(quadro);
      segui();
    }
    // la riga segue l'orologio audio (e il ritardo delle casse), non un timer a parte
    const adesso = () => ctx.currentTime - inizio - (ctx.outputLatency || 0);
    function segui() {
      if (!ctx || finito) return;
      const t = adesso();
      if (t >= ev.totale) { finito = true; mostra(ev.totale - 0.001); el('pausa').textContent = '▶ Riascolta'; suFine(); return; }
      mostra(Math.max(0, t));
      quadro = requestAnimationFrame(segui);
    }
    function ferma() {
      cancelAnimationFrame(quadro);
      ctx?.close();
      ctx = null;
      box.innerHTML = '';
      box.onclick = null;
    }
    box.onclick = (e) => {
      const salta = e.target.closest('[data-salta]');
      if (salta) return suonaDa(ev.battute[Number(salta.dataset.salta)].t);
      if (e.target.closest('[data-l="ferma"]')) { ferma(); return suFine(true); }
      if (!e.target.closest('[data-l="pausa"]') || !ctx) return;
      if (finito) return suonaDa(0);
      const inPausa = ctx.state === 'suspended';
      (inPausa ? ctx.resume() : ctx.suspend());
      el('pausa').textContent = inPausa ? '❚❚ Pausa' : '▶ Riprendi';
    };
    suonaDa(0);
    return { ferma, eventi: ev };
  }

  radice.LettoreComposizione = { eventi, posizione, nomeAccordo, apri, voce };
})(typeof window !== 'undefined' ? window : null);
