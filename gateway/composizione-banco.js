// Banco di lavoro della Composizione, come in un programma di musica: righello con cursore, corsia degli accordi,
// griglia delle note (si clicca per aggiungere, si trascina per spostare, si tira il bordo per allungare), riga di
// riproduzione con Play e Stop, tastiera che si accende e, sotto, le proprietà dell'elemento scelto.
window.BancoComposizione = function (app) {
  'use strict';
  const { finestra, invia, toast, dati, schede, gesti: GESTI, assaggia, fermaAscolto, pausaLettore } = app;
  const E = window.EditorComposizione;
  const L = window.LettoreComposizione;
  const A = window.ScoreAbc;
  const { esc } = E;

  const NUOVI = {
    armonia: (v) => ({ testo: v.modo === 'm' ? 'i | bVI | bIII | bVII | i | bVI | iv | V' : 'I | V | vi | IV | I | V | IV | V' }),
    motivo: () => ({ testo: '8 4 4 8 8 | 12 4 16' }), cadenza: () => ({ testo: '8 8 8 8 | 28 -4' }),
    assolo: () => ({ ritmo: '4 4 4 4 4 4 4 4', gesti: 'xppapxpc' }),
    richiamo: () => ({ nome: 'Nuovo richiamo', accordi: 'I | V', note: 'Do4:8 Mi4:8 Sol4:8 Mi4:8 | Re4:16 Do4:16' }),
    forma: () => ({ nome: 'Nuova forma', testo: 'gancio:4:0 strofa:8:0 rit:8:0 solo:8:1 rit:8:2 finale:4:0' }),
  };
  const MODI = [['m', 'Minore'], ['M', 'Maggiore']];
  const GRIGLIE = [[2, '1/16'], [4, '1/8'], [8, '1/4'], [16, '1/2']];
  const CORSIE_ASSOLO = ['x', 'a', 'p', 'n', 's', 'c', 'r'];
  const NERI = new Set([1, 3, 6, 8, 10]);
  // spiegazioni in parole semplici: compaiono solo passando sull'etichetta
  const AIUTI = {
    Stile: 'La famiglia musicale in cui questa voce viene usata.',
    Parte: 'Il momento del brano: la strofa racconta, il pre-ritornello prepara, il ritornello resta in testa, il ponte porta altrove.',
    Modo: 'Minore suona più raccolto o drammatico, maggiore più aperto e luminoso.',
    Andamento: 'Il modo di tenere il tempo: dritto, dondolante (swing), spostato (sincopato), largo o a danza.',
    'Stili (anche più di uno)': 'Premi più stili per usare la voce in più famiglie di brani.',
    Grado: 'Su quale nota nasce l’accordo. I è la nota di casa, V porta di nuovo a casa.',
    Tipo: 'Il colore dell’accordo: maggiore, minore, con la settima, sospeso…',
    Basso: 'La nota più grave. «Come il grado» è la scelta normale; un’altra crea un passaggio morbido.',
    Durata: 'Quanta parte della battuta occupa: 1/4 è un battito, 1/2 sono due.',
    Nota: 'Quale nota suonare.',
    Ottava: 'Quanto in alto: 4 è la zona centrale del pianoforte.',
    Movimento: 'Come questa nota si muove rispetto alle altre quando il compositore le sceglie.',
    Colore: 'Piccoli accenti espressivi.',
    Battute: 'Quanto è lunga la sezione.',
    Quando: '«Sempre presente» c’è in ogni brano; le «extra» entrano solo se il brano è abbastanza lungo.',
  };

  function apri(base, id, salvato) {
    const tipo = base.tipo;
    const conNote = ['motivo', 'cadenza', 'assolo', 'richiamo'].includes(tipo);
    const conAccordi = tipo === 'armonia' || tipo === 'richiamo';
    const modello = E.modelloDi({ ...NUOVI[tipo](base), ...base, tipo });
    // sulle timeline si lavora a note posizionate: le pause sono gli spazi vuoti
    const iniziale = { meta: { ...base, stili: [...(base.stili || [])] }, m: { tipo, ...(modello.accordi ? { accordi: modello.accordi } : {}), ...(conNote ? { note: modello.figure.map(E.inNote) } : {}), ...(modello.sezioni ? { sezioni: modello.sezioni } : {}) } };
    const copia = (x) => JSON.parse(JSON.stringify(x));
    let stato = copia(iniziale);
    const annulla = [], ripeti = [];
    let sel = conAccordi && !conNote ? { c: 'a', b: 0, k: 0 } : tipo === 'forma' ? { c: 's', i: 0 } : { c: 'n', b: 0, i: 0 };
    let griglia = 4, zoom = 0, cursore = 0, ciclo = false, aperto = true;
    let ascolto = null; // { ctx, ev, inizio, quadro, da }
    let trascina = null;
    let mossaUtente = 0;

    const battute = () => (stato.m.sezioni ? stato.m.sezioni.reduce((a, s) => a + s.battute, 0) : (stato.m.note || stato.m.accordi).length);
    const unita = () => battute() * 32;
    const tonica = () => (tipo === 'armonia' && stato.meta.modo === 'm' ? 9 : 0);
    const voce = () => {
      const m = stato.m;
      return { ...stato.meta, ...E.campiDi({ ...m, ...(m.note ? { figure: m.note.map((n) => E.inFigure(n, tipo)) } : {}) }), tipo, ...(id ? { id } : {}) };
    };
    const cambiata = () => JSON.stringify(stato) !== JSON.stringify(iniziale);

    // ---------- struttura fissa della finestra ----------
    finestra.innerHTML = `<form method="dialog" class="bn">
      <header class="bn-testa"><h2 id="fTitolo">${id ? 'Modifica' : schede[tipo].nuova}</h2>
        ${tipo === 'richiamo' || tipo === 'forma' ? `<input class="field bn-nome" name="nome" aria-label="Nome" placeholder="Nome" maxlength="${tipo === 'forma' ? 40 : 80}" value="${esc(stato.meta.nome)}" autocomplete="off">` : '<span></span>'}
        <button type="button" class="btn ghost" data-e="chiudi">Esci senza salvare</button><button class="btn" value="ok" id="cmSalva">Salva</button></header>
      <details class="bn-dove"><summary id="bnRiassunto"></summary><div id="cmDove"></div></details>
      <div class="bn-barra" role="toolbar" aria-label="Riproduzione e strumenti">
        <button type="button" class="btn bn-play" data-e="play" data-tip="Ascolta dal cursore, o metti in pausa (barra spaziatrice)">▶ Play</button>
        <button type="button" class="btn ghost" data-e="stop" data-tip="Ferma e riporta il cursore al punto di partenza">■ Stop</button>
        <button type="button" class="btn ghost" data-e="inizio" data-tip="Cursore all’inizio (tasto Inizio)">⏮</button>
        <button type="button" class="btn ghost" data-e="ciclo" aria-pressed="false" data-tip="Ripeti: l’ascolto ricomincia da capo finché non premi Stop">🔁</button>
        <output id="bnPosizione" aria-live="off"></output>
        <span class="bn-gruppo" id="bnStrumenti"></span>
        <span class="bn-gruppo bn-destra">
          <button type="button" class="btn small ghost" data-e="zoom" data-v="-1" data-tip="Rimpicciolisci (Ctrl + rotella)">−</button><button type="button" class="btn small ghost" data-e="zoom" data-v="1" data-tip="Ingrandisci (Ctrl + rotella)">+</button>
          <button type="button" class="btn small ghost" data-e="annulla" data-tip="Annulla (Ctrl+Z)">↶</button><button type="button" class="btn small ghost" data-e="ripeti" data-tip="Ripeti la modifica (Ctrl+Y)">↷</button>
          <button type="button" class="btn small ghost" data-e="ricomincia" data-tip="Torna com’era quando hai aperto">Ricomincia</button></span></div>
      <p class="bn-guida" id="cmGuida"></p>
      <div class="bn-campo bn-${tipo}" id="bnScorri" tabindex="0" aria-label="Timeline"><div class="bn-foglio" id="bnFoglio"></div></div>
      <div class="lt-tastiera bn-piano" id="bnPiano" aria-hidden="true">${tipo === 'forma' ? '' : L.tastiera([36, 95])}</div>
      <div class="cm-pannello" id="cmPannello"></div>
      <footer><ul class="cm-controlli" id="cmControlli" aria-live="polite"></ul><p class="err" id="cmErrore" role="alert"></p></footer></form>`;
    const f = finestra.querySelector('form');
    const q = (s) => f.querySelector(s);
    const scorri = q('#bnScorri'), foglio = q('#bnFoglio');
    const errore = (m) => { q('#cmErrore').textContent = m; };
    if (tipo === 'forma') q('#bnPiano').hidden = true;

    // ---------- misure ----------
    const ETICHETTE = conNote ? 74 : 0;
    const RIGA = tipo === 'richiamo' ? 18 : tipo === 'assolo' ? 30 : 64;
    const righe = tipo === 'richiamo' ? Array.from({ length: E.MAX - E.MIN + 1 }, (_, i) => E.MAX - i) : tipo === 'assolo' ? CORSIE_ASSOLO : ['ritmo'];
    const rigaDi = (n) => (tipo === 'richiamo' ? righe.indexOf(n.midi) : tipo === 'assolo' ? righe.indexOf(n.g) : 0);
    const pxIniziale = () => {
      const largo = (scorri.clientWidth || 800) - ETICHETTE - 4;
      // le voci brevi riempiono la larghezza; quelle lunghe mostrano quattro battute alla volta
      return tipo === 'forma' ? Math.max(0.25, largo / unita()) : Math.max(3, Math.min(48, largo / Math.min(unita(), 128)));
    };
    const px = () => zoom || (zoom = pxIniziale());

    // ---------- disegno ----------
    function disegnaFoglio() {
      const p = px(), largo = unita() * p;
      const pos = (u) => (u * p).toFixed(2);
      // righello: numeri di battuta e battiti
      const ogni = 32 * p < 34 ? 4 : 1;
      const righello = Array.from({ length: battute() }, (_, b) => `<span style="left:${pos(b * 32)}px;width:${pos(32)}px">${b % ogni === 0 ? b + 1 : ''}</span>`).join('');
      let corsie = '';
      if (conAccordi) {
        corsie += `<div class="bn-accordi">${stato.m.accordi.map((bar, b) => bar.map((a, k) => {
          const c = E.smonta(a), nome = E.nomeAccordo(c, tonica()), scelto = sel.c === 'a' && sel.b === b && sel.k === k;
          const note = [...new Set(E.noteAccordo(c, tonica()).slice(1).map((m) => E.NOTE[m % 12]))].join(' ');
          return `<button type="button" class="bn-accordo" data-ac="${b}:${k}" aria-pressed="${scelto}" aria-label="Battuta ${b + 1}, accordo ${esc(nome)}" style="left:${pos(b * 32 + (k * 32) / bar.length)}px;width:${pos(32 / bar.length)}px"><b>${esc(nome)}</b><span>${esc(a)}</span>${tipo === 'armonia' ? `<small>${esc(note)}</small>` : ''}</button>`;
        }).join('')).join('')}</div>`;
      }
      if (conNote) {
        const blocchi = stato.m.note.map((bar, b) => bar.map((n, i) => {
          const scelta = sel.c === 'n' && sel.b === b && sel.i === i;
          const testo = tipo === 'richiamo' ? E.nomeNota(n.midi) : tipo === 'assolo' ? E.durataTesto(n.d) : `${n.app ? '↘ ' : ''}${E.durataTesto(n.d)}${n.ant ? ' ⌒' : ''}`;
          return `<div class="bn-nota" data-n="${b}:${i}" tabindex="0" role="button" aria-pressed="${scelta}" aria-label="Battuta ${b + 1}, ${tipo === 'richiamo' ? E.nomeNota(n.midi) : tipo === 'assolo' ? GESTI[n.g][0] : 'nota'}, durata ${E.durataTesto(n.d)}" style="left:${pos(b * 32 + n.pos)}px;width:${pos(n.d)}px;top:${rigaDi(n) * RIGA}px;height:${RIGA}px"><span>${esc(testo)}</span><i data-maniglia></i></div>`;
        }).join('')).join('');
        const fondi = righe.map((r, i) => `<i class="bn-riga${tipo === 'richiamo' && NERI.has(r % 12) ? ' nera' : ''}${tipo === 'richiamo' && r % 12 === 0 ? ' do' : ''}" style="top:${i * RIGA}px;height:${RIGA}px"></i>`).join('');
        corsie += `<div class="bn-griglia" data-griglia style="height:${righe.length * RIGA}px;--passo:${pos(griglia)}px;--battito:${pos(8)}px;--battuta:${pos(32)}px">${fondi}<i class="bn-linee"></i>${blocchi}</div>`;
      }
      if (stato.m.sezioni) {
        let da = 0;
        corsie += `<div class="bn-sezioni">${stato.m.sezioni.map((s, i) => {
          const x = da; da += s.battute * 32;
          const finale = i === stato.m.sezioni.length - 1;
          return `<div class="bn-sezione ruolo-${s.ruolo}${s.priorita ? ' extra' : ''}" data-s="${i}" tabindex="0" role="button" aria-pressed="${sel.c === 's' && sel.i === i}" aria-label="${esc(E.SEZ[s.ruolo])}, ${s.battute} battute" style="left:${pos(x)}px;width:${pos(s.battute * 32)}px"><b>${esc(E.SEZ[s.ruolo])}</b><span>${s.battute} batt.</span><span>${s.priorita ? `extra ${s.priorita}` : 'sempre'}</span>${finale ? '' : '<i data-maniglia></i>'}</div>`;
        }).join('')}</div>`;
      }
      const etichette = conNote ? `<div class="bn-etichette" style="width:${ETICHETTE}px"><div class="bn-angolo"></div>${conAccordi ? '<div class="bn-nome-corsia">Accordi</div>' : ''}${righe.map((r) => `<div class="bn-etichetta${tipo === 'richiamo' && NERI.has(r % 12) ? ' nera' : ''}" data-r="${r}" style="height:${RIGA}px"${tipo === 'assolo' ? ` data-tip="${esc(GESTI[r].join(': '))}"` : ''}>${tipo === 'richiamo' ? E.nomeNota(r) : tipo === 'assolo' ? GESTI[r][0] : 'Ritmo'}</div>`).join('')}</div>` : '';
      foglio.innerHTML = `${etichette}<div class="bn-corpo" style="width:${largo}px"><div class="bn-righello" data-righello style="--battito:${pos(8)}px;--battuta:${pos(32)}px">${righello}</div>${corsie}<i class="bn-testa"></i></div>`;
      mostraCursore(ascolto ? ascolto.punto : cursore);
    }
    function mostraCursore(u) {
      const testa = foglio.querySelector('.bn-testa');
      if (testa) testa.style.left = u * px() + 'px';
      const b = Math.min(battute() - 1, Math.floor(u / 32));
      q('#bnPosizione').textContent = `Battuta ${b + 1} · battito ${Math.min(4, Math.floor((u - b * 32) / 8) + 1)}`;
    }

    // un gruppo di pulsanti: [chiave, etichetta, spiegazione, disattivato]
    const tasti = (etichetta, azione, voci, attivi) => `<div class="cm-riga" role="group" aria-label="${esc(etichetta)}"><span${AIUTI[etichetta] ? ` class="aiuto" tabindex="0" data-tip="${esc(AIUTI[etichetta])}"` : ''}>${esc(etichetta)}</span>${voci.map(([k, e, aiuto, no]) => `<button type="button" class="cm-tasto" data-e="${azione}" data-v="${esc(k)}" aria-pressed="${[].concat(attivi).map(String).includes(String(k))}"${aiuto ? ` data-tip="${esc(aiuto)}"` : ''}${no ? ' disabled' : ''}>${esc(e)}</button>`).join('')}</div>`;

    function disegnaDove() {
      const x = stato.meta, d = dati();
      const stili = d.stili.map((s) => [s.id, s.nome]);
      const nomeStile = (k) => (stili.find((s) => s[0] === k) || [k, k])[1];
      const parti = [], riassunto = [];
      if (tipo === 'armonia') { parti.push(tasti('Stile', 'm-stile', stili, x.stile), tasti('Parte', 'm-ruolo', Object.entries(d.ruoli), x.ruolo)); riassunto.push(nomeStile(x.stile), d.ruoli[x.ruolo]); }
      if (conAccordi) { parti.push(tasti('Modo', 'm-modo', MODI, x.modo)); riassunto.push(x.modo === 'm' ? 'Minore' : 'Maggiore'); }
      if (tipo === 'motivo') { parti.push(tasti('Andamento', 'm-andamento', Object.entries(d.andamenti), x.andamento)); riassunto.push(d.andamenti[x.andamento]); }
      if (tipo === 'richiamo' || tipo === 'forma') { parti.push(tasti('Stili (anche più di uno)', 'm-stili', stili, x.stili)); riassunto.push(x.stili.map(nomeStile).join(', ') || 'nessuno stile'); }
      if (!parti.length) { parti.push('<p class="muted">Vale per tutti gli stili: non c’è niente da scegliere.</p>'); riassunto.push('tutti gli stili'); }
      const usati = d.stili.filter((s) => (tipo === 'armonia' ? s.id === x.stile : tipo === 'motivo' ? s.andamento === x.andamento : tipo === 'richiamo' || tipo === 'forma' ? x.stili.includes(s.id) : true)).flatMap((s) => s.generi.map((g) => g.etichetta));
      parti.push(`<p class="muted cm-generi">Si sentirà in: ${esc([...new Set(usati)].join(', ') || 'nessun genere')}.</p>`);
      q('#bnRiassunto').textContent = `Dove si usa: ${riassunto.join(' · ')}`;
      q('#cmDove').innerHTML = parti.join('');
    }

    function disegnaStrumenti() {
      let out = '';
      if (conNote) out += `<span class="bn-etich" data-tip="La griglia a cui si agganciano note e cursore.">Griglia</span>${GRIGLIE.map(([v, t]) => `<button type="button" class="cm-tasto" data-e="griglia" data-v="${v}" aria-pressed="${v === griglia}">${t}</button>`).join('')}`;
      if (tipo === 'richiamo') out += `<button type="button" class="btn small ghost" data-e="battuta" data-v="piu" ${battute() >= 8 ? 'disabled' : ''} data-tip="Aggiunge una battuta dopo quella del cursore, copiandola">+ battuta</button><button type="button" class="btn small ghost" data-e="battuta" data-v="meno" ${battute() < 2 ? 'disabled' : ''} data-tip="Toglie la battuta in cui si trova il cursore">− battuta</button>`;
      if (tipo === 'forma') out += `<span class="bn-etich">Aggiungi</span>${Object.entries(E.SEZ).filter(([k]) => k !== 'finale').map(([k, n]) => `<button type="button" class="cm-tasto" data-e="aggiungi" data-v="${k}" ${stato.m.sezioni.length >= 16 ? 'disabled' : ''} data-tip="Aggiunge dopo la sezione scelta">+ ${esc(n)}</button>`).join('')}`;
      q('#bnStrumenti').innerHTML = out;
    }

    // ---------- proprietà dell'elemento scelto ----------
    const elemento = () => (sel.c === 'a' ? stato.m.accordi?.[sel.b]?.[sel.k] : sel.c === 'n' ? stato.m.note?.[sel.b]?.[sel.i] : stato.m.sezioni?.[sel.i]);
    function pannello() {
      const x = elemento();
      if (x === undefined) return `<p class="cm-scelta">${conNote ? 'Clicca in un punto vuoto della griglia per aggiungere una nota, oppure premi una nota per cambiarla.' : 'Premi un elemento sulla timeline.'}</p>`;
      if (sel.c === 'a') {
        const c = E.smonta(x), bar = stato.m.accordi[sel.b];
        const gradi = E.GRADI.map((g, i) => [i, `${E.NOTE[(tonica() + i) % 12]}`, `grado ${g}`]);
        return `<p class="cm-scelta">Accordo della battuta <b>${sel.b + 1}</b>${bar.length > 1 ? `, ${sel.k ? 'seconda' : 'prima'} metà` : ''}: <b>${esc(E.nomeAccordo(c, tonica()))}</b></p>`
          + tasti('Grado', 'a-semi', gradi, c.semi) + tasti('Tipo', 'a-tipo', E.TIPI.map((t) => [t[0], t[1]]), c.tipo)
          + tasti('Basso', 'a-basso', [['', 'come il grado'], ...gradi], c.basso === null ? '' : c.basso)
          + tasti('Battuta', 'a-fai', [['meta', bar.length > 1 ? 'Togli il secondo accordo' : 'Dividi in due accordi'], ['copia', 'Copia nella successiva', '', sel.b + 1 >= stato.m.accordi.length]], []);
      }
      if (sel.c === 'n') {
        const finoInFondo = x.pos + x.d === 32;
        let out = `<p class="cm-scelta">Battuta <b>${sel.b + 1}</b>, dal battito ${(x.pos / 8 + 1).toLocaleString('it-IT', { maximumFractionDigits: 2 })}: <b>${tipo === 'richiamo' ? E.nomeNota(x.midi) : tipo === 'assolo' ? GESTI[x.g][0] : 'nota'}</b> di ${E.durataTesto(x.d)} di battuta <button type="button" class="btn small danger" data-e="n-via" data-v="1" data-tip="Elimina la nota (tasto Canc o doppio clic)">Elimina</button></p>`;
        if (tipo === 'richiamo') {
          out += tasti('Nota', 'n-nota', E.NOTE.map((n, k) => [k, n]), x.midi % 12)
            + tasti('Ottava', 'n-ottava', [3, 4, 5, 6].map((o) => [o, String(o), o === 4 ? 'ottava centrale' : '', 12 * (o + 1) + (x.midi % 12) > E.MAX]), Math.floor(x.midi / 12) - 1);
        }
        if (tipo === 'assolo') out += tasti('Movimento', 'n-gesto', CORSIE_ASSOLO.map((k) => [k, GESTI[k][0], GESTI[k][1]]), x.g);
        out += tasti('Durata', 'n-durata', E.DURATE.map(([d, e]) => [d, e, x.pos + d > 32 ? 'Non entra nella battuta' : '', x.pos + d > 32]), x.d);
        if (tipo !== 'richiamo') out += tasti('Colore', 'n-colore', [['app', 'Appoggiatura ↘', 'La nota parte da quella sopra e scende'], ['ant', 'Anticipo ⌒', finoInFondo ? 'La nota si lega alla battuta dopo' : 'Solo per la nota che arriva in fondo alla battuta', !finoInFondo]], [x.app ? 'app' : '', x.ant && finoInFondo ? 'ant' : '']);
        return out;
      }
      const sez = stato.m.sezioni, i = sel.i, finale = i === sez.length - 1;
      return `<p class="cm-scelta">Sezione ${i + 1} di ${sez.length}: <b>${esc(E.SEZ[x.ruolo])}</b></p>`
        + (finale ? '<p class="muted cm-spiega">Il finale chiude sempre il brano: si può cambiare solo la sua lunghezza.</p>' : tasti('Tipo', 's-ruolo', Object.entries(E.SEZ).filter(([k]) => k !== 'finale'), x.ruolo))
        + tasti('Battute', 's-battute', [2, 4, 6, 8, 12, 16].map((n) => [n, String(n)]), x.battute)
        + (finale ? '' : tasti('Quando', 's-priorita', [[0, 'Sempre presente'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, `extra ${n}`, 'Entra se la durata lo permette: prima le extra col numero più basso'])], x.priorita)
          + tasti('Ordine', 's-fai', [['prima', '◀ Prima', '', i === 0], ['dopo', 'Dopo ▶', '', i >= sez.length - 2], ['meno', 'Togli', '', sez.length <= 3]], []));
    }

    // controlli: [ok, testo, obbligatorio]
    function controlli() {
      const x = stato.meta, m = stato.m, out = [];
      if (tipo === 'richiamo' || tipo === 'forma') out.push([!!x.nome.trim() && !/[<>]/.test(x.nome), 'Ha un nome (senza < o >)', true], [x.stili.length > 0, 'È scelto almeno uno stile', true]);
      if (tipo === 'armonia') {
        const diversi = new Set(m.accordi.flat()).size, ultimo = E.smonta(m.accordi.at(-1).at(-1));
        out.push([diversi >= 3, `Almeno tre accordi diversi (ora ${diversi})`, false]);
        if (x.ruolo === 'rit') out.push([ultimo.semi === 0, 'Il ritornello chiude sul I grado', false]);
        if (x.ruolo === 'strofa' || x.ruolo === 'pre') out.push([ultimo.semi !== 0, 'Finisce aperto (non sul I grado), così porta avanti', false]);
      }
      if (m.note) {
        const vuote = m.note.map((b, i) => (b.length ? 0 : i + 1)).filter(Boolean);
        out.push([!vuote.length, vuote.length ? `La battuta ${vuote.join(', ')} è vuota: serve almeno una nota` : 'Ogni battuta ha almeno una nota', true]);
        const ultima = m.note.at(-1).at(-1);
        if (tipo === 'cadenza' && ultima) out.push([ultima.d >= 12, 'Finisce con una nota lunga', false]);
        if (tipo === 'motivo') out.push([m.note.some((b) => b.reduce((a, n) => a + n.d, 0) < 32 || b.some((n) => n.d >= 12)), 'C’è un respiro: una pausa o una nota lunga', false]);
      }
      if (m.sezioni) {
        const fisse = m.sezioni.filter((s) => s.priorita === 0);
        out.push([m.sezioni.length >= 3, 'Almeno tre sezioni', true], [fisse.length >= 2, 'Almeno due sezioni sempre presenti', true], [m.sezioni.some((s) => s.ruolo === 'rit'), 'C’è un ritornello', false]);
      }
      return out;
    }
    function disegnaControlli() {
      const lista = controlli();
      q('#cmControlli').innerHTML = lista.map(([ok, t, obbligo]) => `<li class="${ok ? 'ok' : obbligo ? 'no' : 'nota'}">${ok ? '✓' : obbligo ? '✗' : '○'} ${esc(t)}${!ok && !obbligo ? ' <small>(consiglio)</small>' : ''}</li>`).join('');
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
      if (sel.c === 'a') { sel.b = Math.min(sel.b, stato.m.accordi.length - 1); sel.k = Math.min(sel.k, stato.m.accordi[sel.b].length - 1); }
      if (sel.c === 's') sel.i = Math.min(sel.i, stato.m.sezioni.length - 1);
      cursore = Math.min(cursore, unita() - 1);
      disegnaDove(); disegnaStrumenti(); disegnaFoglio();
      q('#cmPannello').innerHTML = pannello();
      q('#cmGuida').textContent = {
        armonia: 'Clicca sul righello per spostare il cursore. Premi un accordo e cambialo coi pulsanti in basso.',
        forma: 'Trascina una sezione per spostarla, tira il suo bordo destro per allungarla. Clicca sul righello per il cursore.',
        richiamo: 'Clic su un punto vuoto: nuova nota. Trascina per spostarla, tira il bordo destro per allungarla, doppio clic per toglierla.',
        assolo: 'Ogni riga è un movimento. Clic: nuova nota; trascina su un’altra riga per cambiare movimento; doppio clic per toglierla.',
      }[tipo] || 'Clic su un punto vuoto: nuova nota. Trascina per spostarla, tira il bordo destro per allungarla, doppio clic per toglierla.';
      q('[data-e="annulla"]').disabled = !annulla.length;
      q('[data-e="ripeti"]').disabled = !ripeti.length;
      disegnaControlli();
      if (fuoco) f.querySelector(fuoco)?.focus({ preventScroll: true });
    }
    const ricorda = (prima) => { if (JSON.stringify(stato) !== prima) { annulla.push(prima); ripeti.length = 0; if (annulla.length > 100) annulla.shift(); } };
    // ogni modifica passa di qui: si può annullare, e l'ascolto si ferma
    function cambia(fn, fuoco) {
      ferma(); errore('');
      const prima = JSON.stringify(stato);
      fn();
      ricorda(prima);
      disegnaTutto(fuoco);
    }
    const storia = (da, a) => { if (!da.length) return; ferma(); a.push(JSON.stringify(stato)); stato = JSON.parse(da.pop()); disegnaTutto(); };

    function senti(x) {
      if (sel.c === 'a') assaggia(E.noteAccordo(E.smonta(x), tonica()));
      else if (tipo === 'richiamo' && x) assaggia([x.midi]);
    }
    // sostituisce la nota scelta (togliendola e posandola di nuovo) e la lascia selezionata
    function sposta(note, da, nuova) {
      const [b, i] = da;
      const n = { ...note[b][i], ...nuova };
      const bar = nuova.bar ?? b;
      delete n.bar;
      note[b] = note[b].filter((_, k) => k !== i);
      note[bar] = E.posa(note[bar], n);
      sel = { c: 'n', b: bar, i: note[bar].indexOf(n) };
      return n;
    }

    const azioni = {
      a: (campo, v) => {
        const accordi = stato.m.accordi, { b, k } = sel;
        if (campo === 'fai') {
          if (v === 'meta') { if (accordi[b].length > 1) accordi[b].pop(); else accordi[b].push(accordi[b][0]); sel = { c: 'a', b, k: accordi[b].length - 1 }; }
          else { accordi[b + 1] = [...accordi[b]]; sel = { c: 'a', b: b + 1, k: 0 }; }
          return;
        }
        const c = E.smonta(accordi[b][k]);
        c[campo] = campo === 'tipo' ? v : v === '' ? null : Number(v);
        accordi[b][k] = E.monta(c);
        senti(accordi[b][k]);
      },
      n: (campo, v) => {
        const x = elemento();
        if (!x) return;
        if (campo === 'via') { stato.m.note[sel.b].splice(sel.i, 1); sel = { c: 'n', b: sel.b, i: Math.max(0, sel.i - 1) }; }
        else if (campo === 'durata') sposta(stato.m.note, [sel.b, sel.i], { d: Number(v) });
        else if (campo === 'gesto') x.g = v;
        else if (campo === 'colore') x[v] = !x[v];
        else {
          const midi = campo === 'nota' ? x.midi - (x.midi % 12) + Number(v) : 12 * (Number(v) + 1) + (x.midi % 12);
          x.midi = Math.max(E.MIN, Math.min(E.MAX, midi));
          senti(x);
        }
      },
      s: (campo, v) => {
        const sez = stato.m.sezioni, i = sel.i;
        if (campo === 'ruolo') sez[i].ruolo = v;
        else if (campo !== 'fai') sez[i][campo] = Number(v);
        else if (v === 'meno') sez.splice(i, 1);
        else { const j = i + (v === 'prima' ? -1 : 1); [sez[i], sez[j]] = [sez[j], sez[i]]; sel = { c: 's', i: j }; }
      },
    };

    // ---------- riproduzione ----------
    function ferma(resta) {
      if (!ascolto) return;
      const a = ascolto;
      ascolto = null;
      cancelAnimationFrame(a.quadro);
      a.ctx.close().catch(() => {});
      if (resta !== undefined) cursore = resta;
      q('[data-e="play"]').textContent = '▶ Play';
      f.querySelectorAll('.bn-nota.suona, .bn-accordo.suona, .bn-sezione.suona, .bn-etichetta.suona, .bn-piano i').forEach((x) => x.classList.remove('suona', 'suona-melodia', 'suona-accordo'));
      mostraCursore(cursore);
    }
    async function suona() {
      if (ascolto) return ferma(Math.round(ascolto.punto)); // pausa: il cursore resta dove sei arrivato
      errore('');
      fermaAscolto(); pausaLettore();
      const tasto = q('[data-e="play"]');
      if (tasto.disabled) return;
      tasto.disabled = true;
      let score;
      try {
        const r = await invia('/api/composizione/prova', voce());
        score = A.leggiAbc(r.abc).score;
        if (!score) throw new Error('non riesco a leggere la prova');
      } catch (e) { errore(e.message); return; } finally { tasto.disabled = false; }
      if (!aperto) return;
      avvia(L.eventi(score), cursore);
    }
    // da = punto di partenza sulla timeline; la prova di una voce breve la ripete: si ascolta il primo giro
    function avvia(ev, da) {
      const secondiUnita = ev.battute[0].durata / 32;
      const fine = Math.min(unita() * secondiUnita, ev.totale);
      const t0 = Math.min(da * secondiUnita, fine - 0.05);
      const ctx = new AudioContext();
      const inizio = ctx.currentTime + 0.12 - t0;
      L.programma(ctx, ev, inizio, t0, fine);
      const a = (ascolto = { ctx, ev, inizio, da, punto: da, quadro: 0 });
      q('[data-e="play"]').textContent = '❚❚ Pausa';
      let ultimo = '';
      const segui = () => {
        if (ascolto !== a) return;
        const t = L.tempoUdibile(ctx, performance.now()) - inizio - L.leggiSincronia() / 1000;
        if (t >= fine) {
          if (!ciclo) return ferma();
          ctx.close().catch(() => {}); ascolto = null;
          return avvia(ev, 0);
        }
        a.punto = Math.max(da, t / secondiUnita);
        mostraCursore(a.punto);
        // la timeline segue la riga, a meno che tu non la stia scorrendo
        const x = a.punto * px(), vista = scorri.clientWidth - ETICHETTE;
        if (performance.now() - mossaUtente > 1500 && (x < scorri.scrollLeft || x > scorri.scrollLeft + vista * 0.85)) scorri.scrollLeft = Math.max(0, x - vista * 0.15);
        const p = L.posizione(ev, Math.max(0, t));
        const chiave = `${p.battuta}.${p.nota}.${p.accordo}`;
        if (chiave !== ultimo) { ultimo = chiave; accendi(ev, p, a.punto); }
        a.quadro = requestAnimationFrame(segui);
      };
      segui();
    }
    function accendi(ev, p, punto) {
      f.querySelectorAll('.suona, .bn-piano i').forEach((x) => x.classList.remove('suona', 'suona-melodia', 'suona-accordo'));
      const { melodia, accordo } = L.tastiDi(ev, p);
      for (const m of accordo) q(`.bn-piano [data-k="${m}"]`)?.classList.add('suona-accordo');
      if (melodia !== null) {
        q(`.bn-piano [data-k="${melodia}"]`)?.classList.add('suona-melodia');
        if (tipo === 'richiamo') q(`.bn-etichetta[data-r="${melodia}"]`)?.classList.add('suona');
      }
      const b = Math.floor(punto / 32), dentro = punto - b * 32;
      const bar = stato.m.accordi?.[b];
      if (bar) q(`[data-ac="${b}:${Math.min(bar.length - 1, Math.floor((dentro / 32) * bar.length))}"]`)?.classList.add('suona');
      const i = stato.m.note?.[b]?.findIndex((n) => dentro >= n.pos && dentro < n.pos + n.d);
      if (i >= 0) q(`[data-n="${b}:${i}"]`)?.classList.add('suona');
      if (stato.m.sezioni) {
        let da = 0;
        const s = stato.m.sezioni.findIndex((x) => { da += x.battute * 32; return punto < da; });
        q(`[data-s="${s}"]`)?.classList.add('suona');
      }
    }
    const portaCursore = (u) => {
      const nuovo = Math.max(0, Math.min(unita() - 1, u));
      if (ascolto) { const { ev } = ascolto; ferma(); cursore = nuovo; avvia(ev, nuovo); } else { cursore = nuovo; mostraCursore(cursore); }
    };

    // ---------- mouse e dita sulla timeline ----------
    const corpo = () => foglio.querySelector('.bn-corpo');
    const unitaSotto = (e) => (e.clientX - corpo().getBoundingClientRect().left) / px();
    const aggancia = (u, passo = griglia) => Math.round(u / passo) * passo;
    const cellaSotto = (e) => {
      const g = foglio.querySelector('[data-griglia]');
      const u = Math.max(0, Math.min(unita() - 1, unitaSotto(e)));
      const riga = Math.max(0, Math.min(righe.length - 1, Math.floor((e.clientY - g.getBoundingClientRect().top) / RIGA)));
      return { u, riga };
    };
    const dellaRiga = (riga) => (tipo === 'richiamo' ? { midi: righe[riga] } : tipo === 'assolo' ? { g: righe[riga] } : {});
    function nuovaNota(e) {
      const { u, riga } = cellaSotto(e);
      const b = Math.floor(u / 32);
      const pos = Math.min(32 - griglia, Math.floor((u - b * 32) / griglia) * griglia);
      const n = { pos, d: griglia, app: false, ant: false, ...dellaRiga(riga) };
      stato.m.note[b] = E.posa(stato.m.note[b], n);
      sel = { c: 'n', b, i: stato.m.note[b].indexOf(n) };
      senti(n);
      return n;
    }
    foglio.onpointerdown = (e) => {
      if (e.button) return;
      if (e.target.closest('[data-righello]')) {
        trascina = { modo: 'cursore' };
        portaCursore(aggancia(unitaSotto(e), conNote ? griglia : 8));
      } else if (e.target.closest('[data-n]')) {
        const [b, i] = e.target.closest('[data-n]').dataset.n.split(':').map(Number);
        ferma();
        sel = { c: 'n', b, i };
        const n = stato.m.note[b][i];
        trascina = { modo: e.target.closest('[data-maniglia]') ? 'lunghezza' : 'nota', prima: JSON.stringify(stato), da: [b, i], presa: unitaSotto(e) - (b * 32 + n.pos), x: e.clientX, y: e.clientY };
        senti(n);
        disegnaTutto();
      } else if (e.target.closest('[data-s]')) {
        const i = Number(e.target.closest('[data-s]').dataset.s);
        ferma();
        sel = { c: 's', i };
        trascina = { modo: e.target.closest('[data-maniglia]') ? 'durata' : 'sezione', prima: JSON.stringify(stato), i, x: e.clientX };
        disegnaTutto();
      } else if (e.target.closest('[data-griglia]') && e.pointerType !== 'touch') {
        // con il mouse la nota nasce subito e trascinando la si allunga; col dito il trascinamento scorre
        ferma(); errore('');
        const prima = JSON.stringify(stato);
        const n = nuovaNota(e);
        trascina = { modo: 'lunghezza', prima, base: JSON.stringify(stato), da: [sel.b, sel.i], minimo: n.d, x: e.clientX, y: e.clientY };
        disegnaTutto();
      } else return;
      e.preventDefault();
      scorri.focus({ preventScroll: true });
      try { foglio.setPointerCapture(e.pointerId); } catch (x) { /* il puntatore non c'è più */ }
    };
    foglio.onpointermove = (e) => {
      if (!trascina) return;
      const t = trascina;
      if (t.modo === 'cursore') { if (!ascolto) portaCursore(aggancia(unitaSotto(e), conNote ? griglia : 8)); return; }
      if (Math.abs(e.clientX - t.x) < 3 && Math.abs(e.clientY - t.y) < 3 && !t.mosso) return;
      t.mosso = true;
      // si riparte ogni volta dallo stato di inizio gesto: passando sopra altre note non le si consuma
      stato = JSON.parse(t.base || t.prima);
      if (t.modo === 'nota') {
        const { riga } = cellaSotto(e);
        const n = stato.m.note[t.da[0]][t.da[1]];
        const u = Math.max(0, aggancia(unitaSotto(e) - t.presa));
        const bar = Math.min(battute() - 1, Math.floor(u / 32));
        sposta(stato.m.note, t.da, { bar, pos: Math.max(0, Math.min(32 - n.d, u - bar * 32)), ...dellaRiga(riga) });
      } else if (t.modo === 'lunghezza') {
        const [b, i] = t.da;
        const n = stato.m.note[b][i];
        const fine = aggancia(unitaSotto(e) - b * 32);
        sposta(stato.m.note, t.da, { d: Math.max(t.minimo || Math.min(griglia, n.d), Math.min(32 - n.pos, fine - n.pos)) });
      } else if (t.modo === 'durata') {
        const s = stato.m.sezioni[t.i];
        s.battute = Math.max(2, Math.min(16, aggancia(s.battute + (e.clientX - t.x) / (32 * px()), 2)));
      } else if (t.modo === 'sezione') {
        // la sezione va dove si trova il puntatore; il finale resta in coda
        const sez = stato.m.sezioni;
        if (t.i === sez.length - 1) return;
        const u = unitaSotto(e);
        let da = 0, j = 0;
        while (j < sez.length - 2 && u > da + sez[j].battute * 32) { da += sez[j].battute * 32; j++; }
        sez.splice(j, 0, ...sez.splice(t.i, 1));
        sel = { c: 's', i: j };
      }
      disegnaFoglio();
    };
    const molla = () => {
      const t = trascina;
      trascina = null;
      if (!t || !t.prima) return;
      ricorda(t.prima);
      if (t.mosso && t.modo === 'nota') senti(elemento());
      disegnaTutto();
    };
    foglio.onpointerup = molla;
    foglio.onpointercancel = molla;
    foglio.ondblclick = (e) => {
      const n = e.target.closest('[data-n]');
      if (!n) return;
      const [b, i] = n.dataset.n.split(':').map(Number);
      cambia(() => { stato.m.note[b].splice(i, 1); sel = { c: 'n', b, i: Math.max(0, i - 1) }; });
    };
    scorri.onwheel = (e) => {
      mossaUtente = performance.now();
      if (e.ctrlKey) { e.preventDefault(); return ingrandisci(e.deltaY < 0 ? 1 : -1); }
      // dove non c'è da scorrere in altezza, la rotella scorre lungo il tempo
      if (scorri.scrollHeight <= scorri.clientHeight + 2 && !e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); scorri.scrollLeft += e.deltaY; }
    };
    scorri.onscroll = () => { if (!ascolto) mossaUtente = performance.now(); };
    scorri.addEventListener('pointerdown', () => { mossaUtente = performance.now(); });
    function ingrandisci(verso) {
      const centro = (scorri.scrollLeft + scorri.clientWidth / 2 - ETICHETTE) / px();
      zoom = Math.max(0.2, Math.min(40, px() * (verso > 0 ? 1.3 : 1 / 1.3)));
      disegnaFoglio();
      scorri.scrollLeft = centro * zoom - scorri.clientWidth / 2 + ETICHETTE;
    }

    // ---------- pulsanti ----------
    f.onclick = (e) => {
      const accordo = e.target.closest('[data-ac]');
      if (accordo) {
        const [b, k] = accordo.dataset.ac.split(':').map(Number);
        ferma();
        sel = { c: 'a', b, k };
        cursore = b * 32 + (k * 32) / stato.m.accordi[b].length;
        disegnaTutto(`[data-ac="${b}:${k}"]`);
        return senti(elemento());
      }
      // un clic col dito su un punto vuoto aggiunge la nota
      if (e.pointerType === 'touch' && e.target.closest('[data-griglia]') && !e.target.closest('[data-n]')) return cambia(() => nuovaNota(e));
      const t = e.target.closest('[data-e]');
      if (!t) return;
      const { e: azione, v } = t.dataset;
      if (azione === 'play') return suona();
      if (azione === 'stop') return ferma(ascolto ? ascolto.da : undefined);
      if (azione === 'inizio') { scorri.scrollLeft = 0; return portaCursore(0); }
      if (azione === 'ciclo') { ciclo = !ciclo; return t.setAttribute('aria-pressed', String(ciclo)); }
      if (azione === 'zoom') return ingrandisci(Number(v));
      if (azione === 'griglia') { griglia = Number(v); disegnaStrumenti(); return disegnaFoglio(); }
      if (azione === 'annulla') return storia(annulla, ripeti);
      if (azione === 'ripeti') return storia(ripeti, annulla);
      if (azione === 'ricomincia') return cambia(() => { stato = copia(iniziale); cursore = 0; });
      if (azione === 'chiudi') return finestra.close();
      const fuoco = `[data-e="${azione}"][data-v="${CSS.escape(v || '')}"]`;
      if (azione === 'battuta') {
        return cambia(() => {
          const b = Math.floor(cursore / 32);
          if (v === 'piu') { stato.m.note.splice(b + 1, 0, copia(stato.m.note[b])); stato.m.accordi.splice(b + 1, 0, [...stato.m.accordi[b]]); cursore = (b + 1) * 32; }
          else { stato.m.note.splice(b, 1); stato.m.accordi.splice(b, 1); cursore = Math.max(0, b - 1) * 32; }
          sel = { c: 'n', b: Math.floor(cursore / 32), i: 0 };
        });
      }
      if (azione === 'aggiungi') {
        return cambia(() => {
          const sez = stato.m.sezioni, dove = Math.min((sel.c === 's' ? sel.i : sez.length - 2) + 1, sez.length - 1);
          sez.splice(dove, 0, { ruolo: v, battute: v === 'pre' || v === 'gancio' ? 4 : 8, priorita: 0 });
          sel = { c: 's', i: dove };
        });
      }
      const [gruppo, campo] = azione.split('-');
      if (gruppo === 'm') {
        return cambia(() => {
          if (campo === 'stili') stato.meta.stili = stato.meta.stili.includes(v) ? stato.meta.stili.filter((s) => s !== v) : [...stato.meta.stili, v];
          else stato.meta[campo] = v;
        }, fuoco);
      }
      return cambia(() => azioni[gruppo](campo, v), fuoco);
    };
    const nome = q('[name="nome"]');
    if (nome) nome.oninput = () => { stato.meta.nome = nome.value; disegnaControlli(); };

    // ---------- tastiera: spazio play, frecce spostano, Maiusc + frecce allungano, Canc elimina ----------
    f.onkeydown = (e) => {
      if (e.target.closest('input')) { if (e.key === 'Enter') e.preventDefault(); return; }
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(k.toLowerCase())) { e.preventDefault(); return k.toLowerCase() === 'z' ? storia(annulla, ripeti) : storia(ripeti, annulla); }
      if (k === ' ') { e.preventDefault(); return suona(); }
      if (k === 'Home') { e.preventDefault(); scorri.scrollLeft = 0; return portaCursore(0); }
      const sulFoglio = e.target.closest('#bnScorri');
      if (!sulFoglio) return;
      const freccia = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      const x = elemento();
      if (sel.c === 'n' && x && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); return cambia(() => azioni.n('via')); }
      if (sel.c === 'n' && x && freccia) {
        e.preventDefault();
        const [dx, dy] = freccia;
        return cambia(() => {
          if (dx && e.shiftKey) return sposta(stato.m.note, [sel.b, sel.i], { d: Math.max(1, Math.min(32 - x.pos, x.d + dx * griglia)) });
          if (dx) {
            const u = Math.max(0, Math.min(unita() - x.d, sel.b * 32 + x.pos + dx * griglia)), bar = Math.floor(u / 32);
            return sposta(stato.m.note, [sel.b, sel.i], { bar, pos: Math.min(32 - x.d, u - bar * 32) });
          }
          if (tipo === 'richiamo') { x.midi = Math.max(E.MIN, Math.min(E.MAX, x.midi - dy)); senti(x); }
          else if (tipo === 'assolo') x.g = righe[Math.max(0, Math.min(righe.length - 1, rigaDi(x) + dy))];
          return null;
        });
      }
      if (freccia && freccia[0]) { e.preventDefault(); portaCursore(cursore + freccia[0] * (conNote ? griglia : 8)); }
      return null;
    };
    // la finestra resta aperta finché il salvataggio non riesce
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!e.submitter || e.submitter.value !== 'ok') return;
      try { await invia('/api/composizione/salva', voce()); finestra.close(); toast('Salvato: vale dal prossimo brano'); await salvato(tipo); }
      catch (x) { errore(x.message); }
    };
    // Esc non butta via il lavoro
    finestra.oncancel = (e) => { if (cambiata()) { e.preventDefault(); errore('Ci sono modifiche non salvate: premi «Salva» oppure «Esci senza salvare».'); } };
    finestra.onclose = () => { if (!f.isConnected) return; aperto = false; ferma(); finestra.oncancel = null; };

    finestra.showModal();
    disegnaTutto();
    // la griglia delle note si apre all'altezza delle note scritte
    if (tipo === 'richiamo') {
      const midi = stato.m.note.flat().map((n) => n.midi);
      const centro = midi.length ? (Math.min(...midi) + Math.max(...midi)) / 2 : 60;
      scorri.scrollTop = (E.MAX - centro) * RIGA - (scorri.clientHeight - 80) / 2;
    }
    scorri.focus({ preventScroll: true });
  }

  return { apri };
};
