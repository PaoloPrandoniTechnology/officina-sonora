// Pagina Composizione: consulta, modifica e crea accordi, motivi, chiusure, frasi d'assolo, richiami e forme.
// I controlli li fa il gateway con lo stesso codice della produzione.
window.PaginaComposizione = function (app) {
  'use strict';
  const { $, esc, imposta, toast, chiedi, invia, leggi } = app;
  const radice = $('#cmPagina');
  const finestra = $('#finestra');
  const E = window.EditorComposizione;

  const SCHEDE = {
    armonia: { nome: 'Accordi', nuova: 'Nuovo giro di accordi', aiuto: 'I giri di accordi di ogni stile. Strofa, ritornello e ponte durano 8 battute, il pre-ritornello 4.' },
    motivo: { nome: 'Motivi', nuova: 'Nuovo motivo', aiuto: 'Il ritmo di un tema in due battute. Le altezze le sceglie il compositore sugli accordi.' },
    cadenza: { nome: 'Chiusure', nuova: 'Nuova chiusura', aiuto: 'Il ritmo con cui si chiude una frase: meglio note lunghe e un respiro in fondo.' },
    assolo: { nome: 'Assoli', nuova: 'Nuova frase d’assolo', aiuto: 'Frasi di una battuta: il ritmo e, per ogni nota, come si muove.' },
    richiamo: { nome: 'Richiami', nuova: 'Nuovo richiamo', aiuto: 'Temi da citare in 1-8 battute, scritti in Do. Usa solo musica di pubblico dominio: i brani vengono pubblicati.' },
    forma: { nome: 'Forme', nuova: 'Nuova forma', aiuto: 'La successione delle sezioni di un brano. Le sezioni «sempre presenti» ci sono comunque; quelle «extra» entrano in ordine se la durata lo permette.' },
  };
  // nome breve e spiegazione di ogni movimento delle note d'assolo
  const GESTI = { x: ['Arrivo', 'nota dell’accordo'], p: ['Passo', 'nota di passaggio'], n: ['Volta', 'nota vicina e ritorno'], a: ['Arpeggio', 'nota dell’accordo seguente'], s: ['Salto', 'salto verso l’alto'], c: ['Cromatica', 'semitono prima dell’arrivo'], r: ['Ripeti', 'stessa nota'] };
  const PASSAGGI = { armonia: 4, motivo: 4, cadenza: 4, assolo: 8, richiamo: 1 }; // quante volte la prova ripete la voce
  const NUOVI = {
    armonia: (v) => ({ testo: v.modo === 'm' ? 'i | bVI | bIII | bVII | i | bVI | iv | V' : 'I | V | vi | IV | I | V | IV | V' }),
    motivo: () => ({ testo: '8 4 4 8 8 | 12 4 16' }), cadenza: () => ({ testo: '8 8 8 8 | 28 -4' }),
    assolo: () => ({ ritmo: '4 4 4 4 4 4 4 4', gesti: 'xppapxpc' }),
    richiamo: () => ({ nome: 'Nuovo richiamo', accordi: 'I | V', note: 'Do4:8 Mi4:8 Sol4:8 Mi4:8 | Re4:16 Do4:16' }),
    forma: () => ({ nome: 'Nuova forma', testo: 'gancio:4:0 strofa:8:0 rit:8:0 solo:8:1 rit:8:2 finale:4:0' }),
  };
  const MODI = [['m', 'Minore'], ['M', 'Maggiore']];
  let dati = null;
  let scheda = 'armonia';
  const filtro = { stile: '', modo: '', ruolo: '', andamento: '', q: '', solo: '', quanti: 40 };
  let suono = null;

  // ---------- ascolto ----------
  const A = window.ScoreAbc;
  function ferma() {
    if (!suono) return;
    clearTimeout(suono.fine);
    cancelAnimationFrame(suono.quadro);
    suono.ctx.close();
    suono.battute.forEach((b) => b.classList.remove('suona'));
    if (suono.tasto.isConnected) suono.tasto.textContent = 'Ascolta';
    suono = null;
  }
  const voceSintetica = (ctx) => (midi, da, durata, forma, volume) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), a = da + durata;
    o.type = forma; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    g.gain.setValueAtTime(0, da);
    g.gain.linearRampToValueAtTime(volume, da + 0.015);
    g.gain.setValueAtTime(volume * 0.8, Math.max(da + 0.016, a - 0.05));
    g.gain.linearRampToValueAtTime(0, a);
    o.connect(g).connect(ctx.destination); o.start(da); o.stop(a + 0.02);
  };
  // un colpo breve per sentire l'accordo o la nota appena scelti
  let colpo = null;
  function assaggia(note) {
    ferma();
    colpo?.close();
    colpo = new AudioContext();
    const nota = voceSintetica(colpo);
    note.forEach((m) => nota(m, colpo.currentTime + 0.02, 0.5, 'triangle', 0.5 / (note.length + 1)));
  }
  // sintetizzatore minimo: melodia, accordi e basso, per giudicare note e ritmo (non il suono finale).
  // Sulla timeline si accende la battuta che sta suonando.
  function suona(abc, tasto, linea, passaggi) {
    const score = A.leggiAbc(abc).score;
    if (!score) return toast('Non riesco a leggere la prova', 'err');
    app.pausaLettore();
    const ctx = new AudioContext();
    const nota = voceSintetica(ctx);
    const unita = 60 / score.bpm / 8;
    const inizio = ctx.currentTime + 0.1;
    let t = inizio;
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
        const lunghezza = A.unita(s.metro || score.metro);
        (b.accordi || []).forEach((a, i) => {
          const c = A.noteAccordo(a.sigla);
          const fine = i + 1 < b.accordi.length ? b.accordi[i + 1].pos : lunghezza;
          const da = t + a.pos * unita, durata = (fine - a.pos) * unita;
          nota(36 + c.basso, da, durata, 'triangle', 0.11);
          for (const n of c.note) nota(48 + n, da, durata, 'sine', 0.05);
        });
        t += lunghezza * unita;
      }
    }
    for (const n of melodia) nota(n.midi, n.da, n.durata, 'triangle', 0.22);
    tasto.textContent = 'Ferma';
    const battute = linea && passaggi ? [...linea.querySelectorAll('.tl-battuta')] : [];
    suono = { ctx, tasto, battute, fine: setTimeout(ferma, (t - ctx.currentTime + 0.3) * 1000) };
    const segui = () => {
      if (!suono || suono.ctx !== ctx) return;
      const quota = Math.max(0, Math.min(0.999, (ctx.currentTime - inizio) / (t - inizio)));
      const ora = Math.floor(((quota * passaggi) % 1) * battute.length);
      battute.forEach((b, i) => b.classList.toggle('suona', i === ora));
      suono.quadro = requestAnimationFrame(segui);
    };
    if (battute.length) segui();
  }
  async function ascolta(voce, tasto, linea, errore) {
    const era = suono && suono.tasto === tasto;
    ferma();
    if (era) return;
    try {
      const r = await invia('/api/composizione/prova', voce);
      suona(r.abc, tasto, typeof linea === 'function' ? linea() : linea, PASSAGGI[voce.tipo]);
      if (r.genere) toast('Prova con il genere ' + r.genere);
    } catch (e) { errore ? errore(e.message) : toast(e.message, 'err'); }
  }

  // ---------- elenco ----------
  const stileNome = (id) => (dati.stili.find((s) => s.id === id) || {}).nome || id;
  const titolo = (v) => v.nome || (v.tipo === 'armonia' ? `${stileNome(v.stile)}, ${v.modo === 'm' ? 'minore' : 'maggiore'}, ${dati.ruoli[v.ruolo]}` : v.tipo === 'motivo' ? dati.andamenti[v.andamento] : v.tipo === 'cadenza' ? 'Chiusura di frase' : 'Frase d’assolo');
  const tonicaDi = (v) => (v.tipo === 'armonia' && v.modo === 'm' ? 9 : 0);
  const cercabile = (v) => [titolo(v), v.testo, v.ritmo, v.accordi, v.note].filter(Boolean).join(' ').toLowerCase();

  function filtrate() {
    const q = filtro.q.trim().toLowerCase();
    return dati.voci.filter((v) => v.tipo === scheda
      && (!filtro.stile || (v.stile ? v.stile === filtro.stile : v.stili ? v.stili.includes(filtro.stile) : true))
      && (scheda !== 'armonia' || ((!filtro.modo || v.modo === filtro.modo) && (!filtro.ruolo || v.ruolo === filtro.ruolo)))
      && (scheda !== 'motivo' || !filtro.andamento || v.andamento === filtro.andamento)
      && (!filtro.solo || (filtro.solo === 'tue' ? !v.serie : filtro.solo === 'modificate' ? v.modificata : !v.attivo))
      && (!q || cercabile(v).includes(q)));
  }

  function disegnaElenco() {
    const lista = filtrate();
    const tutte = dati.voci.filter((v) => v.tipo === scheda);
    $('#cmConta').textContent = `${lista.length} di ${tutte.length} · ${tutte.filter((v) => v.attivo && !v.errore).length} in uso`;
    imposta($('#cmElenco'), lista.slice(0, filtro.quanti).map((v) => `<article class="card cm-voce${v.attivo ? '' : ' spenta'}">
      <h3>${esc(titolo(v))}${v.serie ? (v.modificata ? '<span class="badge">modificata</span>' : '') : '<span class="badge">tua</span>'}${v.attivo ? '' : '<span class="badge">spenta</span>'}</h3>
      ${v.stili ? `<p class="muted">${v.stili.map(stileNome).map(esc).join(', ')}</p>` : ''}
      ${v.errore ? `<p class="err">Non usata: ${esc(v.errore)}</p>` : E.timeline(E.modelloDi(v), { tonica: tonicaDi(v), gesti: GESTI })}
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
        <input class="search" type="search" data-f="q" placeholder="Cerca" aria-label="Cerca" value="${esc(filtro.q)}">
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

  // ---------- editor guidato: 1 dove si usa, 2 componi, 3 controlla e salva ----------
  function modifica(base, id) {
    ferma();
    const meta = { tipo: scheda, stile: filtro.stile || 'rock', modo: filtro.modo || 'm', ruolo: filtro.ruolo || 'strofa', andamento: filtro.andamento || 'dritto', stili: [filtro.stile || 'rock'], nome: '', ...base };
    const tipo = meta.tipo;
    const iniziale = { meta: { ...meta, stili: [...(meta.stili || [])] }, m: E.modelloDi({ ...NUOVI[tipo](meta), ...base, tipo }) };
    let stato = JSON.parse(JSON.stringify(iniziale));
    const annulla = [], ripeti = [];
    const corsia = () => (stato.m.sezioni ? 's' : stato.m.accordi && !stato.m.figure ? 'a' : 'f');
    let sel = [corsia(), 0, 0];
    const cambiata = () => JSON.stringify(stato) !== JSON.stringify(iniziale);
    const voce = () => ({ ...stato.meta, ...E.campiDi(stato.m), tipo, ...(id ? { id } : {}) });

    finestra.innerHTML = `<form method="dialog" class="cm-form"><h2 id="fTitolo">${id ? 'Modifica' : SCHEDE[tipo].nuova}</h2>
      <p class="muted">${esc(SCHEDE[tipo].aiuto)}</p>
      <section class="cm-passo"><h3><i>1</i> Dove si usa</h3><div id="cmDove"></div></section>
      <section class="cm-passo"><h3><i>2</i> Componi <span class="cm-storia"><button type="button" class="btn small ghost" data-e="annulla">Annulla modifica</button><button type="button" class="btn small ghost" data-e="ripeti">Ripeti</button><button type="button" class="btn small ghost" data-e="ricomincia">Ricomincia</button></span></h3>
        <p class="cm-guida" id="cmGuida"></p><div id="cmLinea"></div><div class="cm-pannello" id="cmPannello"></div></section>
      <section class="cm-passo"><h3><i>3</i> Controlla e salva</h3><ul class="cm-controlli" id="cmControlli" aria-live="polite"></ul>
        <p class="err" id="cmErrore" role="alert"></p>
        <div class="f-tasti"><span></span><button type="button" class="btn ghost" data-e="ascolta">Ascolta</button><button type="button" class="btn ghost" data-e="chiudi">Esci senza salvare</button><button class="btn" value="ok" id="cmSalva">Salva</button></div></section></form>`;
    const f = finestra.querySelector('form');
    const q = (s) => f.querySelector(s);
    const errore = (m) => { q('#cmErrore').textContent = m; };

    // un gruppo di pulsanti: [chiave, etichetta, spiegazione, disattivato]
    const tasti = (etichetta, azione, voci, attivi) => `<div class="cm-riga" role="group" aria-label="${esc(etichetta)}"><span>${esc(etichetta)}</span>${voci.map(([k, e, aiuto, no]) => `<button type="button" class="cm-tasto" data-e="${azione}" data-v="${esc(k)}" aria-pressed="${[].concat(attivi).map(String).includes(String(k))}"${aiuto ? ` title="${esc(aiuto)}"` : ''}${no ? ' disabled' : ''}>${esc(e)}</button>`).join('')}</div>`;

    function disegnaDove() {
      const x = stato.meta;
      const stili = dati.stili.map((s) => [s.id, s.nome]);
      const parti = [];
      if (tipo === 'richiamo' || tipo === 'forma') parti.push(`<label class="cm-nome">Nome<input class="field" name="nome" maxlength="${tipo === 'forma' ? 40 : 80}" value="${esc(x.nome)}" autocomplete="off"></label>`);
      if (tipo === 'armonia') parti.push(tasti('Stile', 'm-stile', stili, x.stile), tasti('Parte', 'm-ruolo', Object.entries(dati.ruoli), x.ruolo));
      if (tipo === 'armonia' || tipo === 'richiamo') parti.push(tasti('Modo', 'm-modo', MODI, x.modo));
      if (tipo === 'motivo') parti.push(tasti('Andamento', 'm-andamento', Object.entries(dati.andamenti), x.andamento));
      if (tipo === 'richiamo' || tipo === 'forma') parti.push(tasti('Stili (anche più di uno)', 'm-stili', stili, x.stili));
      if (!parti.length) parti.push('<p class="muted">Vale per tutti gli stili: non c’è niente da scegliere.</p>');
      const usati = dati.stili.filter((s) => (tipo === 'armonia' ? s.id === x.stile : tipo === 'motivo' ? s.andamento === x.andamento : tipo === 'richiamo' || tipo === 'forma' ? x.stili.includes(s.id) : true)).flatMap((s) => s.generi.map((g) => g.etichetta));
      parti.push(`<p class="muted cm-generi">Si sentirà in: ${esc([...new Set(usati)].join(', ') || 'nessun genere')}.</p>`);
      imposta(q('#cmDove'), parti.join(''));
      const nome = q('[name="nome"]');
      if (nome) nome.oninput = () => { stato.meta.nome = nome.value; disegnaControlli(); };
    }

    // ---- pannello dell'elemento scelto sulla timeline ----
    const pannelli = {
      a: () => {
        const accordi = stato.m.accordi, b = sel[1], c = E.smonta(accordi[b][sel[2]]);
        const gradi = E.GRADI.map((g, i) => [i, g]);
        return `<p class="cm-scelta">Battuta <b>${b + 1}</b>${accordi[b].length > 1 ? `, ${sel[2] ? 'seconda' : 'prima'} metà` : ''}: <b>${esc(E.nomeAccordo(c, tonicaDi(stato.meta.tipo ? stato.meta : voce())))}</b></p>`
          + tasti('Grado', 'a-semi', gradi, c.semi) + tasti('Tipo', 'a-tipo', E.TIPI.map((t) => [t[0], t[1]]), c.tipo) + tasti('Basso', 'a-basso', [['', 'come il grado'], ...gradi], c.basso === null ? '' : c.basso)
          + tasti('Battuta', 'a-fai', [['meta', accordi[b].length > 1 ? 'Togli il secondo accordo' : 'Dividi in due accordi'], ['copia', 'Copia nella successiva', '', b + 1 >= accordi.length]], []);
      },
      f: () => {
        const bar = stato.m.figure[sel[1]], i = sel[2], x = bar[i];
        const ultima = i === bar.length - 1, note = bar.filter((y) => !y.pausa).length;
        const max = E.massimo(bar, i);
        let out = `<p class="cm-scelta">Battuta <b>${sel[1] + 1}</b>, figura ${i + 1} di ${bar.length}: <b>${x.pausa ? 'pausa' : tipo === 'richiamo' ? E.nomeNota(x.midi) : 'nota'}</b> di ${E.durataTesto(x.d)} di battuta</p>`
          + tasti('Cosa è', 'f-pausa', [['0', 'Nota'], ['1', 'Pausa', note < 2 && !x.pausa ? 'In ogni battuta serve almeno una nota' : '', note < 2 && !x.pausa]], x.pausa ? '1' : '0')
          + tasti('Durata', 'f-durata', E.DURATE.map(([d, e]) => [d, e, d > max ? 'Non entra nella battuta' : '', d > max]), x.d)
          + tasti('Taglia', 'f-fai', [['dividi', 'Dividi in due', '', x.d < 2], ['unisci', 'Unisci alla successiva', '', ultima]], []);
        if (!x.pausa && tipo === 'richiamo') {
          out += tasti('Nota', 'f-nota', E.NOTE.map((n, k) => [k, n]), x.midi % 12)
            + tasti('Ottava', 'f-ottava', [3, 4, 5, 6].map((o) => [o, String(o), o === 4 ? 'ottava centrale' : '', 12 * (o + 1) + (x.midi % 12) > E.MAX]), Math.floor(x.midi / 12) - 1)
            + tasti('Sposta', 'f-passo', [['-1', '▼ semitono', '', x.midi <= E.MIN], ['1', '▲ semitono', '', x.midi >= E.MAX]], []);
        }
        if (!x.pausa && tipo === 'assolo') out += tasti('Movimento', 'f-gesto', Object.entries(GESTI).map(([k, [n, a]]) => [k, n, a]), x.g) + `<p class="muted cm-spiega">${esc(GESTI[x.g] ? GESTI[x.g].join(': ') : '')}</p>`;
        if (!x.pausa && tipo !== 'richiamo') {
          out += tasti('Colore', 'f-colore', [['app', 'Appoggiatura ↘', 'La nota parte da quella sopra e scende'], ['ant', 'Anticipo ⌒', ultima ? 'La nota si lega alla battuta dopo' : 'Solo sull’ultima nota della battuta', !ultima]], [x.app ? 'app' : '', x.ant ? 'ant' : '']);
        }
        if (tipo === 'richiamo') out += tasti('Battute', 'f-battute', [['piu', '+ battuta dopo', '', stato.m.figure.length >= 8], ['meno', 'Togli questa battuta', '', stato.m.figure.length < 2]], []);
        return out;
      },
      s: () => {
        const sez = stato.m.sezioni, i = sel[2], x = sez[i], finale = i === sez.length - 1;
        return `<p class="cm-scelta">Sezione ${i + 1} di ${sez.length}: <b>${esc(E.SEZ[x.ruolo])}</b></p>`
          + (finale ? '<p class="muted cm-spiega">Il finale chiude sempre il brano: si può cambiare solo la sua lunghezza.</p>'
            : tasti('Tipo', 's-ruolo', Object.entries(E.SEZ).filter(([k]) => k !== 'finale'), x.ruolo))
          + tasti('Battute', 's-battute', [2, 4, 6, 8, 12, 16].map((n) => [n, String(n)]), x.battute)
          + (finale ? '' : tasti('Quando', 's-priorita', [[0, 'Sempre presente'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, `extra ${n}`, 'Entra se la durata lo permette: prima le extra col numero più basso'])], x.priorita))
          + tasti('Ordine', 's-fai', [['prima', '◀ Prima', '', finale || i === 0], ['dopo', 'Dopo ▶', '', finale || i >= sez.length - 2], ['piu', '+ sezione qui', '', sez.length >= 16], ['meno', 'Togli', '', finale || sez.length <= 3]], []);
      },
    };

    // controlli: [ok, testo, obbligatorio]
    function controlli() {
      const x = stato.meta, m = stato.m, out = [];
      if (tipo === 'richiamo' || tipo === 'forma') {
        out.push([!!x.nome.trim() && !/[<>]/.test(x.nome), 'Ha un nome (senza < o >)', true], [x.stili.length > 0, 'È scelto almeno uno stile', true]);
      }
      if (m.accordi && tipo === 'armonia') {
        const diversi = new Set(m.accordi.flat()).size, ultimo = E.smonta(m.accordi.at(-1).at(-1));
        out.push([true, `${m.accordi.length} battute, come vuole questa parte`, true], [diversi >= 3, `Almeno tre accordi diversi (ora ${diversi})`, false]);
        if (x.ruolo === 'rit') out.push([ultimo.semi === 0, 'Il ritornello chiude sul I grado', false]);
        if (x.ruolo === 'strofa' || x.ruolo === 'pre') out.push([ultimo.semi !== 0, 'Finisce aperto (non sul I grado), così porta avanti', false]);
      }
      if (m.figure) {
        out.push([true, 'Ogni battuta è completa', true]);
        const ultima = m.figure.at(-1).filter((y) => !y.pausa).at(-1);
        if (tipo === 'cadenza') out.push([ultima.d >= 12, 'Finisce con una nota lunga', false]);
        if (tipo === 'motivo') out.push([m.figure.flat().some((y) => y.pausa || y.d >= 12), 'C’è un respiro: una pausa o una nota lunga', false]);
      }
      if (m.sezioni) {
        const fisse = m.sezioni.filter((s) => s.priorita === 0), battute = fisse.reduce((a, s) => a + s.battute, 0);
        out.push([m.sezioni.length >= 3, 'Almeno tre sezioni', true], [fisse.length >= 2, 'Almeno due sezioni sempre presenti', true],
          [true, `Il finale è in coda · minimo ${battute} battute (circa ${Math.round(battute * 2)} secondi a 120 bpm), tutto ${m.sezioni.reduce((a, s) => a + s.battute, 0)}`, true], [m.sezioni.some((s) => s.ruolo === 'rit'), 'C’è un ritornello', false]);
      }
      return out;
    }
    function disegnaControlli() {
      const lista = controlli();
      imposta(q('#cmControlli'), lista.map(([ok, t, obbligo]) => `<li class="${ok ? 'ok' : obbligo ? 'no' : 'nota'}">${ok ? '✓' : obbligo ? '✗' : '○'} ${esc(t)}${!ok && !obbligo ? ' <small>(consiglio)</small>' : ''}</li>`).join(''));
      const pronto = lista.every(([ok, , obbligo]) => ok || !obbligo);
      q('#cmSalva').disabled = !pronto;
      q('#cmSalva').title = pronto ? '' : 'Completa i punti segnati con ✗';
    }

    function disegnaTutto(fuoco) {
      // le battute degli accordi seguono la parte scelta
      if (tipo === 'armonia') {
        const n = stato.meta.ruolo === 'pre' ? 4 : 8;
        stato.m.accordi = Array.from({ length: n }, (_, i) => stato.m.accordi[i] || [...stato.m.accordi[i % stato.m.accordi.length]]);
      }
      const lista = stato.m[{ a: 'accordi', f: 'figure', s: 'sezioni' }[sel[0]]];
      if (sel[0] === 's') sel[2] = Math.min(sel[2], lista.length - 1);
      else { sel[1] = Math.min(sel[1], lista.length - 1); sel[2] = Math.min(sel[2], lista[sel[1]].length - 1); }
      disegnaDove();
      imposta(q('#cmLinea'), E.timeline(stato.m, { scelta: sel, tonica: tipo === 'armonia' && stato.meta.modo === 'm' ? 9 : 0, gesti: GESTI }));
      q('#cmGuida').textContent = tipo === 'forma' ? 'Premi una sezione per cambiarla.' : tipo === 'armonia' ? 'Premi un accordo, poi scegli grado, tipo e basso: lo senti subito.' : tipo === 'richiamo' ? 'Premi una nota o un accordo sulla timeline, poi cambialo coi pulsanti.' : 'Premi una figura sulla timeline: le battute restano sempre complete.';
      imposta(q('#cmPannello'), pannelli[sel[0]]());
      q('[data-e="annulla"]').disabled = !annulla.length;
      q('[data-e="ripeti"]').disabled = !ripeti.length;
      disegnaControlli();
      if (fuoco) f.querySelector(fuoco)?.focus({ preventScroll: true });
    }
    // ogni modifica passa di qui: si può annullare, e la prova in corso si ferma
    function cambia(fn, fuoco) {
      ferma(); errore('');
      const prima = JSON.stringify(stato);
      fn();
      if (JSON.stringify(stato) !== prima) { annulla.push(prima); ripeti.length = 0; if (annulla.length > 100) annulla.shift(); }
      disegnaTutto(fuoco);
    }
    const storia = (da, a) => { if (!da.length) return; ferma(); a.push(JSON.stringify(stato)); stato = JSON.parse(da.pop()); disegnaTutto(); };

    const azioni = {
      a: (campo, v) => {
        const accordi = stato.m.accordi, [, b, k] = sel;
        if (campo === 'fai') {
          if (v === 'meta') { if (accordi[b].length > 1) accordi[b].pop(); else accordi[b].push(accordi[b][0]); sel = ['a', b, accordi[b].length - 1]; }
          else { accordi[b + 1] = [...accordi[b]]; sel = ['a', b + 1, 0]; }
          return;
        }
        const c = E.smonta(accordi[b][k]);
        c[campo] = campo === 'tipo' ? v : v === '' ? null : Number(v);
        accordi[b][k] = E.monta(c);
        assaggia(E.noteAccordo(c, tipo === 'armonia' && stato.meta.modo === 'm' ? 9 : 0));
      },
      f: (campo, v) => {
        const bar = stato.m.figure[sel[1]], i = sel[2], x = bar[i];
        if (campo === 'pausa') { x.pausa = v === '1'; if (tipo === 'richiamo') x.midi = x.pausa ? null : (bar.find((y) => y.midi != null) || { midi: 60 }).midi; E.sistema(bar); }
        else if (campo === 'durata') E.cambiaDurata(bar, i, Number(v));
        else if (campo === 'fai') E[v](bar, i);
        else if (campo === 'gesto') x.g = v;
        else if (campo === 'colore') x[v] = !x[v];
        else if (campo === 'battute') {
          const b = sel[1];
          if (v === 'piu') { stato.m.figure.splice(b + 1, 0, JSON.parse(JSON.stringify(bar))); stato.m.accordi.splice(b + 1, 0, [...stato.m.accordi[b]]); sel = ['f', b + 1, 0]; }
          else { stato.m.figure.splice(b, 1); stato.m.accordi.splice(b, 1); sel = ['f', Math.max(0, b - 1), 0]; }
        } else {
          const midi = campo === 'nota' ? x.midi - (x.midi % 12) + Number(v) : campo === 'ottava' ? 12 * (Number(v) + 1) + (x.midi % 12) : x.midi + Number(v);
          x.midi = Math.max(E.MIN, Math.min(E.MAX, midi));
          assaggia([x.midi]);
        }
      },
      s: (campo, v) => {
        const sez = stato.m.sezioni, i = sel[2];
        if (campo === 'ruolo') sez[i].ruolo = v;
        else if (campo !== 'fai') sez[i][campo] = Number(v);
        else if (v === 'prima' || v === 'dopo') { const j = i + (v === 'prima' ? -1 : 1); [sez[i], sez[j]] = [sez[j], sez[i]]; sel = ['s', 0, j]; }
        else if (v === 'meno') sez.splice(i, 1);
        else {
          const dove = Math.min(i + 1, sez.length - 1);
          sez.splice(dove, 0, { ruolo: 'strofa', battute: 8, priorita: 0 }); sel = ['s', 0, dove];
        }
      },
    };

    f.onclick = (e) => {
      const linea = e.target.closest('[data-t]');
      if (linea) {
        const [c, b, i] = linea.dataset.t.split(':');
        sel = [c, Number(b), Number(i)];
        const x = c === 'a' ? E.smonta(stato.m.accordi[sel[1]][sel[2]]) : c === 'f' && tipo === 'richiamo' ? stato.m.figure[sel[1]][sel[2]] : null;
        ferma();
        disegnaTutto(`[data-t="${linea.dataset.t}"]`);
        if (c === 'a') assaggia(E.noteAccordo(x, tipo === 'armonia' && stato.meta.modo === 'm' ? 9 : 0)); else if (x && !x.pausa) assaggia([x.midi]);
        return;
      }
      const t = e.target.closest('[data-e]');
      if (!t) return;
      const { e: azione, v } = t.dataset;
      if (azione === 'annulla') return storia(annulla, ripeti);
      if (azione === 'ripeti') return storia(ripeti, annulla);
      if (azione === 'ricomincia') return cambia(() => { stato = JSON.parse(JSON.stringify(iniziale)); sel = [corsia(), 0, 0]; });
      if (azione === 'ascolta') return ascolta(voce(), t, () => q('#cmLinea'), errore);
      if (azione === 'chiudi') return finestra.close();
      const [gruppo, campo] = azione.split('-');
      const fuoco = `[data-e="${azione}"][data-v="${CSS.escape(v)}"]`;
      if (gruppo === 'm') {
        return cambia(() => {
          if (campo === 'stili') stato.meta.stili = stato.meta.stili.includes(v) ? stato.meta.stili.filter((s) => s !== v) : [...stato.meta.stili, v];
          else stato.meta[campo] = v;
        }, fuoco);
      }
      return cambia(() => azioni[gruppo](campo, v), fuoco);
    };
    // tastiera: frecce per muoversi sulla timeline, Ctrl+Z e Ctrl+Y
    f.onkeydown = (e) => {
      if (e.target.closest('input')) { if (e.key === 'Enter') e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) { e.preventDefault(); return e.key.toLowerCase() === 'z' ? storia(annulla, ripeti) : storia(ripeti, annulla); }
      const qui = e.target.closest('[data-t]');
      if (qui && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const tutti = [...q('#cmLinea').querySelectorAll(`[data-t^="${qui.dataset.t[0]}:"]`)];
        tutti[tutti.indexOf(qui) + (e.key === 'ArrowLeft' ? -1 : 1)]?.click();
      }
    };
    // la finestra resta aperta finché il salvataggio non riesce
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!e.submitter || e.submitter.value !== 'ok') return;
      try { await invia('/api/composizione/salva', voce()); finestra.close(); toast('Salvato: vale dal prossimo brano'); scheda = tipo; await aggiorna(); }
      catch (x) { errore(x.message); }
    };
    // Esc non butta via il lavoro
    finestra.oncancel = (e) => { if (cambiata()) { e.preventDefault(); errore('Ci sono modifiche non salvate: premi «Salva» oppure «Esci senza salvare».'); } };
    finestra.onclose = () => { ferma(); finestra.oncancel = null; };
    disegnaTutto();
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
    if (azione === 'ascolta') return ascolta(v, b, b.closest('.cm-voce'));
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
