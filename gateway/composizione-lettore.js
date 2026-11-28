// Riproduzione della Composizione, pensata per chi non legge la musica: il nastro con accordi e note scorre sotto
// una riga ferma, la tastiera accende i tasti che stanno suonando, in grande c'è la nota del momento. Poche cose,
// le spiegazioni solo nei suggerimenti. Suono: un sintetizzatore semplice.
(function (radice) {
  'use strict';
  const A = radice ? radice.ScoreAbc : require('../src/compositore/abc.js');
  const NOTE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  const LETTERE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SEZIONI = { intro: 'Apertura', verse: 'Strofa', 'pre-chorus': 'Pre-ritornello', chorus: 'Ritornello', bridge: 'Ponte', interlude: 'Assolo', outro: 'Finale', instrumental: 'Strumentale' };
  const nomeNota = (midi) => NOTE[midi % 12];
  const QUALITA = { '': 'maggiore', m: 'minore', 7: 'settima', maj7: 'maggiore settima', m7: 'minore settima', m7b5: 'semidiminuito', dim: 'diminuito', dim7: 'diminuito settima', aug: 'aumentato', sus2: 'sospeso 2', sus4: 'sospeso 4', '7sus4': 'settima sospesa', 6: 'sesta', m6: 'minore sesta', 'm(maj7)': 'minore con settima maggiore' };
  // "Bbm7/D" -> { nota: "Sib", tipo: "minore settima", basso: "Re" }
  function partiAccordo(sigla) {
    const nota = (l, a) => NOTE[(LETTERE[l] + (a === '#' ? 1 : a === 'b' ? 11 : 0)) % 12];
    const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sigla);
    if (!m) return { nota: sigla, tipo: '', basso: '' };
    return { nota: nota(m[1], m[2]), tipo: QUALITA[m[3]] ?? m[3], basso: m[4] ? nota(m[4], m[5]) : '' };
  }
  // per intero: "Sib minore settima, basso Re"
  function nomeAccordo(sigla) {
    const p = partiAccordo(sigla);
    return `${p.nota} ${p.tipo}${p.basso ? `, basso ${p.basso}` : ''}`.trim();
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

  // I tasti da accendere: la melodia, e l'accordo come lo suona il sintetizzatore (basso e note)
  function tastiDi(ev, p) {
    const a = ev.accordi[p.accordo];
    return {
      melodia: p.nota < 0 ? null : ev.note[p.nota].midi,
      accordo: a ? [36 + a.basso, ...a.note.map((n) => 48 + n)] : [],
    };
  }
  // dal Do più basso al Si più alto che serve
  function estensione(ev) {
    const tutte = [...ev.note.map((n) => n.midi), ...ev.accordi.flatMap((a) => [36 + a.basso, ...a.note.map((n) => 48 + n)])];
    return [Math.floor(Math.min(...tutte, 60) / 12) * 12, Math.floor(Math.max(...tutte, 71) / 12) * 12 + 11];
  }
  // Il secondo di orologio audio che sta uscendo adesso dalle casse: la scheda audio dichiara a che punto è;
  // dove non lo fa si toglie il ritardo annunciato.
  function tempoUdibile(ctx, ora) {
    const s = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    const t = s && s.contextTime > 0 ? s.contextTime + (ora - s.performanceTime) / 1000 : ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    return Math.min(t, ctx.currentTime);
  }

  if (typeof module !== 'undefined') module.exports = { eventi, posizione, partiAccordo, nomeAccordo, tastiDi, estensione, tempoUdibile };
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

  // programma sull'orologio audio tutto ciò che suona dal secondo "da" a "fino"
  function programma(ctx, ev, inizio, da, fino = Infinity) {
    const nota = voce(ctx);
    const metti = (x, midi, forma, volume) => { const a = Math.min(x.t + x.durata, fino); const t = Math.max(x.t, da); if (a - t > 0.02) nota(midi, inizio + t, a - t, forma, volume); };
    for (const a of ev.accordi) { metti(a, 36 + a.basso, 'triangle', 0.11); for (const n of a.note) metti(a, 48 + n, 'sine', 0.05); }
    for (const x of ev.note) metti(x, x.midi, 'triangle', 0.22);
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TESTA = 0.3;          // la riga ferma, a questa frazione della larghezza
  const BATTUTE_IN_VISTA = 2.6;
  const NERI = new Set([1, 3, 6, 8, 10]);
  const SINCRONIA = 'comp-sincronia'; // correzione in millisecondi, ricordata in questo browser
  const leggiSincronia = () => { try { const v = Number(localStorage.getItem(SINCRONIA)); return Number.isFinite(v) ? Math.max(-500, Math.min(500, v)) : 0; } catch (e) { return 0; } };

  function tastiera([min, max]) {
    const bianchi = [];
    for (let m = min; m <= max; m++) if (!NERI.has(m % 12)) bianchi.push(m);
    const largo = 100 / bianchi.length;
    return bianchi.map((m, i) => {
      const nero = m + 1 <= max && NERI.has((m + 1) % 12) ? `<i class="lt-nero" data-k="${m + 1}" style="left:${(i + 1) * largo - largo * 0.32}%;width:${largo * 0.64}%"><span>${NOTE[(m + 1) % 12]}</span></i>` : '';
      return `<i class="lt-bianco" data-k="${m}" style="left:${i * largo}%;width:${largo}%"><span>${NOTE[m % 12]}</span></i>${nero}`;
    }).join('');
  }

  // apre il lettore in "box" e parte. spiega = cosa si sta sentendo (va nel suggerimento)
  function apri(box, score, { spiega = '', suFine = () => {} } = {}) {
    const ev = eventi(score);
    const [min, max] = estensione(ev);
    const altezze = ev.note.map((n) => n.midi);
    const basso = Math.min(...altezze, 60) - 1, alto = Math.max(...altezze, 72) + 1;
    const piuSezioni = ev.sezioni.length > 1;
    let sincronia = leggiSincronia();
    box.innerHTML = `<div class="lt" role="group" aria-label="Riproduzione">
      <div class="lt-ora">
        <strong data-l="nota">—</strong><span data-l="accordo"></span>
        <small data-l="dove"></small>
        <button type="button" class="lt-info" aria-label="Come si legge" data-tip="${esc(`Il nastro scorre da destra a sinistra: suona ciò che passa sulla riga rossa.\nIn alto gli accordi, sotto le note: più in alto = più acuta, più larga = più lunga.\nSulla tastiera, in rosso la nota della melodia, in blu i tasti dell’accordo.\n${spiega}`)}">?</button>
      </div>
      <div class="lt-scena" data-l="scena"><div class="lt-nastro" data-l="nastro"></div><i class="lt-testa" style="left:${TESTA * 100}%"></i></div>
      <div class="lt-tastiera" data-l="tastiera" aria-hidden="true" data-tip="In rosso la nota della melodia, in blu le note dell’accordo.">${tastiera([min, max])}</div>
      <div class="lt-barra" data-l="barra" role="slider" tabindex="0" aria-label="Punto di ascolto" aria-valuemin="1" aria-valuemax="${ev.battute.length}" data-tip="Premi un punto per saltare lì (da tastiera: frecce)."><i data-l="fatto"></i></div>
      <div class="lt-tasti">
        <button type="button" class="btn small" data-l="pausa">❚❚ Pausa</button>
        <button type="button" class="btn small ghost" data-l="capo" data-tip="Ricomincia dall’inizio">↺</button>
        <button type="button" class="btn small ghost" data-l="ferma">■ Chiudi</button>
        <span class="lt-sincro" data-tip="Se la riga arriva prima o dopo il suono (succede con le cuffie senza fili), correggi qui: + ritarda la riga, − la anticipa.">Sincronia <button type="button" data-sincro="-50" aria-label="Anticipa la riga">−</button><b data-l="sincro"></b><button type="button" data-sincro="50" aria-label="Ritarda la riga">+</button></span>
      </div></div>`;
    const el = (n) => box.querySelector(`[data-l="${n}"]`);
    const scritta = () => { el('sincro').textContent = `${sincronia > 0 ? '+' : ''}${sincronia} ms`; };
    scritta();
    let ctx = null, inizio = 0, quadro = 0, finito = false, ultimo = '', punto = 0, scala = 0;
    let note = [], accordi = [], accesi = [];

    // il nastro intero, in pixel: si ridisegna solo se cambia la larghezza
    function nastro() {
      const largo = el('scena').clientWidth || 600;
      scala = largo / (ev.battute[0].durata * BATTUTE_IN_VISTA); // pixel al secondo
      const x = (t) => (t * scala).toFixed(1);
      const battute = ev.battute.map((b, i) => `<div class="lt-battuta" style="left:${x(b.t)}px;width:${x(b.durata)}px"><small>${i + 1}${piuSezioni && ev.sezioni[b.sezione].da === i ? ` · ${esc(ev.sezioni[b.sezione].nome)}` : ''}</small></div>`).join('');
      const giri = ev.accordi.map((a, k) => { const p = partiAccordo(a.sigla); return `<div class="lt-accordo" data-a="${k}" style="left:${x(a.t)}px;width:${x(a.durata)}px"><b>${esc(p.nota)}</b><span>${esc(p.tipo)}</span></div>`; }).join('');
      const melodia = ev.note.map((n, k) => `<div class="lt-nota" data-n="${k}" style="left:${x(n.t)}px;width:${x(n.durata)}px;bottom:${((n.midi - basso) / (alto - basso)) * 100}%"><span>${nomeNota(n.midi)}</span></div>`).join('');
      el('nastro').innerHTML = `${battute}<div class="lt-accordi">${giri}</div><div class="lt-note">${melodia}</div>`;
      note = el('nastro').querySelectorAll('[data-n]');
      accordi = el('nastro').querySelectorAll('[data-a]');
      accesi = []; ultimo = '';
    }

    function mostra(t) {
      punto = t;
      // a ogni fotogramma si muove soltanto il nastro: lo scorrimento resta fluido
      el('nastro').style.transform = `translate3d(${(el('scena').clientWidth * TESTA - t * scala).toFixed(1)}px,0,0)`;
      el('fatto').style.width = Math.max(0, Math.min(100, (t / ev.totale) * 100)) + '%';
      const p = posizione(ev, Math.max(0, t));
      const chiave = `${p.battuta}.${p.nota}.${p.accordo}`;
      if (chiave === ultimo) return;
      ultimo = chiave;
      accesi.forEach((x) => x.classList.remove('ora', 'suona-melodia', 'suona-accordo'));
      accesi = [note[p.nota], accordi[p.accordo]].filter(Boolean);
      accesi.forEach((x) => x.classList.add('ora'));
      const { melodia, accordo } = tastiDi(ev, p);
      const tasto = (m) => el('tastiera').querySelector(`[data-k="${m}"]`);
      for (const m of accordo) { const k = tasto(m); if (k) { k.classList.add('suona-accordo'); accesi.push(k); } }
      if (melodia !== null) { const k = tasto(melodia); if (k) { k.classList.add('suona-melodia'); accesi.push(k); } }
      el('nota').textContent = melodia === null ? 'pausa' : nomeNota(melodia);
      el('nota').classList.toggle('muta', melodia === null);
      el('accordo').textContent = p.accordo < 0 ? '' : `accordo di ${nomeAccordo(ev.accordi[p.accordo].sigla)}`;
      const b = ev.battute[p.battuta];
      el('dove').textContent = `${piuSezioni ? ev.sezioni[b.sezione].nome + ' · ' : ''}battuta ${p.battuta + 1} di ${ev.battute.length}`;
      el('barra').setAttribute('aria-valuenow', p.battuta + 1);
    }

    const chiudiAudio = () => { ctx?.close().catch(() => {}); };
    // il suono parte dal secondo richiesto
    function suonaDa(da) {
      chiudiAudio();
      ctx = new AudioContext();
      inizio = ctx.currentTime + 0.15 - da;
      programma(ctx, ev, inizio, da);
      finito = false;
      el('pausa').textContent = '❚❚ Pausa';
      mostra(da);
      cancelAnimationFrame(quadro);
      segui();
    }
    // la riga segue ciò che esce dalle casse, non un timer a parte
    function segui() {
      if (!ctx || finito) return;
      const t = tempoUdibile(ctx, performance.now()) - inizio - sincronia / 1000;
      if (t >= ev.totale) { finito = true; mostra(ev.totale - 0.001); el('pausa').textContent = '▶ Riascolta'; return; }
      if (ctx.state === 'running') mostra(Math.max(punto, t, 0));
      quadro = requestAnimationFrame(segui);
    }
    const osserva = new ResizeObserver(() => { nastro(); mostra(punto); });
    function ferma() {
      cancelAnimationFrame(quadro);
      osserva.disconnect();
      chiudiAudio();
      ctx = null;
      box.innerHTML = '';
      box.onclick = null;
      box.onkeydown = null;
    }
    const salta = (battuta) => suonaDa(ev.battute[Math.max(0, Math.min(ev.battute.length - 1, battuta))].t);
    box.onclick = (e) => {
      const s = e.target.closest('[data-sincro]');
      if (s) {
        sincronia = Math.max(-500, Math.min(500, sincronia + Number(s.dataset.sincro)));
        try { localStorage.setItem(SINCRONIA, String(sincronia)); } catch (x) { /* vale per questa visita */ }
        punto = 0; // la riga può anche tornare un poco indietro
        return scritta();
      }
      const barra = e.target.closest('[data-l="barra"]');
      if (barra) {
        const r = barra.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width) * ev.totale;
        return salta(posizione(ev, t).battuta);
      }
      if (e.target.closest('[data-l="capo"]')) return suonaDa(0);
      if (e.target.closest('[data-l="ferma"]')) { ferma(); return suFine(); }
      if (!e.target.closest('[data-l="pausa"]') || !ctx) return;
      if (finito) return suonaDa(0);
      const inPausa = ctx.state === 'suspended';
      // se l'ascolto riparte o si chiude mentre il browser sta ancora eseguendo, il rifiuto è atteso
      (inPausa ? ctx.resume() : ctx.suspend()).catch(() => {});
      el('pausa').textContent = inPausa ? '❚❚ Pausa' : '▶ Riprendi';
    };
    box.onkeydown = (e) => {
      if (!e.target.closest('[data-l="barra"]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      salta(posizione(ev, punto).battuta + (e.key === 'ArrowLeft' ? -1 : 1));
    };
    nastro();
    suonaDa(0);
    osserva.observe(el('scena'));
    return { ferma, eventi: ev };
  }

  radice.LettoreComposizione = { eventi, posizione, partiAccordo, nomeAccordo, tastiDi, tempoUdibile, apri, voce, programma, tastiera, leggiSincronia };
})(typeof window !== 'undefined' ? window : null);
