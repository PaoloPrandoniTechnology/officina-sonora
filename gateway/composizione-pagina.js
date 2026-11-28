// Pagina Composizione: consulta, modifica e crea accordi, motivi, chiusure, frasi d'assolo, richiami e forme.
// I controlli li fa il gateway con lo stesso codice della produzione.
window.PaginaComposizione = function (app) {
  'use strict';
  const { $, esc, imposta, toast, chiedi, invia, leggi } = app;
  const radice = $('#cmPagina');
  const finestra = $('#finestra');

  const SCHEDE = {
    armonia: { nome: 'Accordi', nuova: 'Nuovo giro di accordi', aiuto: 'Gradi romani riferiti alla tonica: maiuscolo = maggiore, minuscolo = minore; b e # abbassano o alzano; dopo la barra c’è il basso. Per cambiare un giro premi Modifica e scegli gli accordi coi pulsanti. Strofa, ritornello e ponte durano 8 battute, il pre-ritornello 4.' },
    motivo: { nome: 'Motivi', nuova: 'Nuovo motivo', aiuto: 'Il ritmo di un tema, due battute separate da |. Numeri = durata in trentaduesimi (4 = ottavo, 8 = quarto, 16 = metà); ogni battuta somma a 32. -8 = pausa, v8 = appoggiatura, ~ sull’ultima nota = anticipo legato alla battuta dopo. Le altezze le sceglie il compositore sugli accordi.' },
    cadenza: { nome: 'Chiusure', nuova: 'Nuova chiusura', aiuto: 'Il ritmo con cui si chiude una frase: stessa scrittura dei motivi. Meglio note lunghe e un respiro in fondo.' },
    assolo: { nome: 'Assoli', nuova: 'Nuova frase d’assolo', aiuto: 'Una battuta: il ritmo (somma 32) e una lettera per ogni figura. x = nota d’arrivo o pausa, p = passaggio, n = nota di volta, a = arpeggio, s = salto, c = cromatica d’approccio, r = ribattuta.' },
    richiamo: { nome: 'Richiami', nuova: 'Nuovo richiamo', aiuto: 'Un tema da citare in 1-8 battute, scritto in Do (maggiore o minore): Sol4:8 è un Sol centrale di un quarto, -:8 una pausa. Ogni battuta somma a 32 e ha il suo grado negli accordi. Usa solo musica di pubblico dominio: i brani vengono pubblicati.' },
    forma: { nome: 'Forme', nuova: 'Nuova forma', aiuto: 'Sezioni nell’ordine di ascolto, ognuna ruolo:battute:priorità. Ruoli: gancio, strofa, pre, rit, solo, ponte, finale. Priorità 0 = sempre presente; le altre entrano in ordine (1 prima) se la durata lo permette. L’ultima è finale:4:0.' },
  };
  let dati = null;
  let scheda = 'armonia';
  const filtro = { stile: '', modo: '', ruolo: '', andamento: '', q: '', solo: '', quanti: 40 };
  let suono = null;

  const A = window.ScoreAbc;
  function ferma() {
    if (!suono) return;
    clearTimeout(suono.fine);
    suono.ctx.close();
    if (suono.tasto.isConnected) suono.tasto.textContent = 'Ascolta';
    suono = null;
  }
  // sintetizzatore minimo: melodia, accordi e basso, per giudicare note e ritmo (non il suono finale)
  function suona(abc, tasto) {
    const score = A.leggiAbc(abc).score;
    if (!score) return toast('Non riesco a leggere la prova', 'err');
    app.pausaLettore();
    const ctx = new AudioContext();
    const unita = 60 / score.bpm / 8;
    const nota = (midi, da, durata, forma, volume) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), a = da + durata;
      o.type = forma; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      g.gain.setValueAtTime(0, da);
      g.gain.linearRampToValueAtTime(volume, da + 0.015);
      g.gain.setValueAtTime(volume * 0.8, Math.max(da + 0.016, a - 0.05));
      g.gain.linearRampToValueAtTime(0, a);
      o.connect(g).connect(ctx.destination); o.start(da); o.stop(a + 0.02);
    };
    let t = ctx.currentTime + 0.1;
    let legata = null;
    const melodia = [];
    for (const s of score.sezioni) {
      for (const b of s.battute) {
        let pos = 0;
        for (const e of b.ins || []) {
          if (e.midi !== null) {
            if (legata && legata.midi === e.midi) legata.durata += e.durata * unita;
            else melodia.push((legata = { midi: e.midi, da: t + pos * unita, durata: e.durata * unita }));
            if (!e.lega) legata = null;
          }
          pos += e.durata;
        }
        (b.accordi || []).forEach((a, i) => {
          const c = A.noteAccordo(a.sigla);
          const fine = i + 1 < b.accordi.length ? b.accordi[i + 1].pos : 32;
          const da = t + a.pos * unita, durata = (fine - a.pos) * unita;
          nota(36 + c.basso, da, durata, 'triangle', 0.11);
          for (const n of c.note) nota(48 + n, da, durata, 'sine', 0.05);
        });
        t += 32 * unita;
      }
    }
    for (const n of melodia) nota(n.midi, n.da, n.durata, 'triangle', 0.22);
    tasto.textContent = 'Ferma';
    suono = { ctx, tasto, fine: setTimeout(ferma, (t - ctx.currentTime + 0.3) * 1000) };
  }
  async function ascolta(voce, tasto) {
    const era = suono && suono.tasto === tasto;
    ferma();
    if (era) return;
    try { const r = await invia('/api/composizione/prova', voce); suona(r.abc, tasto); if (r.genere) toast('Prova con il genere ' + r.genere); }
    catch (e) { toast(e.message, 'err'); }
  }

  const stileNome = (id) => (dati.stili.find((s) => s.id === id) || {}).nome || id;
  const titolo = (v) => v.nome || (v.tipo === 'armonia' ? `${stileNome(v.stile)}, ${v.modo === 'm' ? 'minore' : 'maggiore'}, ${dati.ruoli[v.ruolo]}` : v.tipo === 'motivo' ? dati.andamenti[v.andamento] : v.tipo === 'cadenza' ? 'Chiusura di frase' : 'Frase d’assolo');
  const corpo = (v) => (v.tipo === 'assolo' ? `${v.ritmo}\n${v.gesti.split('').join(' ')}` : v.tipo === 'richiamo' ? `${v.accordi}\n${v.note.split(' | ').join('\n')}` : v.testo);

  function filtrate() {
    const q = filtro.q.trim().toLowerCase();
    return dati.voci.filter((v) => v.tipo === scheda
      && (!filtro.stile || (v.stile ? v.stile === filtro.stile : v.stili ? v.stili.includes(filtro.stile) : true))
      && (scheda !== 'armonia' || ((!filtro.modo || v.modo === filtro.modo) && (!filtro.ruolo || v.ruolo === filtro.ruolo)))
      && (scheda !== 'motivo' || !filtro.andamento || v.andamento === filtro.andamento)
      && (!filtro.solo || (filtro.solo === 'tue' ? !v.serie : filtro.solo === 'modificate' ? v.modificata : !v.attivo))
      && (!q || [titolo(v), corpo(v)].join(' ').toLowerCase().includes(q)));
  }

  function disegnaElenco() {
    const lista = filtrate();
    const tutte = dati.voci.filter((v) => v.tipo === scheda);
    $('#cmConta').textContent = `${lista.length} di ${tutte.length} · ${tutte.filter((v) => v.attivo && !v.errore).length} in uso`;
    imposta($('#cmElenco'), lista.slice(0, filtro.quanti).map((v) => `<article class="card cm-voce${v.attivo ? '' : ' spenta'}">
      <h3>${esc(titolo(v))}${v.serie ? (v.modificata ? '<span class="badge">modificata</span>' : '') : '<span class="badge">tua</span>'}${v.attivo ? '' : '<span class="badge">spenta</span>'}</h3>
      ${v.stili ? `<p class="muted">${v.stili.map(stileNome).map(esc).join(', ')}</p>` : ''}
      <pre>${esc(corpo(v))}</pre>
      ${v.errore ? `<p class="err">Non usata: ${esc(v.errore)}</p>` : ''}
      <div class="cm-tasti">
        <button type="button" class="btn small" data-cm="ascolta" data-id="${esc(v.id)}">Ascolta</button>
        <button type="button" class="btn small ghost" data-cm="modifica" data-id="${esc(v.id)}">Modifica</button>
        <button type="button" class="btn small ghost" data-cm="duplica" data-id="${esc(v.id)}">Duplica</button>
        <button type="button" class="btn small ghost" data-cm="attiva" data-id="${esc(v.id)}">${v.attivo ? 'Spegni' : 'Accendi'}</button>
        ${v.serie && v.modificata ? `<button type="button" class="btn small ghost" data-cm="ripristina" data-id="${esc(v.id)}">Ripristina</button>` : ''}
        ${v.serie ? '' : `<button type="button" class="btn small danger" data-cm="elimina" data-id="${esc(v.id)}">Elimina</button>`}
      </div></article>`).join('') || '<div class="empty">Nessuna voce con questi filtri</div>');
    $('#cmAltri').hidden = lista.length <= filtro.quanti;
  }

  const opzioni = (voci, scelta, tutti) => (tutti ? `<option value="">${tutti}</option>` : '') + voci.map(([k, n]) => `<option value="${esc(k)}"${k === scelta ? ' selected' : ''}>${esc(n)}</option>`).join('');
  const MODI = [['m', 'Minore'], ['M', 'Maggiore']];

  function disegna() {
    if (!dati) return;
    const s = SCHEDE[scheda];
    const stili = dati.stili.map((x) => [x.id, x.nome]);
    const usati = dati.stili.find((x) => x.id === filtro.stile);
    const perStile = ['armonia', 'richiamo', 'forma'].includes(scheda);
    radice.innerHTML = `<div class="card cm-aiuto"><h2>${s.nome} <small id="cmConta"></small></h2><p class="muted">${esc(s.aiuto)}</p>
        ${perStile && usati ? `<p class="muted">Generi che usano ${esc(usati.nome)}: ${usati.generi.map((g) => esc(g.etichetta)).join(', ') || 'nessuno'}.</p>` : ''}</div>
      <div class="toolbar">
        ${perStile ? `<select class="field" data-f="stile" aria-label="Stile">${opzioni(stili, filtro.stile, 'Tutti gli stili')}</select>` : ''}
        ${scheda === 'armonia' ? `<select class="field" data-f="modo" aria-label="Modo">${opzioni(MODI, filtro.modo, 'Maggiore e minore')}</select><select class="field" data-f="ruolo" aria-label="Parte del brano">${opzioni(Object.entries(dati.ruoli), filtro.ruolo, 'Tutte le parti')}</select>` : ''}
        ${scheda === 'motivo' ? `<select class="field" data-f="andamento" aria-label="Andamento">${opzioni(Object.entries(dati.andamenti), filtro.andamento, 'Tutti gli andamenti')}</select>` : ''}
        <select class="field" data-f="solo" aria-label="Quali voci">${opzioni([['tue', 'Solo le tue'], ['modificate', 'Solo modificate'], ['spente', 'Solo spente']], filtro.solo, 'Tutte le voci')}</select>
        <input class="search" type="search" data-f="q" placeholder="Cerca, per esempio bVII" aria-label="Cerca" value="${esc(filtro.q)}">
        <button type="button" class="btn" data-cm="nuova">${s.nuova}</button>
      </div>
      <div class="cm-elenco" id="cmElenco"></div>
      <div class="sotto-tabella"><button type="button" class="btn small ghost" data-cm="altri" id="cmAltri">Mostra altre 40</button></div>`;
    disegnaElenco();
  }

  async function aggiorna() {
    try { dati = await leggi('/api/composizione'); disegna(); }
    catch (e) { toast('Impossibile leggere il materiale: ' + e.message, 'err'); }
  }

  // ---------- accordi a pulsanti: si sceglie, non si scrive (niente errori di sintassi) ----------
  const GRADI_ROM = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']; // per semitono
  const SEMI = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
  // [chiave, etichetta, grado minuscolo, suffisso scritto, sigla nell'anteprima]
  const TIPI = [['M', 'maggiore', false, '', ''], ['m', 'minore', true, '', 'm'], ['7', '7', false, '7', '7'], ['maj7', 'maj7', false, 'maj7', 'maj7'], ['m7', 'm7', true, '7', 'm7'], ['6', '6', false, '6', '6'], ['m6', 'm6', true, '6', 'm6'],
    ['sus2', 'sus2', false, 'sus2', 'sus2'], ['sus4', 'sus4', false, 'sus4', 'sus4'], ['7sus4', '7sus4', false, '7sus4', '7sus4'], ['dim', 'dim', true, 'dim', 'dim'], ['dim7', 'dim7', true, 'dim7', 'dim7'], ['ø', 'semidim. ø', true, 'ø', 'm7♭5'], ['aug', 'aumentato', false, 'aug', '+']];
  const NOTE_IT = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  const semitono = (alt, numero) => (SEMI[numero.toLowerCase()] + (alt === 'b' ? 11 : alt === '#' ? 1 : 0)) % 12;
  // "bVII7/II" -> { semi, tipo, basso }
  function smonta(testo) {
    const m = /^([b#]?)([ivIV]+)(maj7|7sus4|sus4|sus2|dim7|dim|aug|ø|7|6)?(?:\/([b#]?)([IV]+))?$/.exec(testo);
    if (!m || SEMI[m[2].toLowerCase()] === undefined) return { semi: 0, tipo: 'M', basso: null };
    const minore = m[2] === m[2].toLowerCase(), s = m[3] || '';
    const tipo = s === '' ? (minore ? 'm' : 'M') : s === '7' ? (minore ? 'm7' : '7') : s === '6' ? (minore ? 'm6' : '6') : s;
    return { semi: semitono(m[1], m[2]), tipo, basso: m[5] ? semitono(m[4], m[5]) : null };
  }
  function monta({ semi, tipo, basso }) {
    const [, , minuscolo, suffisso] = TIPI.find((t) => t[0] === tipo);
    const g = GRADI_ROM[semi];
    return (minuscolo ? g.toLowerCase() : g) + suffisso + (basso === null ? '' : '/' + GRADI_ROM[basso]);
  }
  // riquadro: le battute in alto, la tavolozza sotto. quante() = battute fisse, oppure null se si aggiungono a mano
  function giroAccordi(box, campo, { quante, modo }) {
    let battute = campo.value.split('|').map((b) => b.trim().split(/\s+/).filter(Boolean)).filter((b) => b.length);
    if (!battute.length) battute = [[modo() === 'm' ? 'i' : 'I']];
    let sel = [0, 0];
    const nomeDi = (c) => { const t = modo() === 'm' ? 9 : 0, p = TIPI.find((x) => x[0] === c.tipo); return NOTE_IT[(t + c.semi) % 12] + p[4] + (c.basso === null ? '' : '/' + NOTE_IT[(t + c.basso) % 12]); };
    function disegnaGiro(fuoco) {
      const n = quante();
      if (n) battute = Array.from({ length: n }, (_, i) => battute[i] || [...battute[i % battute.length]]);
      sel = [Math.min(sel[0], battute.length - 1), 0 + Math.min(sel[1], battute[Math.min(sel[0], battute.length - 1)].length - 1)];
      campo.value = battute.map((b) => b.join(' ')).join(' | ');
      const c = smonta(battute[sel[0]][sel[1]]);
      const tasti = (voci, azione, attivo) => voci.map(([k, e]) => `<button type="button" class="cm-tasto" data-g="${azione}" data-v="${k}" aria-pressed="${String(k) === String(attivo)}">${esc(e)}</button>`).join('');
      const gradi = GRADI_ROM.map((g, i) => [i, g]);
      imposta(box, `<div class="cm-battute" role="group" aria-label="Battute del giro">${battute.map((b, i) => `<div class="cm-battuta"><small>${i + 1}</small>${b.map((a, k) => { const x = smonta(a); return `<button type="button" class="cm-accordo" data-g="scegli" data-b="${i}" data-k="${k}" aria-pressed="${i === sel[0] && k === sel[1]}" aria-label="Battuta ${i + 1}, accordo ${k + 1}: ${esc(nomeDi(x))}"><b>${esc(a)}</b><span>${esc(nomeDi(x))}</span></button>`; }).join('')}</div>`).join('')}</div>
        <p class="cm-scelta">Stai cambiando la <b>battuta ${sel[0] + 1}</b>${battute[sel[0]].length > 1 ? `, ${sel[1] ? 'seconda' : 'prima'} metà` : ''}. I nomi sono in ${modo() === 'm' ? 'La minore' : 'Do maggiore'}.</p>
        <p class="cm-riga"><span>Grado</span>${tasti(gradi, 'semi', c.semi)}</p>
        <p class="cm-riga"><span>Tipo</span>${tasti(TIPI.map((t) => [t[0], t[1]]), 'tipo', c.tipo)}</p>
        <p class="cm-riga"><span>Basso</span>${tasti([['', 'fondamentale'], ...gradi], 'basso', c.basso === null ? '' : c.basso)}</p>
        <p class="cm-riga"><span>Battuta</span><button type="button" class="btn small ghost" data-g="meta">${battute[sel[0]].length > 1 ? 'Togli il secondo accordo' : 'Aggiungi un secondo accordo'}</button>
          <button type="button" class="btn small ghost" data-g="copia" ${sel[0] + 1 < battute.length ? '' : 'disabled'}>Copia nella successiva</button>
          ${n ? '' : `<button type="button" class="btn small ghost" data-g="piu" ${battute.length < 8 ? '' : 'disabled'}>+ battuta</button><button type="button" class="btn small ghost" data-g="meno" ${battute.length > 1 ? '' : 'disabled'}>Togli la battuta</button>`}</p>`);
      if (fuoco) box.querySelector(fuoco)?.focus();
    }
    box.onclick = (e) => {
      const t = e.target.closest('[data-g]');
      if (!t) return;
      const { g, v, b, k } = t.dataset;
      const [i, j] = sel;
      if (g === 'scegli') sel = [Number(b), Number(k)];
      else if (g === 'meta') { if (battute[i].length > 1) battute[i].pop(); else battute[i].push(battute[i][0]); sel = [i, battute[i].length - 1]; }
      else if (g === 'copia') { battute[i + 1] = [...battute[i]]; sel = [i + 1, 0]; }
      else if (g === 'piu') { battute.splice(i + 1, 0, [...battute[i]]); sel = [i + 1, 0]; }
      else if (g === 'meno') { battute.splice(i, 1); sel = [Math.max(0, i - 1), 0]; }
      else {
        const c = smonta(battute[i][j]);
        c[g] = g === 'tipo' ? v : v === '' ? null : Number(v);
        battute[i][j] = monta(c);
      }
      // il fuoco resta sul tasto premuto: si può comporre anche da tastiera
      disegnaGiro(v !== undefined ? `[data-g="${g}"][data-v="${v}"]` : `[data-g="scegli"][data-b="${sel[0]}"][data-k="${sel[1]}"]`);
    };
    disegnaGiro();
    return disegnaGiro;
  }

  // ---------- editor in finestra ----------
  function modifica(base, id) {
    ferma();
    const v = { tipo: scheda, stile: filtro.stile || 'rock', modo: filtro.modo || 'm', ruolo: filtro.ruolo || 'strofa', andamento: filtro.andamento || 'dritto', stili: filtro.stile ? [filtro.stile] : [], ...base };
    const esempio = { armonia: 'i | bVI | bIII | bVII | i | bVI | iv | V', motivo: '8 4 4 8 8 | 12 4 16', cadenza: '8 8 8 8 | 28 -4', assolo: '4 4 4 4 4 4 4 4', richiamo: 'Mib4:8 Re4:8 Mib4:8 Do4:8 | Re4:8 Sib3:8 Do4:16', forma: 'gancio:4:0 strofa:8:0 rit:8:0 solo:8:1 rit:8:2 finale:4:0' };
    const campo = (nome, etichetta, righe, valore, segnaposto) => `<label>${etichetta}<textarea class="field cm-testo" name="${nome}" rows="${righe}" spellcheck="false" placeholder="${esc(segnaposto)}">${esc(valore || '')}</textarea></label>`;
    const scelta = (nome, etichetta, voci) => `<label>${etichetta}<select class="field" name="${nome}">${opzioni(voci, v[nome])}</select></label>`;
    const spunte = () => `<fieldset class="cm-spunte"><legend>Stili</legend>${dati.stili.map((s) => `<label><input type="checkbox" name="stili" value="${s.id}"${v.stili.includes(s.id) ? ' checked' : ''}> ${esc(s.nome)}</label>`).join('')}</fieldset>`;
    // gli accordi si compongono a pulsanti: il testo resta in un campo nascosto
    const accordi = (nome, valore) => `<input type="hidden" name="${nome}" value="${esc(valore)}"><div class="cm-giro" data-campo="${nome}"></div>`;
    const campi = {
      armonia: () => `<div class="cm-terna">${scelta('stile', 'Stile', dati.stili.map((s) => [s.id, s.nome])) + scelta('modo', 'Modo', MODI) + scelta('ruolo', 'Parte del brano', Object.entries(dati.ruoli))}</div>` + accordi('testo', v.testo || (v.modo === 'm' ? esempio.armonia : 'I | V | vi | IV | I | V | IV | V')),
      motivo: () => scelta('andamento', 'Andamento', Object.entries(dati.andamenti)) + campo('testo', 'Ritmo (2 battute)', 2, v.testo, esempio.motivo),
      cadenza: () => campo('testo', 'Ritmo (2 battute)', 2, v.testo, esempio.cadenza),
      assolo: () => campo('ritmo', 'Ritmo (1 battuta)', 1, v.ritmo, esempio.assolo) + campo('gesti', 'Una lettera per figura', 1, v.gesti, 'xpapxapc'),
      richiamo: () => campo('nome', 'Nome', 1, v.nome, 'Titolo (autore)') + scelta('modo', 'Modo', MODI) + accordi('accordi', v.accordi || 'i | V7') + campo('note', 'Note, scritte in Do', 4, v.note, esempio.richiamo) + spunte(),
      forma: () => campo('nome', 'Nome', 1, v.nome, 'La mia forma') + campo('testo', 'Sezioni', 3, v.testo, esempio.forma) + spunte(),
    };
    finestra.innerHTML = `<form method="dialog" class="cm-form"><h2 id="fTitolo">${id ? 'Modifica' : SCHEDE[v.tipo].nuova}</h2>
      <p class="muted">${esc(v.tipo === 'armonia' ? 'Premi una battuta, poi scegli grado, tipo e basso. Strofa, ritornello e ponte durano 8 battute, il pre-ritornello 4.' : v.tipo === 'richiamo' ? 'Un tema di pubblico dominio in 1-8 battute. Gli accordi si scelgono coi pulsanti; le note si scrivono in Do: Sol4:8 è un Sol di un quarto, -:8 una pausa, e ogni battuta somma a 32.' : SCHEDE[v.tipo].aiuto)}</p>${campi[v.tipo]()}
      <p class="err" id="cmErrore" role="alert"></p>
      <div class="f-tasti"><button type="button" class="btn ghost" data-cm="prova">Ascolta</button><button class="btn ghost" value="" formnovalidate>Annulla</button><button class="btn" value="ok">Salva</button></div></form>`;
    const f = finestra.querySelector('form');
    const raccolta = () => {
      const d = new FormData(f);
      const out = { ...Object.fromEntries(d), tipo: v.tipo, ...(id ? { id } : {}) };
      if (v.tipo === 'richiamo' || v.tipo === 'forma') out.stili = d.getAll('stili');
      return out;
    };
    const errore = (m) => { f.querySelector('#cmErrore').textContent = m; };
    const riquadro = f.querySelector('.cm-giro');
    if (riquadro) {
      const ridisegnaGiro = giroAccordi(riquadro, f.elements[riquadro.dataset.campo], {
        quante: () => (v.tipo === 'armonia' ? (f.elements.ruolo.value === 'pre' ? 4 : 8) : null),
        modo: () => f.elements.modo.value,
      });
      for (const n of ['ruolo', 'modo']) f.elements[n]?.addEventListener('change', () => ridisegnaGiro());
    }
    f.querySelector('[data-cm="prova"]').onclick = async (e) => {
      const tasto = e.currentTarget;
      const era = suono && suono.tasto === tasto;
      ferma();
      if (era) return;
      errore('');
      try { const r = await invia('/api/composizione/prova', raccolta()); suona(r.abc, tasto); } catch (x) { errore(x.message); }
    };
    // la finestra resta aperta finché il salvataggio non riesce
    f.onsubmit = async (e) => {
      if (!e.submitter || e.submitter.value !== 'ok') return;
      e.preventDefault();
      try { await invia('/api/composizione/salva', raccolta()); finestra.close(); toast('Salvato: vale dal prossimo brano'); scheda = v.tipo; await aggiorna(); }
      catch (x) { errore(x.message); }
    };
    finestra.onclose = ferma;
    finestra.showModal();
  }

  radice.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-cm]');
    if (!b) return;
    const azione = b.dataset.cm;
    if (azione === 'nuova') return modifica({});
    if (azione === 'altri') { filtro.quanti += 40; return disegnaElenco(); }
    const v = dati.voci.find((x) => x.id === b.dataset.id);
    if (!v) return;
    if (azione === 'ascolta') return ascolta(v, b);
    if (azione === 'modifica') return modifica(v, v.id);
    if (azione === 'duplica') { const { id, nome, ...resto } = v; return modifica({ ...resto, ...(nome ? { nome: nome + ' (copia)' } : {}) }); }
    if (azione === 'elimina' && !(await chiedi('Eliminare la voce?', `«${titolo(v)}» verrà eliminata.`, 'Elimina'))) return;
    if (azione === 'ripristina' && !(await chiedi('Tornare all’originale?', 'La tua modifica a questa voce viene tolta.', 'Ripristina'))) return;
    ferma();
    try { await invia('/api/composizione/' + azione, { id: v.id, attivo: !v.attivo }); await aggiorna(); } catch (x) { toast(x.message, 'err'); }
  });
  const filtra = (e) => {
    const c = e.target.closest('[data-f]');
    if (!c) return;
    filtro[c.dataset.f] = c.value; filtro.quanti = 40;
    if (c.dataset.f === 'stile') disegna(); else disegnaElenco();
  };
  radice.addEventListener('input', (e) => { if (e.target.type === 'search') filtra(e); });
  radice.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') filtra(e); });
  window.addEventListener('beforeunload', ferma);

  return {
    ferma,
    pagina(sotto) {
      scheda = SCHEDE[sotto] ? sotto : 'armonia';
      ferma();
      filtro.quanti = 40; filtro.q = ''; filtro.solo = '';
      document.querySelectorAll('#cmSub button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scheda === scheda)));
      if (dati) disegna(); else radice.innerHTML = '<div class="empty">Caricamento…</div>';
      aggiorna();
    },
  };
};
