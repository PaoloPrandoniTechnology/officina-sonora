// Pagina Score: archivio degli score, editor con piano roll e ascolto, score per i brani da produrre,
// impostazioni di scrittura. La musica si legge e si scrive con abc.js, lo stesso codice della produzione.
window.PaginaScore = function (app) {
  'use strict';
  const { $, esc, ic, imposta, toast, chiedi, invia, leggi, data, n0 } = app;
  const A = window.ScoreAbc;
  const radice = $('#scPagina');
  const finestra = $('#finestra');

  const NOMI_NOTE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  const nota = (m) => NOMI_NOTE[m % 12] + (Math.floor(m / 12) - 1);
  const FONTI = { modello: 'Modello YuE2', compositore: 'Compositore', motore: 'Motore', manuale: 'Scelto a mano' };
  const fonte = (f) => FONTI[f] || 'Non registrata';
  const SEZIONI_IT = { intro: 'Introduzione', verse: 'Strofa', 'pre-chorus': 'Lancio', chorus: 'Ritornello', bridge: 'Ponte', interlude: 'Interludio', outro: 'Finale', instrumental: 'Strumentale' };
  const sez = (s) => SEZIONI_IT[s] || s;
  const durata = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const perc = (v) => (v === null || v === undefined ? '—' : Math.round(v * 100) + '%');

  let vista = 'archivio';
  let quadro = null;   // risposta di /api/score
  // nome leggibile del genere: dai dati di questa pagina, che arrivano prima di quelli della libreria
  const nm = (n) => (((quadro && quadro.generi) || []).find((g) => g.nome === n) || {}).etichetta || app.nm(n);
  let archivio = null; // risposta di /api/score/brani
  const filtro = { q: '', fonte: '', quanti: 40 };

  // ---------- documento nell'editor ----------
  const ricordato = () => { try { return JSON.parse(localStorage.getItem('scoreEditor')); } catch (e) { return null; } };
  const doc = { testo: '', nome: '', categoria: '', bozza: null, brano: '', salvato: '', annulla: [], ripeti: [], ...ricordato() };
  doc.annulla = []; doc.ripeti = [];
  let analisi = null;       // dell'ultimo testo
  let valido = null;        // ultimo score leggibile: il piano roll resta su quello
  let sel = null;           // evento scelto: { s, b, voce, i }
  let zoom = 3;             // pixel per trentaduesimo
  const ricorda = () => { try { localStorage.setItem('scoreEditor', JSON.stringify({ testo: doc.testo, nome: doc.nome, categoria: doc.categoria, bozza: doc.bozza, brano: doc.brano, salvato: doc.salvato })); } catch (e) { /* solo per questa visita */ } };
  const modificato = () => doc.testo.trim() !== '' && doc.testo !== doc.salvato;

  function esamina() {
    analisi = doc.testo.trim() ? A.analizza(doc.testo) : null;
    if (analisi && analisi.score) valido = analisi.score;
    else if (!analisi) valido = null;
  }
  function cambiaTesto(testo, daTastiera) {
    if (testo === doc.testo) return;
    doc.annulla.push(doc.testo);
    if (doc.annulla.length > 100) doc.annulla.shift();
    doc.ripeti = [];
    doc.testo = testo;
    ferma();
    esamina(); ricorda();
    disegnaEditor(daTastiera);
  }
  function storia(da, a) {
    if (!da.length) return;
    a.push(doc.testo);
    doc.testo = da.pop();
    sel = null;
    ferma(); esamina(); ricorda(); disegnaEditor();
  }
  // una modifica allo score: si riscrive il testo con lo stesso codice della produzione
  function modifica(fn) {
    if (!valido || !analisi || !analisi.score) return toast('Prima correggi gli errori nel testo', 'err');
    const score = A.leggiAbc(doc.testo).score;
    try {
      const nuovo = fn(score) || score;
      if (!nuovo.sezioni.some((s) => s.battute.length)) throw new Error('lo score resterebbe vuoto');
      cambiaTesto(A.scriviAbc(A.sistemaLegature(nuovo)));
    } catch (e) { toast(e.message, 'err'); }
  }
  async function carica(nuovo) {
    if (modificato() && doc.testo !== nuovo.testo && !(await chiedi('Lasciare le modifiche?', 'Lo score aperto nell\'editor ha modifiche non salvate.', 'Lascia le modifiche'))) return;
    Object.assign(doc, { testo: '', nome: '', categoria: '', bozza: null, brano: '', ...nuovo, annulla: [], ripeti: [] });
    doc.salvato = nuovo.salvato ?? doc.testo;
    sel = null; valido = null;
    ferma(); esamina(); ricorda();
    app.vai('score/editor');
  }

  // ---------- ascolto: un sintetizzatore semplice, per controllare note e accordi ----------
  let suono = null;
  function eventiSonori(score, daSezione) {
    const unitaSec = 60 / score.bpm / 8;
    const note = [];
    const battute = [];
    let t = 0;
    const aperte = {};
    score.sezioni.forEach((s, si) => {
      if (si < daSezione) return;
      const lunghezza = A.unita(s.metro || score.metro);
      s.battute.forEach((b, bi) => {
        battute.push({ s: si, b: bi, t, durata: lunghezza * unitaSec });
        for (const voce of ['ins', 'vocal']) {
          let pos = 0;
          for (const e of b[voce] || []) {
            if (e.midi === null) aperte[voce] = null;
            else if (aperte[voce] && aperte[voce].midi === e.midi) aperte[voce].durata += e.durata * unitaSec;
            else note.push((aperte[voce] = { midi: e.midi, t: t + pos * unitaSec, durata: e.durata * unitaSec, tipo: voce }));
            if (!e.lega) aperte[voce] = null;
            pos += e.durata;
          }
        }
        const accordi = b.accordi || [];
        accordi.forEach((a, i) => {
          const c = A.noteAccordo(a.sigla);
          if (!c) return;
          const fine = i + 1 < accordi.length ? accordi[i + 1].pos : lunghezza;
          const quando = { t: t + a.pos * unitaSec, durata: (fine - a.pos) * unitaSec };
          note.push({ midi: 36 + c.basso, tipo: 'basso', ...quando }, ...c.note.map((n) => ({ midi: 48 + n, tipo: 'accordo', ...quando })));
        });
        t += lunghezza * unitaSec;
      });
    });
    return { note: note.sort((a, b) => a.t - b.t), battute, totale: t };
  }
  const VOCI = { ins: ['triangle', 0.22], vocal: ['sine', 0.26], accordo: ['sine', 0.045], basso: ['triangle', 0.11] };
  function suona() {
    if (suono) return ferma();
    if (!analisi || !analisi.score) return toast('Prima correggi gli errori nel testo', 'err');
    app.pausaLettore();
    const ctx = new AudioContext();
    const ev = eventiSonori(analisi.score, sel ? sel.s : 0);
    const avvio = ctx.currentTime + 0.1;
    let k = 0;
    // si programma poco alla volta: uno score lungo ha migliaia di note
    const programma = () => {
      while (k < ev.note.length && ev.note[k].t < ctx.currentTime - avvio + 1) {
        const n = ev.note[k++];
        const [forma, volume] = VOCI[n.tipo];
        const o = ctx.createOscillator(), g = ctx.createGain(), da = avvio + n.t, a = da + n.durata;
        o.type = forma; o.frequency.value = 440 * 2 ** ((n.midi - 69) / 12);
        g.gain.setValueAtTime(0, da);
        g.gain.linearRampToValueAtTime(volume, da + 0.015);
        g.gain.setValueAtTime(volume * 0.8, Math.max(da + 0.016, a - 0.06));
        g.gain.linearRampToValueAtTime(0, a);
        o.connect(g).connect(ctx.destination); o.start(da); o.stop(a + 0.02);
      }
      if (ctx.currentTime - avvio > ev.totale + 0.3) ferma();
    };
    const segui = () => {
      if (!suono) return;
      const t = ctx.currentTime - avvio;
      const b = [...ev.battute].reverse().find((x) => x.t <= t);
      const linea = $('#scTesta'), scorri = $('#scRoll');
      if (b && linea && scorri) {
        const g = geometria.battute.find((x) => x.s === b.s && x.b === b.b);
        if (g) {
          const x = g.x + Math.min(1, (t - b.t) / b.durata) * g.w;
          linea.setAttribute('x1', x); linea.setAttribute('x2', x); linea.removeAttribute('visibility');
          if (x < scorri.scrollLeft || x > scorri.scrollLeft + scorri.clientWidth - 60) scorri.scrollLeft = x - 60;
        }
      }
      suono.quadro = requestAnimationFrame(segui);
    };
    suono = { ctx, orologio: setInterval(programma, 150) };
    programma(); segui();
    disegnaTastoSuona();
  }
  function ferma() {
    if (!suono) return;
    clearInterval(suono.orologio);
    cancelAnimationFrame(suono.quadro);
    suono.ctx.close();
    suono = null;
    $('#scTesta')?.setAttribute('visibility', 'hidden');
    disegnaTastoSuona();
  }
  const disegnaTastoSuona = () => { const b = $('#scSuona'); if (b) b.innerHTML = suono ? ic('pausa') + 'Ferma' : ic('play') + (sel ? 'Ascolta dalla sezione' : 'Ascolta'); };

  // ---------- piano roll ----------
  const ALTO = 9, TESTA = 40; // altezza di un semitono; righe di sezioni e accordi
  let geometria = { battute: [], min: 48, max: 84 };
  function disegnaRoll() {
    const box = $('#scRoll');
    if (!box) return;
    if (!valido) { box.innerHTML = '<div class="empty">Apri uno score dall\'archivio, componine uno nuovo o incolla il testo qui sotto.</div>'; $('#scTasti').innerHTML = ''; return; }
    const note = valido.sezioni.flatMap((s) => s.battute.flatMap((b) => [...(b.ins || []), ...(b.vocal || [])])).filter((n) => n.midi !== null).map((n) => n.midi);
    let min = Math.min(...note, 72) - 3, max = Math.max(...note, 60) + 3;
    while (max - min < 24) { max++; min--; }
    const h = TESTA + (max - min + 1) * ALTO;
    const y = (m) => TESTA + (max - m) * ALTO;
    let x = 0, sfondo = '', righe = '', pezzi = '', ultimo = {};
    const battute = [];
    valido.sezioni.forEach((s, si) => {
      const lunghezza = A.unita(s.metro || valido.metro);
      const x0 = x;
      s.battute.forEach((b, bi) => {
        const w = lunghezza * zoom;
        battute.push({ s: si, b: bi, x, w, lunghezza });
        righe += `<line class="r-battuta" x1="${x}" x2="${x}" y1="${TESTA - 18}" y2="${h}"/>`;
        for (let q = 8; q < lunghezza; q += 8) righe += `<line class="r-quarto" x1="${x + q * zoom}" x2="${x + q * zoom}" y1="${TESTA}" y2="${h}"/>`;
        for (const a of b.accordi || []) {
          const qui = x + a.pos * zoom + 3;
          // lo stesso accordo ripetuto a pochi pixel si scrive una volta sola
          if (ultimo.sigla === a.sigla && qui - ultimo.x < 40) continue;
          ultimo = { sigla: a.sigla, x: qui };
          pezzi += `<text class="r-accordo" x="${qui}" y="${TESTA - 6}">${esc(a.sigla)}</text>`;
        }
        for (const voce of ['ins', 'vocal']) {
          let pos = 0;
          (b[voce] || []).forEach((e, i) => {
            const scelto = sel && sel.s === si && sel.b === bi && sel.voce === voce && sel.i === i;
            if (e.midi !== null) pezzi += `<rect class="r-nota ${voce}${scelto ? ' scelta' : ''}" x="${x + pos * zoom + 0.5}" y="${y(e.midi) + 0.5}" width="${Math.max(2, e.durata * zoom - (e.lega ? 0 : 1.5))}" height="${ALTO - 1}" rx="2" data-ev="${si},${bi},${voce},${i}"><title>${nota(e.midi)}, ${e.durata}/32</title></rect>`;
            else if (scelto) pezzi += `<rect class="r-pausa" x="${x + pos * zoom + 1}" y="${TESTA}" width="${e.durata * zoom - 2}" height="${h - TESTA}"/>`;
            pos += e.durata;
          });
        }
        x += w;
      });
      sfondo += `<rect class="r-sezione${si % 2 ? ' pari' : ''}" x="${x0}" y="0" width="${x - x0}" height="19"/><text class="r-nome" x="${x0 + 5}" y="13">${esc(sez(s.nome))}${s.metro ? ' ' + esc(s.metro) : ''}</text>`;
    });
    for (let m = min; m <= max; m++) if ([1, 3, 6, 8, 10].includes(m % 12)) sfondo += `<rect class="r-nero" x="0" y="${y(m)}" width="${x}" height="${ALTO}"/>`;
    geometria = { battute, min, max };
    const scorso = box.scrollLeft;
    box.innerHTML = `<svg width="${x + 1}" height="${h}" role="img" aria-label="Note e accordi dello score">${sfondo}${righe}${pezzi}<line id="scTesta" class="r-testa" y1="0" y2="${h}" visibility="hidden"/></svg>`;
    box.scrollLeft = scorso;
    box.classList.toggle('vecchio', !analisi || !analisi.score);
    let tasti = '';
    for (let m = min; m <= max; m++) if (m % 12 === 0) tasti += `<text class="axis" x="26" y="${y(m) + ALTO - 1}" text-anchor="end">${nota(m)}</text>`;
    $('#scTasti').innerHTML = `<svg width="30" height="${h}" aria-hidden="true">${tasti}</svg>`;
  }

  const evento = () => (sel && valido ? ((valido.sezioni[sel.s] || { battute: [] }).battute[sel.b] || {})[sel.voce]?.[sel.i] : null);
  const diSel = (score) => { const b = score.sezioni[sel.s].battute[sel.b]; return { b, eventi: b[sel.voce] }; };
  function disegnaNota() {
    const e = evento(), box = $('#scNota');
    if (!box) return;
    const bott = (azione, testo, spento) => `<button type="button" class="btn small ghost" data-n="${azione}" ${spento ? 'disabled' : ''}>${testo}</button>`;
    imposta(box, !e ? '<span class="muted">Clic su una nota per modificarla, doppio clic su uno spazio vuoto per aggiungerne una, clic sulla riga degli accordi per cambiarli.</span>'
      : `<b>${e.midi === null ? 'Pausa' : nota(e.midi)}</b> <span class="muted">${e.durata}/32, battuta ${sel.b + 1} di ${esc(sez(valido.sezioni[sel.s].nome).toLowerCase())}</span>
      ${e.midi === null ? bott('crea', 'Trasforma in nota') : bott('su', 'Più acuta') + bott('giu', 'Più grave') + bott('su8', 'Ottava su') + bott('giu8', 'Ottava giù') + bott('pausa', 'Togli')}
      ${bott('dividi', 'Dividi', e.durata < 2)}${bott('unisci', 'Unisci alla successiva', !(valido.sezioni[sel.s].battute[sel.b][sel.voce] || [])[sel.i + 1])}`);
  }
  function azioneNota(azione) {
    if (!evento()) return;
    modifica((score) => {
      const { eventi } = diSel(score);
      const e = eventi[sel.i];
      const sposta = (d) => { if (e.midi === null) return; if (e.midi + d < 36 || e.midi + d > 96) throw new Error('nota fuori dall\'estensione'); e.midi += d; delete e.lega; };
      if (azione === 'su') sposta(1);
      if (azione === 'giu') sposta(-1);
      if (azione === 'su8') sposta(12);
      if (azione === 'giu8') sposta(-12);
      if (azione === 'pausa') { e.midi = null; delete e.lega; }
      if (azione === 'crea') e.midi = 12 * Math.floor(((geometria.min + geometria.max) / 2) / 12) + (A.noteAccordo((diSel(score).b.accordi || [])[0]?.sigla)?.radice || 0);
      if (azione === 'dividi' && e.durata >= 2) { const meta = Math.floor(e.durata / 2); eventi.splice(sel.i, 1, { midi: e.midi, durata: meta }, { ...e, durata: e.durata - meta }); }
      if (azione === 'unisci' && eventi[sel.i + 1]) { const dopo = eventi.splice(sel.i + 1, 1)[0]; e.durata += dopo.durata; if (dopo.lega) e.lega = true; else delete e.lega; }
    });
  }
  function selezionaVicino(passo) {
    if (!sel || !valido) return;
    const tutti = valido.sezioni.flatMap((s, si) => s.battute.flatMap((b, bi) => (b[sel.voce] || []).map((e, i) => ({ s: si, b: bi, voce: sel.voce, i }))));
    const k = tutti.findIndex((x) => x.s === sel.s && x.b === sel.b && x.i === sel.i);
    if (tutti[k + passo]) { sel = tutti[k + passo]; disegnaRoll(); disegnaNota(); disegnaTastoSuona(); }
  }
  // doppio clic nel vuoto: una nota di un ottavo nel punto scelto, ritagliata dalla pausa che c'è lì
  function aggiungiNota(g, pos, midi) {
    modifica((score) => {
      const b = score.sezioni[g.s].battute[g.b];
      b.ins ||= [{ midi: null, durata: g.lunghezza }];
      let inizio = 0;
      for (let i = 0; i < b.ins.length; i++) {
        const e = b.ins[i], fine = inizio + e.durata;
        if (pos < fine) {
          if (e.midi !== null) throw new Error('qui c\'è già una nota: modificala o toglila');
          const da = Math.max(inizio, Math.floor(pos / 4) * 4), a = Math.min(fine, da + 4);
          b.ins.splice(i, 1, ...[{ midi: null, durata: da - inizio }, { midi, durata: a - da }, { midi: null, durata: fine - a }].filter((x) => x.durata > 0));
          sel = { s: g.s, b: g.b, voce: 'ins', i: i + (da > inizio ? 1 : 0) };
          return;
        }
        inizio = fine;
      }
    });
  }
  function accordo(g, pos, x, y) {
    const quarto = Math.floor(pos / 8) * 8;
    const presenti = valido.sezioni[g.s].battute[g.b].accordi || [];
    const c = presenti.filter((a) => a.pos <= pos && a.pos >= quarto).pop();
    const dove = c ? c.pos : quarto;
    const m = app.popover('menuAccordo', `<form><label>Accordo al battito ${dove / 8 + 1}<input class="field" name="a" value="${esc(c ? c.sigla : '')}" placeholder="Es. Am7, C/G" autocomplete="off" list="scAccordi"></label>
      <datalist id="scAccordi">${['', 'm', '7', 'maj7', 'm7', 'sus4', 'sus2'].flatMap((t) => ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => `<option value="${n + t}">`)).join('')}</datalist>
      <p>Vuoto per toglierlo.</p><button class="btn small" type="submit">Applica</button></form>`, x, y);
    m.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const sigla = e.target.elements.a.value.trim();
      if (sigla && !A.noteAccordo(sigla)) return toast('Accordo non riconosciuto: usa per esempio Am, G7, Cmaj7, D/F#', 'err');
      m.hidePopover();
      modifica((score) => {
        const b = score.sezioni[g.s].battute[g.b];
        b.accordi = (b.accordi || []).filter((a) => a.pos !== dove);
        if (sigla) b.accordi.push({ pos: dove, sigla });
        b.accordi.sort((p, q) => p.pos - q.pos);
      });
    };
  }
  function puntoRoll(e) {
    const svg = $('#scRoll svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const g = geometria.battute.find((b) => x >= b.x && x < b.x + b.w);
    return g ? { g, y, pos: Math.min(g.lunghezza - 1, Math.floor((x - g.x) / zoom)), midi: geometria.max - Math.floor((y - TESTA) / ALTO) } : null;
  }

  // ---------- sezioni e misure ----------
  function disegnaSezioni() {
    const box = $('#scSezioni');
    if (!box) return;
    const a = analisi && analisi.score ? analisi : null;
    imposta(box, !a ? '<div class="empty">Compaiono quando lo score è leggibile.</div>' : `<table class="sc-sezioni"><tbody>${a.sezioni.map((s, i) => {
      const bott = (azione, icona, nome, spento) => `<button type="button" class="tasto-riga" data-sez="${azione}" data-i="${i}" aria-label="${nome}: ${esc(sez(s.nome))}" data-tip="${nome}" ${spento ? 'disabled' : ''}>${icona}</button>`;
      return `<tr><td>${i + 1}</td><td><select class="field" data-nome="${i}" aria-label="Nome della sezione ${i + 1}">${[...new Set([...A.SEZIONI, s.nome])].map((n) => `<option value="${esc(n)}"${n === s.nome ? ' selected' : ''}>${esc(sez(n))}</option>`).join('')}</select></td>
        <td class="num">${s.battute} batt.</td><td class="num">${durata(s.secondi)}</td><td class="azioni-riga">
        ${bott('vai', ic('play'), 'Seleziona e ascolta da qui')}${bott('su', '↑', 'Sposta prima', !i)}${bott('giu', '↓', 'Sposta dopo', i === a.sezioni.length - 1)}${bott('doppia', '⧉', 'Duplica')}${bott('via', ic('x'), 'Elimina', a.sezioni.length < 2)}</td></tr>`;
    }).join('')}</tbody></table>`);
  }
  function disegnaMisure() {
    const box = $('#scMisure');
    if (!box) return;
    if (!analisi) return imposta(box, '<div class="empty">Nessuno score aperto.</div>');
    if (!analisi.score) return imposta(box, `<p class="err">Lo score non è valido: il motore non lo potrebbe usare.</p><ul class="sc-errori">${analisi.errori.slice(0, 8).map((e) => `<li>${esc(e)}</li>`).join('')}</ul><p><button type="button" class="btn small" data-sc="ripara" data-tip="Tiene la parte iniziale valida, fino a un confine di sezione">Recupera la parte valida</button></p>`);
    const a = analisi, g = quadro && quadro.generi.find((x) => x.nome === doc.categoria);
    const avvisi = [];
    if (a.secondi < A.SECONDI_MANUALE[0] || a.secondi > A.SECONDI_MANUALE[1]) avvisi.push(`Per produrlo deve durare da ${A.SECONDI_MANUALE[0]} a ${A.SECONDI_MANUALE[1]} secondi.`);
    if (g && !g.vocale && a.voce) avvisi.push('Il genere è strumentale ma la voce «Vocal» ha note: usa «Voce agli strumenti».');
    if (g && (a.bpm < g.bpm[0] || a.bpm > g.bpm[1])) avvisi.push(`La velocità è fuori da quella del genere (${g.bpm[0]}–${g.bpm[1]} bpm).`);
    if (a.ripetizione > 0.8) avvisi.push('Quasi tutte le battute sono ripetizioni: il brano rischia di essere monotono.');
    imposta(box, `<div class="kv"><span>Durata</span><span>${durata(a.secondi)}</span><span>Velocità</span><span>${a.bpm} bpm</span><span>Tonalità</span><span>${esc(A.nomeTonalita(a.tonalita))}</span><span>Metro</span><span>${esc(a.metro)}</span>
      <span>Battute</span><span>${n0(a.battute)}</span><span>Note</span><span>${n0(a.note)}</span><span>Estensione</span><span>${a.estensione ? nota(a.estensione[0]) + ' – ' + nota(a.estensione[1]) : '—'}</span><span>Cambi di accordo</span><span>${n0(a.accordi)}</span>
      <span data-tip="Quota di battute melodiche identiche a una già sentita">Battute ripetute</span><span>${perc(a.ripetizione)}</span><span data-tip="Quota di battute che iniziano con una nota dell'accordo: di solito suona più consonante">Accordo sul primo battito</span><span>${perc(a.accordoSulBattere)}</span></div>
      ${avvisi.map((t) => `<p class="avviso">${esc(t)}</p>`).join('')}`);
  }
  function disegnaEditor(daTastiera) {
    if (vista !== 'editor' || !$('#scRoll')) return;
    if (sel && !evento()) sel = null;
    const area = $('#scTestoAbc');
    if (!daTastiera && area.value !== doc.testo) area.value = doc.testo;
    disegnaRoll(); disegnaNota(); disegnaSezioni(); disegnaMisure(); disegnaTastoSuona();
    const ok = !!(analisi && analisi.score);
    for (const b of radice.querySelectorAll('[data-richiede="valido"]')) b.disabled = !ok;
    radice.querySelector('[data-sc="annulla"]').disabled = !doc.annulla.length;
    radice.querySelector('[data-sc="ripeti"]').disabled = !doc.ripeti.length;
    $('#scBpm').value = ok ? analisi.bpm : '';
    $('#scStato').className = modificato() ? 'da-salvare' : '';
    $('#scStato').textContent = !doc.testo.trim() ? '' : modificato() ? 'Modifiche non salvate.' : doc.bozza ? 'Salvato nelle bozze.' : '';
    $('#scOrigine').textContent = doc.brano ? `Dal brano «${doc.brano}». L'audio già prodotto non cambia.` : '';
  }
  const opzioniGeneri = (scelto) => (quadro ? quadro.generi : []).map((g) => `<option value="${esc(g.nome)}"${g.nome === scelto ? ' selected' : ''}>${esc(g.etichetta)}</option>`).join('');
  function editor() {
    radice.innerHTML = `
      <div class="toolbar sc-testa">
        <input class="field" id="scNome" maxlength="80" placeholder="Nome dello score" aria-label="Nome dello score" value="${esc(doc.nome)}">
        <select class="field" id="scGenere" aria-label="Genere dello score"><option value="">Scegli il genere</option>${opzioniGeneri(doc.categoria)}</select>
        <button type="button" class="btn ghost" data-sc="nuovo">Componi nuovo</button>
        <label class="btn ghost" tabindex="0" id="scImporta">Importa file<input type="file" accept=".abc,.txt,text/plain" hidden></label>
        <button type="button" class="btn ghost" data-sc="scarica">Scarica .abc</button>
        <button type="button" class="btn ghost" data-sc="salva">Salva bozza</button>
        <button type="button" class="btn" data-sc="produci" data-richiede="valido">Usa in produzione</button>
      </div>
      <p class="sc-note muted"><span id="scStato"></span> <span id="scOrigine"></span></p>
      <div class="card sc-carta">
        <div class="toolbar">
          <button type="button" class="btn small" id="scSuona" data-sc="suona" data-richiede="valido"></button>
          <button type="button" class="btn small ghost" data-sc="annulla">Annulla</button><button type="button" class="btn small ghost" data-sc="ripeti">Ripeti</button>
          <label class="sc-campo">Velocità <input class="field num" type="number" id="scBpm" min="30" max="220"></label>
          <span class="sc-campo">Trasponi <button type="button" class="btn small ghost" data-t="-1" data-richiede="valido" aria-label="Trasponi giù di un semitono">−1</button><button type="button" class="btn small ghost" data-t="1" data-richiede="valido" aria-label="Trasponi su di un semitono">+1</button></span>
          <button type="button" class="btn small ghost" data-sc="strumentale" data-richiede="valido" data-tip="Sposta le note della voce agli strumenti; gli accordi restano">Voce agli strumenti</button>
          <span class="sc-campo sc-zoom">Larghezza <input type="range" id="scZoom" min="1" max="8" step="0.5" value="${zoom}" aria-label="Larghezza delle battute"></span>
        </div>
        <div class="sc-piano"><div id="scTasti"></div><div id="scRoll" tabindex="0" aria-label="Piano roll: frecce per spostarsi e cambiare altezza, Canc per togliere, Spazio per ascoltare"></div></div>
        <div id="scNota" class="sc-nota"></div>
        <div class="legenda"><span><i class="r-lg ins"></i>Strumenti (Ins)</span><span><i class="r-lg vocal"></i>Voce (Vocal)</span></div>
      </div>
      <div class="grid">
        <div class="card c8"><h2>Sezioni</h2><div id="scSezioni"></div></div>
        <div class="card c4"><h2>Controllo</h2><div id="scMisure"></div></div>
        <div class="card c12"><details ${valido ? '' : 'open'}><summary>Testo ABC <small class="muted">il file che riceve il motore: puoi scrivere o incollare qui</small></summary>
          <textarea id="scTestoAbc" class="field sc-testo" rows="18" spellcheck="false" aria-label="Testo ABC dello score"></textarea></details></div>
      </div>`;
    const area = $('#scTestoAbc');
    area.value = doc.testo;
    let attesa;
    area.oninput = () => { clearTimeout(attesa); attesa = setTimeout(() => cambiaTesto(area.value, true), 400); };
    area.onchange = () => { clearTimeout(attesa); cambiaTesto(area.value, true); };
    $('#scNome').oninput = (e) => { doc.nome = e.target.value; ricorda(); };
    $('#scGenere').onchange = (e) => { doc.categoria = e.target.value; ricorda(); disegnaMisure(); };
    $('#scBpm').onchange = (e) => { const v = Math.round(Number(e.target.value)); if (v >= 30 && v <= 220) modifica((s) => { s.bpm = v; }); else disegnaEditor(); };
    $('#scZoom').oninput = (e) => { zoom = Number(e.target.value); disegnaRoll(); };
    $('#scImporta').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.querySelector('input').click(); } };
    $('#scImporta input').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 200000) return toast('File troppo grande per uno score', 'err');
      carica({ testo: (await f.text()).replace(/\r\n/g, '\n'), nome: f.name.replace(/\.(abc|txt)$/i, ''), categoria: doc.categoria, salvato: '' });
    };
    const roll = $('#scRoll');
    roll.onclick = (e) => {
      if (!analisi || !analisi.score) return;
      const r = e.target.closest('[data-ev]');
      if (r) { const [s, b, voce, i] = r.dataset.ev.split(','); sel = { s: +s, b: +b, voce, i: +i }; disegnaRoll(); disegnaNota(); disegnaTastoSuona(); return; }
      const p = puntoRoll(e);
      if (!p) return;
      if (p.y < TESTA) { if (p.y >= 20) accordo(p.g, p.pos, e.clientX - 20, e.clientY + 10); return; }
      // clic nel vuoto: si sceglie la pausa o l'evento che occupa quel punto
      const eventi = valido.sezioni[p.g.s].battute[p.g.b].ins || [];
      let da = 0;
      const i = eventi.findIndex((ev) => (da += ev.durata) > p.pos);
      sel = i >= 0 ? { s: p.g.s, b: p.g.b, voce: 'ins', i } : null;
      disegnaRoll(); disegnaNota(); disegnaTastoSuona();
    };
    roll.ondblclick = (e) => { const p = puntoRoll(e); if (p && p.y >= TESTA && !e.target.closest('.r-nota') && analisi && analisi.score) aggiungiNota(p.g, p.pos, p.midi); };
    roll.onkeydown = (e) => {
      const azione = e.key === 'ArrowUp' ? (e.shiftKey ? 'su8' : 'su') : e.key === 'ArrowDown' ? (e.shiftKey ? 'giu8' : 'giu') : e.key === 'Delete' || e.key === 'Backspace' ? 'pausa' : null;
      if (azione && sel) { e.preventDefault(); e.stopPropagation(); azioneNota(azione); } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sel) { e.preventDefault(); e.stopPropagation(); selezionaVicino(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); suona(); } else if (e.key === 'Escape' && sel) { sel = null; disegnaRoll(); disegnaNota(); disegnaTastoSuona(); }
    };
    disegnaEditor();
  }

  // ---------- azioni dell'editor ----------
  async function nuovo() {
    if (!quadro) return;
    const g0 = quadro.generi.find((g) => g.nome === doc.categoria && !g.vocale) || quadro.generi.find((g) => !g.vocale);
    finestra.innerHTML = `<form method="dialog"><h2 id="fTitolo">Componi un nuovo score</h2>
      <label>Genere<select class="field" name="categoria">${opzioniGeneri(g0.nome)}</select></label>
      <label>Velocità (bpm)<input class="field" type="number" name="bpm" min="30" max="220" required></label>
      <label>Tonalità<select class="field" name="tonalita"></select></label>
      <label>Durata in secondi<input class="field" type="number" name="durata" min="${A.SECONDI_MANUALE[0]}" max="${A.SECONDI_MANUALE[1]}" value="180" required></label>
      <label>Forma<select class="field" name="forma"><option value="intro verse chorus verse chorus outro">Strofa e ritornello</option><option value="intro verse chorus verse bridge chorus outro">Con ponte</option><option value="intro verse pre-chorus chorus verse pre-chorus chorus bridge chorus outro">Estesa</option><option value="intro verse verse bridge verse outro">Distesa, senza ritornello</option></select></label>
      <div class="f-tasti"><button class="btn ghost" value="" formnovalidate>Annulla</button><button class="btn" value="ok">Componi</button></div></form>`;
    const f = finestra.querySelector('form'), c = f.elements;
    const perGenere = () => { const g = quadro.generi.find((x) => x.nome === c.categoria.value); c.bpm.value = Math.round((g.bpm[0] + g.bpm[1]) / 2); c.tonalita.innerHTML = (g.tonalita.length ? g.tonalita : ['La minore']).map((t) => `<option>${esc(t)}</option>`).join(''); };
    c.categoria.onchange = perGenere; perGenere();
    f.onsubmit = async (e) => {
      if (!e.submitter || e.submitter.value !== 'ok') return;
      const richiesta = { categoria: c.categoria.value, bpm: Number(c.bpm.value), tonalita: c.tonalita.value, durata_s: Number(c.durata.value), sezioni: c.forma.value.split(' ') };
      try {
        const r = await invia('/api/score/componi', richiesta);
        toast(`Score composto: il revisore gli dà ${n0(r.punteggio)} su 100`);
        await carica({ testo: r.abc, nome: 'Nuovo ' + nm(richiesta.categoria), categoria: richiesta.categoria, salvato: '' });
      } catch (x) { toast(x.message, 'err'); }
    };
    finestra.onclose = null;
    finestra.showModal();
  }
  async function salvaBozza() {
    if (!doc.testo.trim()) return toast('Non c\'è nulla da salvare', 'err');
    try {
      const r = await invia('/api/score/salva', { id: doc.bozza, nome: doc.nome || 'Score senza nome', categoria: doc.categoria || null, abc: doc.testo });
      doc.bozza = r.id; doc.salvato = doc.testo; ricorda(); disegnaEditor();
      toast('Bozza salvata');
      leggiQuadro();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function produci() {
    await leggiQuadro();
    if (!quadro || !analisi || !analisi.score) return;
    finestra.innerHTML = `<form method="dialog"><h2 id="fTitolo">Usa lo score in produzione</h2>
      <label>Genere del brano<select class="field" name="categoria" required><option value="">Scegli il genere</option>${opzioniGeneri(doc.categoria)}</select></label>
      <label>Per quale brano<select class="field" name="titolo"></select></label>
      <p class="muted">Velocità, tonalità, durata e sezioni del brano vengono dallo score. Titolo, strumenti e stile restano quelli scelti dal sistema. Vale una sola volta.</p>
      <div class="f-tasti"><button class="btn ghost" value="" formnovalidate>Annulla</button><button class="btn" value="ok">Mettilo in produzione</button></div></form>`;
    const f = finestra.querySelector('form'), c = f.elements;
    const brani = () => {
      const attesa = quadro.inArrivo.filter((x) => x.dove === 'coda' && x.categoria === c.categoria.value);
      c.titolo.innerHTML = '<option value="">Il prossimo brano nuovo di questo genere</option>' + attesa.map((x) => `<option value="${esc(x.titolo)}">«${esc(x.titolo)}», già in coda</option>`).join('');
      if (doc.per && attesa.some((x) => x.titolo === doc.per)) c.titolo.value = doc.per;
    };
    c.categoria.onchange = brani; brani();
    f.onsubmit = async (e) => {
      if (!e.submitter || e.submitter.value !== 'ok') return;
      try {
        await invia('/api/score/produci', { categoria: c.categoria.value, titolo: c.titolo.value || null, nome: doc.nome || doc.brano || 'Score senza nome', abc: doc.testo });
        doc.categoria = c.categoria.value; doc.salvato = doc.testo; ricorda();
        toast('Score messo in produzione');
        app.vai('score/produzione');
      } catch (x) { toast(x.message, 'err'); }
    };
    finestra.onclose = null;
    finestra.showModal();
  }
  function scarica() {
    if (!doc.testo.trim()) return toast('Non c\'è nulla da scaricare', 'err');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([doc.testo], { type: 'text/plain' }));
    a.download = (doc.nome || doc.brano || 'score').replace(/[\\/:*?"<>|]+/g, '-') + '.abc';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- archivio ----------
  function disegnaArchivio() {
    if (vista !== 'archivio') return;
    if (!archivio || !quadro) return imposta(radice, '<div class="empty">Caricamento…</div>');
    if (!$('#scTabella')) {
      delete radice.dataset.firma;
      radice.innerHTML = `<div id="scRiepilogo"></div>
        <div class="toolbar"><input class="search" id="scQ" type="search" placeholder="Cerca per titolo o genere" aria-label="Cerca uno score" value="${esc(filtro.q)}">
          <select class="field" id="scFonte" aria-label="Chi ha scritto lo score"><option value="">Tutte le fonti</option>${Object.entries(FONTI).map(([k, v]) => `<option value="${k}"${filtro.fonte === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <span class="conteggio" id="scConta"></span></div>
        <div class="card piatta"><div class="scroll" id="scTabella"></div></div>
        <div class="sotto-tabella"><button type="button" class="btn small ghost" data-sc="altri">Mostra altri 40</button></div>
        <div class="grid sc-sotto"><div class="card c6"><h2>Bozze dell'editor</h2><div id="scBozze"></div></div>
          <div class="card c6"><h2>Score rifiutati dal controllo <small>gli ultimi 30, recuperabili a mano</small></h2><div id="scRifiutati"></div></div></div>`;
      $('#scQ').oninput = (e) => { filtro.q = e.target.value; filtro.quanti = 40; disegnaArchivio(); };
      $('#scFonte').onchange = (e) => { filtro.fonte = e.target.value; filtro.quanti = 40; disegnaArchivio(); };
    }
    const media = (v) => (v.length ? v.reduce((a, x) => a + x, 0) / v.length : null);
    const gruppi = Object.keys(FONTI).map((k) => {
      const l = archivio.filter((b) => b.fonte === k && b.valido);
      const voti = l.map((b) => b.voto).filter((v) => v !== null);
      return { k, n: l.length, voto: media(voti), voti: voti.length, rip: media(l.map((b) => b.ripetizione)), rec: l.filter((b) => b.riparato).length };
    }).filter((g) => g.n);
    imposta('#scRiepilogo', `<div class="card sc-riepilogo"><table><thead><tr><th>Chi ha scritto</th><th class="num">Brani</th><th class="num">Voto medio</th><th class="num">Battute ripetute</th><th class="num">Recuperati</th></tr></thead><tbody>${
      gruppi.map((g) => `<tr><td>${esc(fonte(g.k))}</td><td class="num">${g.n}</td><td class="num">${g.voto === null ? '—' : g.voto.toFixed(1).replace('.', ',') + ` <small class="muted">su ${g.voti}</small>`}</td><td class="num">${perc(g.rip)}</td><td class="num">${g.rec || '—'}</td></tr>`).join('')}</tbody></table></div>`);
    const q = filtro.q.trim().toLowerCase();
    const lista = archivio.filter((b) => (!filtro.fonte || b.fonte === filtro.fonte) && (!q || (b.titolo + ' ' + nm(b.categoria)).toLowerCase().includes(q)));
    $('#scConta').textContent = `${n0(lista.length)} di ${n0(archivio.length)} score`;
    radice.querySelector('[data-sc="altri"]').hidden = lista.length <= filtro.quanti;
    imposta('#scTabella', `<table class="libreria"><thead><tr><th>Titolo</th><th>Genere</th><th>Chi ha scritto</th><th class="num">Durata</th><th class="num extra">Battute</th><th class="num extra">Sezioni</th><th class="num extra">Ripetute</th><th class="extra">Voto</th><th><span class="solo-lettore">Azioni</span></th></tr></thead><tbody>${
      lista.slice(0, filtro.quanti).map((b) => `<tr><td class="nome">${b.numero === null ? esc(b.titolo) : `<button type="button" class="titolo-brano" data-info="${b.numero}">${esc(b.titolo)}</button>`}${b.scartato ? '<small>brano scartato</small>' : ''}</td><td>${esc(nm(b.categoria))}</td>
        <td>${esc(fonte(b.fonte))}${b.riparato ? ' <span class="tag">recuperato</span>' : ''}</td>${b.valido ? `<td class="num">${durata(b.secondi)}</td><td class="num extra">${b.battute}</td><td class="num extra">${b.sezioni}</td><td class="num extra">${perc(b.ripetizione)}</td>` : `<td class="num err" data-tip="${esc(b.errore)}">non leggibile</td><td class="extra"></td><td class="extra"></td><td class="extra"></td>`}
        <td class="extra">${app.stelle(b.voto)}</td><td class="azioni-riga">${b.numero === null ? '' : `<button type="button" class="btn small ghost" data-score="${b.numero}">Apri</button>`}</td></tr>`).join('')
      || '<tr><td colspan="9" class="empty">Nessuno score corrisponde.</td></tr>'}</tbody></table>`);
    imposta('#scBozze', quadro.bozze.map((b) => `<div class="srv"><div><b>${esc(b.nome)}</b><small class="muted">${esc(b.categoria ? nm(b.categoria) : 'senza genere')}, ${data(b.modificata)}</small></div><span class="sc-tasti"><button type="button" class="btn small ghost" data-bozza="${b.id}">Apri</button><button type="button" class="tasto-riga" data-elimina="${b.id}" aria-label="Elimina la bozza ${esc(b.nome)}">${ic('x')}</button></span></div>`).join('') || '<div class="empty">Nessuna bozza: si creano con «Salva bozza» nell\'editor.</div>');
    imposta('#scRifiutati', quadro.scartati.map((s) => `<div class="srv"><div><b>${esc(s.titolo)}</b><small class="muted">${data(s.il)}, ${esc(s.motivo)}</small></div><button type="button" class="btn small ghost" data-rifiutato="${s.id}">Apri</button></div>`).join('') || '<div class="empty">Nessuno score rifiutato da quando vengono conservati.</div>');
  }

  // ---------- brani da produrre ----------
  const DOVE = { spartito: 'Il modello sta scrivendo lo score', render: 'In creazione', coda: 'In coda' };
  function disegnaProduzione() {
    if (vista !== 'produzione') return;
    if (!quadro) return imposta(radice, '<div class="empty">Caricamento…</div>');
    const chi = (c) => {
      if (c.fonte) return c.fonte === 'modello' && c.dove === 'spartito' ? 'Il modello lo sta scrivendo' : 'Score: ' + fonte(c.fonte);
      if (c.manuale) return 'Score scelto a mano';
      if (c.vocale) return 'Genere con voci: lo scrive il motore';
      const g = quadro.impostazioni.generi[c.categoria] || {}, f = g.fonte || quadro.impostazioni.generale.fonte || 'modello';
      return f === 'modello' ? 'Lo scriverà il modello; il compositore è pronto di riserva' : f === 'compositore' ? 'Userà lo score del compositore' : 'Lo scriverà il motore durante il render';
    };
    imposta(radice, `<div class="grid">
      <div class="card c6"><h2>Brani in arrivo</h2>${quadro.inArrivo.map((c, i) => `<div class="sc-brano"><div><b>${esc(c.titolo)}</b><small class="muted">${esc(nm(c.categoria))}, ${c.bpm || '—'} bpm, ${c.durata_s ? durata(c.durata_s) : '—'}</small><small>${DOVE[c.dove]}. ${esc(chi(c))}.</small></div>
        <span class="sc-tasti">${c.abc ? `<button type="button" class="btn small ghost" data-arrivo="${i}">${c.dove === 'coda' ? 'Apri e modifica' : 'Apri'}</button>` : ''}</span></div>`).join('') || '<div class="empty">Nessun brano in lavorazione o in coda.</div>'}
        <p class="muted">Le modifiche a un brano in coda valgono se arrivano prima che parta: la produzione controlla ogni minuto.</p></div>
      <div class="card c6"><h2>Score scelti da te</h2>${quadro.richieste.map((r) => `<div class="sc-brano"><div><b>${esc(r.nome)}</b><small class="muted">${esc(nm(r.categoria))}, ${r.bpm} bpm, ${durata(r.secondi)}${r.titolo ? ', per «' + esc(r.titolo) + '»' : ''}</small>
        <small>${r.usata ? (r.usata.errore ? `Non usato per «${esc(r.usata.titolo)}»: ${esc(r.usata.errore)}` : `Usato per «${esc(r.usata.titolo)}» il ${data(r.usata.at)}`) : r.titolo ? 'In attesa di quel brano' : 'In attesa: il sistema produrrà questo genere appena libera la coda'}</small></div>
        <span class="sc-tasti"><button type="button" class="btn small ghost" data-richiesta="${r.id}">Apri</button>${r.usata ? (r.usata.errore ? '<span class="pill ko">non usato</span>' : '<span class="pill ok">usato</span>') : `<button type="button" class="btn small ghost" data-annulla="${r.id}">Annulla</button>`}</span></div>`).join('') || '<div class="empty">Nessuno. Apri uno score nell\'editor e premi «Usa in produzione».</div>'}
        <p><button type="button" class="btn small" data-sc="nuovo">Componi un nuovo score</button></p></div></div>`);
  }

  // ---------- impostazioni ----------
  let ambito = 'generale';
  const testoValore = (d, v) => (d.scelte ? (d.scelte.find((x) => x[0] === v) || [])[1] : d.si ? (v ? 'sì' : 'no') : String(v).replace('.', ','));
  function disegnaRegole(forza) {
    if (vista !== 'regole') return;
    if (!quadro) return imposta(radice, '<div class="empty">Caricamento…</div>');
    if ($('#scAmbito') && !forza) return; // non si ridisegna sotto le mani di chi scrive
    delete radice.dataset.firma;
    const miei = ambito === 'generale' ? quadro.impostazioni.generale : quadro.impostazioni.generi[ambito] || {};
    const ereditato = (d) => A.impostazioni(ambito === 'generale' ? {} : { generale: quadro.impostazioni.generale }, ambito)[d.chiave];
    const gruppi = {};
    for (const d of quadro.definizioni) (gruppi[d.gruppo] = gruppi[d.gruppo] || []).push(d);
    const controllo = (d) => {
      const v = miei[d.chiave], base = `${ambito === 'generale' ? 'Predefinito' : 'Come generale'}: ${testoValore(d, ereditato(d))}`;
      if (d.scelte || d.si) {
        const voci = d.scelte || [[true, 'sì'], [false, 'no']];
        return `<select class="field" data-k="${d.chiave}" aria-label="${esc(d.etichetta)}"><option value="">${esc(base)}</option>${voci.map(([x, t]) => `<option value="${x}"${v === x ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      }
      return `<input class="field" type="number" data-k="${d.chiave}" min="${d.min}" max="${d.max}" step="${d.passo}" value="${v ?? ''}" placeholder="${esc(base)}" aria-label="${esc(d.etichetta)}">`;
    };
    const conModifiche = Object.keys(quadro.impostazioni.generi);
    radice.innerHTML = `
      <div class="toolbar"><label class="sc-campo">Vale per <select class="field" id="scAmbito"><option value="generale">Tutti i generi</option>${quadro.generi.filter((g) => !g.vocale).map((g) => `<option value="${esc(g.nome)}"${ambito === g.nome ? ' selected' : ''}>${esc(g.etichetta)}${conModifiche.includes(g.nome) ? ' (personalizzato)' : ''}</option>`).join('')}</select></label>
        <span class="muted">Un campo vuoto eredita il valore indicato. Le modifiche valgono dai prossimi brani.</span></div>
      <div class="card sc-flusso"><h2>Come nasce lo score di un brano nuovo</h2><ol>
        <li><b>Score scelto da te</b>, se c'è: ha la precedenza su tutto.</li>
        <li><b>Modello YuE2</b>: scrive lo score; il sistema lo controlla, passa la melodia agli strumenti e, se è troncato o troppo lungo, lo recupera.</li>
        <li><b>Compositore del progetto</b>: pronto di riserva quando il modello non riesce.</li>
        <li><b>Motore durante il render</b>: ultima risorsa, e unica strada per i generi con voci.</li></ol></div>
      ${Object.entries(gruppi).map(([nome, lista]) => `<div class="card cgroup"><h3>${esc(nome)}</h3>${lista.map((d) => `<div class="prow"><div><div class="nm">${esc(d.etichetta)}${d.chiave in miei ? '<span class="badge">modificato</span>' : ''}</div><div class="ds">${esc(d.descrizione)}${d.min !== undefined ? ` Da ${String(d.min).replace('.', ',')} a ${String(d.max).replace('.', ',')}.` : ''}</div></div><div class="ctl">${controllo(d)}</div><div></div></div>`).join('')}</div>`).join('')}
      <div class="sc-salva"><button type="button" class="btn" data-sc="regole" disabled>Salva</button><button type="button" class="btn ghost" data-sc="predefiniti" ${Object.keys(miei).length ? '' : 'disabled'}>Torna ${ambito === 'generale' ? 'ai predefiniti' : 'al generale'}</button></div>`;
    $('#scAmbito').onchange = (e) => { ambito = e.target.value; disegnaRegole(true); };
    radice.querySelectorAll('[data-k]').forEach((c) => { c.dataset.prima = c.value; c.oninput = c.onchange = () => { radice.querySelector('[data-sc="regole"]').disabled = ![...radice.querySelectorAll('[data-k]')].some((x) => x.value !== x.dataset.prima); }; });
  }
  async function salvaRegole(tutte) {
    const valori = {};
    for (const c of radice.querySelectorAll('[data-k]')) {
      const d = quadro.definizioni.find((x) => x.chiave === c.dataset.k);
      if (tutte) valori[d.chiave] = null;
      else if (c.validity.badInput) return toast(`${d.etichetta}: scrivi un numero`, 'err');
      else if (c.value !== c.dataset.prima) valori[d.chiave] = c.value === '' ? null : d.si ? c.value === 'true' : d.scelte ? c.value : Number(c.value);
    }
    try {
      await invia('/api/score/impostazioni', { ambito, valori });
      toast('Impostazioni salvate');
      await leggiQuadro();
      disegnaRegole(true);
    } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- caricamento e comandi ----------
  async function leggiQuadro() {
    try { quadro = await leggi('/api/score'); }
    catch (e) { toast('Impossibile leggere gli score: ' + e.message, 'err'); }
  }
  function ridisegna() { disegnaArchivio(); disegnaProduzione(); disegnaRegole(); }
  async function aggiorna() {
    await leggiQuadro();
    if (vista === 'archivio') { try { archivio = await leggi('/api/score/brani'); } catch (e) { toast('Impossibile leggere l\'archivio: ' + e.message, 'err'); } }
    ridisegna();
    if (vista === 'editor' && $('#scGenere') && !$('#scGenere').options[1]) editor();
  }
  async function apriBrano(n) {
    try { const b = await leggi('/api/score/brano?n=' + n); carica({ testo: b.abc.replace(/\r\n/g, '\n'), nome: b.titolo, categoria: b.categoria || '', brano: b.titolo }); }
    catch (e) { toast('Questo brano non ha uno score salvato', 'err'); }
  }
  radice.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.n) return azioneNota(d.n);
    if (d.t) return modifica((s) => A.trasponi(s, Number(d.t)));
    if (d.sez) {
      const i = Number(d.i);
      if (d.sez === 'vai') { ferma(); sel = { s: i, b: 0, voce: 'ins', i: 0 }; if (!evento()) sel = null; disegnaEditor(); const g = geometria.battute.find((x) => x.s === i); if (g) $('#scRoll').scrollLeft = g.x; return suona(); }
      sel = null;
      return modifica((s) => {
        const x = s.sezioni;
        if (d.sez === 'su' || d.sez === 'giu') x.splice(i + (d.sez === 'su' ? -1 : 1), 0, ...x.splice(i, 1));
        if (d.sez === 'doppia') x.splice(i + 1, 0, JSON.parse(JSON.stringify(x[i])));
        if (d.sez === 'via') x.splice(i, 1);
      });
    }
    if (d.bozza) { const x = quadro.bozze.find((y) => y.id === d.bozza); return x && carica({ testo: x.abc, nome: x.nome, categoria: x.categoria || '', bozza: x.id }); }
    if (d.rifiutato) { try { const x = await leggi('/api/score/scartato?id=' + d.rifiutato); carica({ testo: x.abc.replace(/\r\n/g, '\n'), nome: x.titolo + ' (rifiutato)', categoria: x.categoria }); } catch (err) { toast('Score non più disponibile', 'err'); } return; }
    if (d.elimina) {
      const x = quadro.bozze.find((y) => y.id === d.elimina);
      if (x && await chiedi('Eliminare la bozza?', `«${x.nome}» verrà eliminata.`, 'Elimina')) {
        try { await invia('/api/score/elimina', { id: x.id }); if (doc.bozza === x.id) { doc.bozza = null; doc.salvato = ''; ricorda(); } toast('Bozza eliminata'); } catch (err) { toast(err.message, 'err'); }
        aggiorna();
      }
      return;
    }
    if (d.arrivo !== undefined) { const c = quadro.inArrivo[Number(d.arrivo)]; return c && carica({ testo: c.abc, nome: c.titolo, categoria: c.categoria, per: c.dove === 'coda' ? c.titolo : '' }); }
    if (d.richiesta) { const r = quadro.richieste.find((y) => y.id === d.richiesta); return r && carica({ testo: r.abc, nome: r.nome, categoria: r.categoria }); }
    if (d.annulla) { try { await invia('/api/score/annulla', { id: d.annulla }); toast('Richiesta annullata'); } catch (err) { toast(err.message, 'err'); } return aggiorna(); }
    const azioni = {
      suona, nuovo, produci, scarica, salva: salvaBozza,
      annulla: () => storia(doc.annulla, doc.ripeti), ripeti: () => storia(doc.ripeti, doc.annulla),
      strumentale: () => { try { cambiaTesto(A.strumentale(doc.testo).abc); } catch (err) { toast(err.message, 'err'); } },
      ripara: () => { const r = A.ripara(doc.testo, {}); if (!r) return toast('Non c\'è una parte iniziale valida da recuperare', 'err'); cambiaTesto(r.abc); toast(`Recuperati ${durata(r.secondi)} di musica`); },
      altri: () => { filtro.quanti += 40; disegnaArchivio(); },
      regole: () => salvaRegole(false),
      predefiniti: async () => { if (await chiedi('Togliere le personalizzazioni?', 'I valori di questa pagina tornano ereditati.', 'Togli')) salvaRegole(true); },
    };
    if (azioni[d.sc]) return azioni[d.sc]();
  });
  radice.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-nome]');
    if (s) modifica((score) => { score.sezioni[Number(s.dataset.nome)].nome = s.value; });
  });
  radice.addEventListener('keydown', (e) => {
    if (vista !== 'editor' || !(e.ctrlKey || e.metaKey) || e.target.closest('textarea, input')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); storia(doc.annulla, doc.ripeti); }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); storia(doc.ripeti, doc.annulla); }
    if (k === 's') { e.preventDefault(); salvaBozza(); }
  });
  window.addEventListener('beforeunload', ferma);
  setInterval(() => { if ($('#t-score').classList.contains('on') && vista === 'produzione' && !finestra.open) aggiorna(); }, 15000);
  esamina();

  return {
    apriBrano,
    ferma,
    pagina(sotto) {
      vista = ['editor', 'produzione', 'regole'].includes(sotto) ? sotto : 'archivio';
      ferma();
      document.querySelectorAll('#scSub button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === vista)));
      delete radice.dataset.firma;
      radice.innerHTML = '';
      if (vista === 'editor') editor(); else ridisegna();
      aggiorna();
    },
  };
};
