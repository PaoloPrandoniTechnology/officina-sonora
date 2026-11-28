// Lettore della dashboard: riproduzione, coda, preferiti, playlist e lettore a tutto schermo.
// La logica della coda è in coda.js; playlist e preferiti stanno nel gateway (playlist.js).
// Cronologia e impostazioni di ascolto restano nel browser.
window.Lettore = function (app) {
  'use strict';
  const { $, esc, ic, imposta, copertina, tastoAscolta, titoloBrano, stelle, nm, toast, chiedi, invia, leggi, alPasso, orologio } = app;
  const C = window.Coda;
  const box = $('#player');
  const au = [$('#pAudio'), $('#pAudio2')]; // due: durante una dissolvenza suonano insieme
  let att = 0;
  const attivo = () => au[att];

  const ricorda = (chiave, valore) => { try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { /* solo per questa visita */ } };
  const ricordato = (chiave) => { try { return JSON.parse(localStorage.getItem(chiave)); } catch (e) { return null; } };

  const salvato = ricordato('lettore');
  const s = C.ripristina(salvato && salvato.s);
  const opz = { volume: 100, muto: false, dissolvi: 0, restante: false, ...ricordato('lettoreOpzioni') };
  let ascoltati = [].concat(ricordato('ascoltati') || []).filter((x) => x && Number.isInteger(x.n));
  let brano = null;          // scheda del brano caricato nel lettore
  const cache = new Map();   // brani letti uno alla volta, prima che arrivi la libreria
  let pl = { preferiti: [], playlist: [] }, plErrore = '';
  let aperta = null;         // playlist mostrata nella pagina Playlist (null: indice)
  let timer = null;          // spegnimento: { fine } oppure { brano: true }
  let sfuma = null;          // dissolvenza in corso
  let richiesta = 0, errori = 0, contato = false, salvatoAlle = 0;
  let codaAperta = false, grande = false, vistaCoda = 'coda';
  let titoloPagina = document.title;

  const info = (n) => app.trovaBrano(n) || cache.get(n) || null;
  const esistono = (numeri) => (app.pronto() ? numeri.filter((n) => app.trovaBrano(n)) : numeri);
  const durataTot = (numeri) => {
    const m = Math.round(numeri.reduce((a, n) => a + ((info(n) || {}).durata_s || 0), 0) / 60);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  };
  const quanti = (n) => (n === 1 ? '1 brano' : n + ' brani');
  const tasto = (attr, icona, nome, extra = '') => `<button type="button" class="tasto-riga ${extra}" ${attr} aria-label="${esc(nome)}" data-tip="${esc(nome.split(':')[0])}">${ic(icona)}</button>`;

  // ---------- audio ----------
  const sfumaSpegnimento = () => (timer && timer.fine ? Math.max(0, Math.min(1, (timer.fine - Date.now()) / 20000)) : 1);
  function volume() {
    const v = (opz.muto ? 0 : opz.volume / 100) * sfumaSpegnimento();
    // potenza costante: il volume percepito non cala a metà dissolvenza
    const q = sfuma ? Math.min(1, (Date.now() - sfuma.inizio) / sfuma.durata) : 1;
    attivo().volume = v * Math.sin(q * Math.PI / 2);
    if (sfuma) sfuma.da.volume = v * Math.cos(q * Math.PI / 2);
  }
  const svuota = (a) => { a.pause(); a.removeAttribute('src'); a.load(); };
  function fineSfuma() {
    if (!sfuma) return;
    clearInterval(sfuma.orologio);
    svuota(sfuma.da);
    sfuma = null;
    volume();
  }

  function salva() {
    ricorda('lettore', { s, aperto: !box.hidden, posizione: attivo().currentTime || 0 });
  }

  async function carica(n, { parti = true, dissolvi = false, da = 0 } = {}) {
    if (n === null || n === undefined) return;
    const giro = ++richiesta;
    let b = info(n);
    if (!b) {
      try { b = await leggi('/api/brano?n=' + n); cache.set(n, b); }
      catch (e) {
        if (giro !== richiesta) return;
        if (!parti) return chiudi();
        toast('Brano non trovato', 'err');
        return guasto();
      }
    }
    if (giro !== richiesta) return;
    fineSfuma();
    const prima = attivo();
    if (dissolvi && !prima.paused) {
      att = 1 - att;
      sfuma = { da: prima, inizio: Date.now(), durata: opz.dissolvi * 1000, orologio: setInterval(() => { volume(); if (Date.now() - sfuma.inizio >= sfuma.durata) fineSfuma(); }, 100) };
    }
    const a = attivo();
    brano = b;
    contato = false;
    box.hidden = false;
    document.body.classList.add('suona');
    a.preload = parti ? 'auto' : 'metadata';
    a.src = '/audio/brano?n=' + encodeURIComponent(n);
    if (da > 0) a.addEventListener('loadedmetadata', () => { if (a.src.endsWith('?n=' + n)) a.currentTime = da; }, { once: true });
    volume();
    if (parti) a.play().catch(() => {});
    mostraTempo();
    sessione();
    disegna();
    salva();
  }
  // un file che non si apre non ferma l'ascolto; dopo tre di fila ci si arrende
  function guasto() {
    if (++errori >= 3) { errori = 0; return; }
    const n = C.avanti(s, false);
    if (n !== null) carica(n);
  }

  function commuta() {
    const a = attivo();
    if (!a.getAttribute('src')) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }
  function successivo() {
    const n = C.avanti(s, false);
    if (n !== null) carica(n);
  }
  function precedente() {
    const a = attivo();
    // come nei lettori musicali: a brano avviato si torna all'inizio, subito dopo si torna al precedente
    const n = a.currentTime > 3 ? null : C.indietro(s);
    if (n === null) { fineSfuma(); a.currentTime = 0; return; }
    carica(n);
  }
  const cerca = (secondi) => { const a = attivo(); if (a.duration) { fineSfuma(); a.currentTime = Math.max(0, Math.min(a.duration, secondi)); } };

  function chiudi() {
    richiesta++;
    ingrandisci(false);
    apriCoda(false);
    fineSfuma();
    au.forEach(svuota);
    brano = null;
    s.corrente = null;
    timer = null;
    box.hidden = true;
    $('#pCoda').hidden = true;
    document.body.classList.remove('suona');
    evidenza.textContent = '';
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
    document.title = titoloPagina;
    salva();
  }

  function mostraTempo() {
    const a = attivo(), barra = $('#pBarra');
    const d = a.duration || (brano && brano.durata_s) || 0;
    const t = a.currentTime || 0;
    $('#pOra').textContent = orologio(t);
    $('#pFine').textContent = opz.restante ? '-' + orologio(Math.max(0, d - t)) : orologio(d);
    const p = d ? Math.min(1, t / d) : 0;
    barra.value = Math.round(p * 1000);
    barra.style.setProperty('--p', p * 100 + '%');
    barra.setAttribute('aria-valuetext', orologio(t) + ' di ' + orologio(d));
  }

  function registraAscolto() {
    ascoltati = [{ n: s.corrente, t: Date.now() }, ...ascoltati.filter((x) => x.n !== s.corrente)].slice(0, 100);
    ricorda('ascoltati', ascoltati);
    disegnaCoda();
  }

  const suAttivo = (evento, fn) => au.forEach((a) => a.addEventListener(evento, () => { if (a === attivo()) fn(a); }));
  suAttivo('play', () => { $('#vAudio').pause(); disegnaTasto(); });
  suAttivo('playing', () => { errori = 0; });
  suAttivo('pause', () => { fineSfuma(); disegnaTasto(); salva(); });
  suAttivo('durationchange', (a) => { mostraTempo(); posizioneSessione(a); });
  suAttivo('seeked', (a) => { posizioneSessione(a); salva(); });
  suAttivo('error', (a) => { if (a.getAttribute('src')) { toast('Impossibile riprodurre: ' + (brano ? brano.titolo : 'brano'), 'err'); guasto(); } });
  suAttivo('ended', () => {
    if (timer && timer.brano) { timer = null; disegna(); return toast('Timer: ascolto fermato alla fine del brano'); }
    const n = C.avanti(s, true);
    if (n !== null) carica(n); else disegnaTasto();
  });
  suAttivo('timeupdate', (a) => {
    mostraTempo();
    if (a.paused) return;
    if (!contato && a.currentTime >= Math.min(20, (a.duration || 40) / 2)) { contato = true; registraAscolto(); }
    if (Date.now() - salvatoAlle > 5000) { salvatoAlle = Date.now(); salva(); }
    // dissolvenza: il successivo parte mentre questo sfuma
    if (opz.dissolvi && !sfuma && !(timer && timer.brano) && a.duration > opz.dissolvi * 3 && a.duration - a.currentTime <= opz.dissolvi) {
      const n = C.avanti(s, true);
      if (n !== null) carica(n, { dissolvi: true });
    }
  });

  // tasti multimediali, schermata di blocco e controlli di Windows
  function sessione() {
    if (!('mediaSession' in navigator) || !brano) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: brano.titolo, artist: 'Officina Sonora', album: nm(brano.categoria),
      artwork: [{ src: location.origin + '/api/copertina?n=' + brano.numero, sizes: '512x512', type: 'image/jpeg' }],
    });
  }
  function posizioneSessione(a) {
    if (!('mediaSession' in navigator) || !Number.isFinite(a.duration) || !a.duration) return;
    try { navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate }); } catch (e) { /* non disponibile */ }
  }
  if ('mediaSession' in navigator) {
    const azioni = {
      play: () => attivo().play().catch(() => {}), pause: () => attivo().pause(), previoustrack: precedente, nexttrack: successivo,
      seekbackward: (d) => cerca(attivo().currentTime - (d.seekOffset || 10)), seekforward: (d) => cerca(attivo().currentTime + (d.seekOffset || 10)),
      seekto: (d) => cerca(d.seekTime),
    };
    for (const [k, fn] of Object.entries(azioni)) { try { navigator.mediaSession.setActionHandler(k, fn); } catch (e) { /* tasto non gestito */ } }
  }

  // ---------- barra del lettore ----------
  const evidenza = document.head.appendChild(document.createElement('style')); // segna il brano in ascolto negli elenchi
  function disegnaTitolo() {
    document.title = brano && !attivo().paused ? `▶ ${brano.titolo} · Officina Sonora` : titoloPagina;
  }
  function disegnaTasto() {
    const fermo = attivo().paused;
    imposta('#pPlay', ic(fermo ? 'play' : 'pausa'));
    $('#pPlay').setAttribute('aria-label', fermo ? 'Ascolta' : 'Metti in pausa l\'ascolto');
    box.classList.toggle('fermo', fermo);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = brano ? (fermo ? 'paused' : 'playing') : 'none';
    disegnaTitolo();
  }
  const premuto = (id, si, nome) => {
    const b = $(id);
    b.setAttribute('aria-pressed', String(si));
    if (nome) { b.setAttribute('aria-label', nome); b.dataset.tip = nome; }
  };
  const RIPETI = { no: 'Ripeti: spento', tutti: 'Ripeti: tutto l\'elenco', uno: 'Ripeti: questo brano' };
  function disegnaResta() {
    const t = !timer ? '' : timer.brano ? 'fine brano' : Math.max(1, Math.ceil((timer.fine - Date.now()) / 60000)) + ' min';
    $('#pResta').textContent = t;
    $('#pOpzioni').classList.toggle('acceso', !!timer || !!opz.dissolvi);
  }
  function disegna() {
    if (!brano) return;
    const n = brano.numero;
    imposta('#pCop', copertina(brano));
    $('#pTit').textContent = brano.titolo;
    $('#pSub').textContent = nm(brano.categoria) + (s.daCoda ? ', dalla coda' : s.contesto ? ', da ' + s.contesto : '');
    imposta('#pStelle', app.stelleVoto(brano.voto, 'data-pvoto'));
    premuto('#pCuore', preferito(n), preferito(n) ? 'Togli dai brani che ti piacciono' : 'Mi piace');
    premuto('#pCasuale', s.casuale, s.casuale ? 'Ordine casuale: acceso' : 'Ordine casuale: spento');
    premuto('#pRipeti', s.ripeti !== 'no', RIPETI[s.ripeti]);
    $('#pRipeti').dataset.modo = s.ripeti;
    premuto('#pMuto', opz.muto, opz.muto ? 'Riattiva il volume' : 'Silenzia');
    imposta('#pMuto', ic(opz.muto || !opz.volume ? 'muto' : 'volume'));
    premuto('#pCodaTasto', codaAperta);
    $('#pDopo').disabled = !C.puoAvanti(s);
    const tinte = (app.brani().length && brano.categoria) ? coloriDi(brano) : null;
    if (tinte) box.style.setProperty('--tinta', tinte);
    evidenza.textContent = `[data-ascolta="${n}"] > .ic { opacity: 1; background: var(--accent); } [data-brano="${n}"] .titolo-brano { color: var(--accent-text); } [data-brano="${n}"] { background: var(--accent-soft); }`;
    disegnaResta();
    disegnaTasto();
    disegnaCoda();
  }
  // colore del genere, preso dalla copertina disegnata: tinge il lettore a tutto schermo
  const coloriDi = (b) => { const m = /--c1:(#[0-9a-f]{6})/i.exec(copertina(b)); return m ? m[1] : '#39414f'; };

  // ---------- pannello della coda ----------
  const vicino = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'adesso' : m < 60 ? m + ' min fa' : m < 1440 ? Math.round(m / 60) + ' h fa' : Math.round(m / 1440) + ' g fa';
  };
  function rigaCoda(n, dove, k) {
    const t = info(n);
    if (!t) return '';
    const mobile = dove === 'coda' || dove === 'dopo';
    return `<li class="c-riga" data-brano="${n}"${mobile ? ` data-dove="${dove}" data-k="${k}" draggable="true"` : ''}>
      ${mobile ? `<button type="button" class="tasto-riga maniglia" data-sposta aria-label="Sposta ${esc(t.titolo)}: frecce su e giù">${ic('trascina')}</button>` : ''}
      ${copertina(t)}
      <button type="button" class="c-testi" ${mobile ? 'data-salta' : `data-ascolta="${n}"`}><b class="titolo-brano">${esc(t.titolo)}</b><small>${esc(nm(t.categoria))}</small></button>
      ${tasto(`data-azioni="${n}" aria-haspopup="menu"`, 'altro', 'Altre azioni: ' + t.titolo)}
      ${mobile ? tasto('data-togli', 'x', 'Togli dalla coda: ' + t.titolo) : ''}</li>`;
  }
  function disegnaCoda() {
    const p = $('#pCoda');
    p.hidden = box.hidden || !(codaAperta || grande);
    if (p.hidden) return;
    let corpo;
    if (vistaCoda === 'ascoltati') {
      const righe = ascoltati.filter((x) => info(x.n));
      corpo = righe.length ? `<ul data-coda data-nome="Ascoltati di recente">${righe.map((x) => rigaCoda(x.n, 'storia').replace('</small>', ', ' + vicino(x.t) + '</small>')).join('')}</ul>
        <p><button type="button" class="link" data-c="scorda">Cancella la cronologia</button></p>` : '<div class="empty">Qui compaiono i brani che hai ascoltato in questo browser.</div>';
    } else {
      const resto = C.dopo(s);
      corpo = `<h3>In ascolto</h3><ul>${s.corrente === null ? '' : rigaCoda(s.corrente, 'ora')}</ul>
        ${s.prossimi.length ? `<h3>In coda <button type="button" class="link" data-c="svuota">Svuota</button></h3><ul>${s.prossimi.map((n, k) => rigaCoda(n, 'coda', k)).join('')}</ul>` : ''}
        ${resto.length ? `<h3>Poi${s.contesto ? ' da ' + esc(s.contesto) : ''}</h3><ul>${resto.slice(0, 100).map((n, k) => rigaCoda(n, 'dopo', k)).join('')}</ul>${resto.length > 100 ? `<p class="muted">e altri ${resto.length - 100}</p>` : ''}` : ''}
        ${!resto.length && !s.prossimi.length ? `<div class="empty">${s.ripeti === 'no' ? 'Dopo questo brano l\'ascolto si ferma. Aggiungi brani con «Aggiungi in coda» dal menu di un brano.' : 'La ripetizione è accesa: l\'ascolto continua.'}</div>` : ''}
        <p><button type="button" class="btn small ghost" data-c="salva">Salva come playlist</button></p>`;
    }
    const prima = p.querySelector('.c-corpo');
    const scorso = prima ? prima.scrollTop : 0;
    if (imposta(p, `<div class="c-testa"><div class="sub-nav" role="group" aria-label="Elenco mostrato">
        <button type="button" data-c="coda" aria-pressed="${vistaCoda === 'coda'}">Coda</button><button type="button" data-c="ascoltati" aria-pressed="${vistaCoda === 'ascoltati'}">Ascoltati</button></div>
        ${tasto('data-c="chiudi"', 'x', 'Chiudi la coda', 'c-chiudi')}</div><div class="c-corpo">${corpo}</div>`)) p.querySelector('.c-corpo').scrollTop = scorso;
  }
  function apriCoda(si) {
    codaAperta = si;
    premuto('#pCodaTasto', si);
    document.body.classList.toggle('coda-aperta', si);
    disegnaCoda();
    if (si) $('#pCoda [data-c="coda"]')?.focus();
  }
  $('#pCoda').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-c]');
    const riga = e.target.closest('[data-dove]');
    if (c) {
      const k = c.dataset.c;
      if (k === 'chiudi') { apriCoda(false); return $('#pCodaTasto').focus(); }
      if (k === 'coda' || k === 'ascoltati') vistaCoda = k;
      if (k === 'svuota') s.prossimi = [];
      if (k === 'scorda') { ascoltati = []; ricorda('ascoltati', ascoltati); }
      if (k === 'salva') return nuovaPlaylist([...(s.corrente === null ? [] : [s.corrente]), ...s.prossimi, ...C.dopo(s)]);
      disegna(); salva();
    } else if (riga && e.target.closest('[data-togli]')) {
      C.togli(s, riga.dataset.dove, Number(riga.dataset.k));
      disegna(); salva();
    } else if (riga && e.target.closest('[data-salta]')) carica(C.salta(s, riga.dataset.dove, Number(riga.dataset.k)));
  });

  // ---------- riordino: trascinamento e frecce, nella coda e nelle playlist ----------
  function riordina(dove, da, a) {
    if (dove.startsWith('pl:')) {
      const p = lista(dove.slice(3));
      if (!p || a < 0 || a >= p.brani.length) return;
      const visti = p.brani.slice();
      visti.splice(a, 0, ...visti.splice(da, 1));
      const grezza = pl.playlist.find((x) => x.id === p.id);
      return cambia('ordina', { id: p.id, brani: visti.concat(grezza.brani.filter((n) => !visti.includes(n))) });
    }
    C.sposta(s, dove, da, a);
    disegna(); salva();
  }
  let presa = null;
  document.addEventListener('dragstart', (e) => {
    const r = e.target.closest && e.target.closest('[data-dove]');
    if (!r) return;
    presa = { dove: r.dataset.dove, k: Number(r.dataset.k) };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', r.dataset.brano);
    app.nascondiTip();
  });
  const bersaglio = (e) => { const r = presa && e.target.closest && e.target.closest('[data-dove]'); return r && r.dataset.dove === presa.dove ? r : null; };
  const pulisciSegni = () => document.querySelectorAll('.sopra').forEach((x) => x.classList.remove('sopra'));
  document.addEventListener('dragover', (e) => { const r = bersaglio(e); if (!r) return; e.preventDefault(); pulisciSegni(); r.classList.add('sopra'); });
  document.addEventListener('drop', (e) => { const r = bersaglio(e); if (!r) return; e.preventDefault(); riordina(presa.dove, presa.k, Number(r.dataset.k)); });
  document.addEventListener('dragend', () => { presa = null; pulisciSegni(); });
  document.addEventListener('keydown', async (e) => {
    const m = e.target.closest && e.target.closest('[data-sposta]');
    if (!m || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const r = m.closest('[data-dove]'), dove = r.dataset.dove, da = Number(r.dataset.k), a = da + (e.key === 'ArrowUp' ? -1 : 1);
    await riordina(dove, da, a);
    document.querySelector(`[data-dove="${CSS.escape(dove)}"][data-k="${a}"] [data-sposta]`)?.focus();
  });

  // ---------- playlist e preferiti ----------
  const preferito = (n) => pl.preferiti.includes(n);
  function azioni(n) {
    if (n === null || n === undefined) return '';
    const t = info(n) || { titolo: 'brano' };
    return `<span class="azioni-brano"><button type="button" class="tasto-riga cuore" data-cuore="${n}" aria-pressed="${preferito(n)}" aria-label="${esc('Mi piace: ' + t.titolo)}" data-tip="Mi piace">${ic('cuore')}</button>${tasto(`data-azioni="${n}" aria-haspopup="menu"`, 'altro', 'Altre azioni: ' + t.titolo)}</span>`;
  }
  function ridisegnaTutto() {
    app.ridisegna();
    disegna();
    disegnaPagina();
  }
  async function leggiPlaylist() {
    try { pl = await leggi('/api/playlist'); plErrore = ''; }
    catch (e) { plErrore = e.message; }
    ridisegnaTutto();
  }
  async function cambia(azione, corpo, messaggio) {
    let r;
    try { r = await invia('/api/playlist/' + azione, corpo, AbortSignal.timeout(15000)); }
    catch (e) { toast(e.message, 'err'); await leggiPlaylist(); return null; }
    pl = r.dati;
    if (messaggio) toast(messaggio);
    ridisegnaTutto();
    return r;
  }
  const mettiCuore = (n) => cambia('preferito', { brani: [n], si: !preferito(n) }, preferito(n) ? 'Tolto dai brani che ti piacciono' : 'Aggiunto ai brani che ti piacciono');

  // Tutte le raccolte: le tue, i preferiti e quelle che si compongono da sole
  function lista(id) {
    const tutti = app.brani().filter((t) => t.numero !== null);
    const auto = (nome, descrizione, brani) => ({ id, nome, descrizione, brani: brani.map((t) => t.numero), tipo: 'auto' });
    if (id === 'preferiti') return { id, nome: 'Brani che ti piacciono', descrizione: 'I brani con il cuore.', brani: esistono(pl.preferiti), tipo: 'preferiti' };
    if (id === 'migliori') return auto('I più votati', 'Quelli con 4 o 5 stelle.', tutti.filter((t) => t.voto >= 4).sort((a, b) => b.voto - a.voto));
    if (id === 'recenti') return auto('Appena prodotti', 'Gli ultimi 50 brani.', tutti.slice(0, 50));
    if (id === 'ascoltati') return { id, nome: 'Ascoltati di recente', descrizione: 'La cronologia di questo browser.', brani: esistono(ascoltati.map((x) => x.n)), tipo: 'auto' };
    if (id.startsWith('genere:')) {
      const g = id.slice(7), brani = tutti.filter((t) => t.categoria === g);
      return brani.length ? auto('Mix ' + nm(g), 'Tutti i brani di questo genere, dal più recente.', brani) : null;
    }
    const p = pl.playlist.find((x) => x.id === id);
    return p ? { ...p, brani: esistono(p.brani), tipo: 'utente' } : null;
  }

  function mosaico(p) {
    const t = p.brani.slice(0, 4).map(info).filter(Boolean);
    if (!t.length) return `<span class="mosaico vuoto">${ic(p.id === 'preferiti' ? 'cuore' : 'playlist')}</span>`;
    return `<span class="mosaico${t.length < 4 ? ' uno' : ''}">${t.slice(0, t.length < 4 ? 1 : 4).map((x) => copertina(x, 'grande')).join('')}</span>`;
  }
  const carta = (p) => `<article class="pl-carta"><div class="pl-quadro">
      <button type="button" class="pl-apri" data-apri="${esc(p.id)}" aria-label="Apri ${esc(p.nome)}">${mosaico(p)}</button>
      ${p.brani.length ? `<button type="button" class="pl-play" data-suona="pl:${esc(p.id)}" aria-label="Riproduci ${esc(p.nome)}">${ic('play')}</button>` : ''}</div>
    <button type="button" class="pl-nome" data-apri="${esc(p.id)}">${esc(p.nome)}</button><small>${quanti(p.brani.length)}${p.brani.length ? ', ' + durataTot(p.brani) : ''}</small></article>`;

  function disegnaPagina() {
    if (!$('#t-playlist').classList.contains('on')) return;
    const el = $('#plPagina');
    if (!app.pronto()) return imposta(el, '<div class="empty">Caricamento…</div>');
    const errore = plErrore ? `<p class="err">Impossibile leggere le playlist: ${esc(plErrore)}</p>` : '';
    if (aperta === null) {
      const tue = pl.playlist.map((p) => lista(p.id));
      const generi = [...new Set(app.brani().map((t) => t.categoria).filter(Boolean))].sort((a, b) => nm(a).localeCompare(nm(b)));
      return imposta(el, `${errore}
        <div class="pl-sezione"><h2>Le tue playlist</h2><button type="button" class="btn small" data-pl="nuova">Nuova playlist</button></div>
        <div class="pl-griglia">${carta(lista('preferiti'))}${tue.map(carta).join('')}</div>
        ${tue.length ? '' : '<p class="muted">Crea la prima playlist qui, oppure dal menu <b>⋯</b> di un brano.</p>'}
        <div class="pl-sezione"><h2>Si aggiornano da sole</h2></div>
        <div class="pl-griglia">${['recenti', 'migliori', 'ascoltati'].map((id) => carta(lista(id))).join('')}</div>
        <div class="pl-sezione"><h2>Un mix per genere</h2></div>
        <div class="pl-griglia">${generi.map((g) => carta(lista('genere:' + g))).join('')}</div>`);
    }
    const p = lista(aperta);
    const indietro = '<p><button type="button" class="link" data-apri="">Tutte le playlist</button></p>';
    if (!p) return imposta(el, `${errore}${indietro}<div class="empty">Questa playlist non c'è più.</div>`);
    const mia = p.tipo === 'utente', pieno = p.brani.length > 0, chiave = 'pl:' + p.id;
    const tinta = pieno ? coloriDi(info(p.brani[0]) || {}) : '';
    imposta(el, `${errore}${indietro}
      <div class="pl-testa"${tinta ? ` style="--tinta:${tinta}"` : ''}>${mosaico(p)}<div>
        <h2>${esc(p.nome)}</h2>
        ${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}
        <p class="muted">${quanti(p.brani.length)}${pieno ? ', ' + durataTot(p.brani) : ''}</p>
        <div class="pl-azioni">
          <button type="button" class="btn" data-suona="${esc(chiave)}" ${pieno ? '' : 'disabled'}>${ic('play')}Riproduci</button>
          <button type="button" class="btn ghost" data-suona="${esc(chiave)}" data-casuale="1" ${pieno ? '' : 'disabled'}>${ic('casuale')}Casuale</button>
          <button type="button" class="btn ghost" data-pl="accoda" ${pieno ? '' : 'disabled'}>Aggiungi in coda</button>
          ${mia ? '<button type="button" class="btn ghost" data-pl="brani">Aggiungi brani</button><button type="button" class="btn ghost" data-pl="modifica">Rinomina</button>' : ''}
          ${mia || p.tipo === 'preferiti' ? (pieno ? `<a class="btn ghost" href="/api/playlist/m3u?id=${encodeURIComponent(p.id)}" download data-tip="File M3U con i percorsi dei brani, per VLC e altri lettori di questo PC">Esporta</a>` : '') : `<button type="button" class="btn ghost" data-pl="copia" ${pieno ? '' : 'disabled'}>Salva come playlist</button>`}
          ${mia ? '<button type="button" class="btn danger" data-pl="elimina">Elimina</button>' : ''}
        </div></div></div>
      ${pieno ? `<div class="card piatta" data-coda="${esc(chiave)}" data-nome="${esc(p.nome)}"><div class="scroll"><table class="libreria pl-brani">
        <thead><tr><th>${mia ? '<span class="solo-lettore">Ordine</span>' : '#'}</th><th><span class="solo-lettore">Ascolta</span></th><th>Titolo</th><th class="extra">Genere</th><th class="num">Durata</th><th class="extra">Voto</th><th><span class="solo-lettore">Azioni</span></th></tr></thead>
        <tbody>${p.brani.map((n, k) => {
          const t = info(n);
          return t ? `<tr data-brano="${n}"${mia ? ` data-dove="${esc(chiave)}" data-k="${k}" draggable="true"` : ''}>
            <td>${mia ? `<button type="button" class="tasto-riga maniglia" data-sposta aria-label="Sposta ${esc(t.titolo)}: frecce su e giù">${ic('trascina')}</button>` : k + 1}</td>
            <td>${tastoAscolta(t)}</td><td class="nome">${titoloBrano(t)}</td><td class="extra">${esc(nm(t.categoria))}</td><td class="num">${orologio(t.durata_s || 0)}</td><td class="extra">${stelle(t.voto)}</td>
            <td class="azioni-riga">${azioni(n)}${mia ? tasto(`data-via="${n}"`, 'x', 'Togli dalla playlist: ' + t.titolo) : ''}</td></tr>` : '';
        }).join('')}</tbody></table></div></div>`
        : `<div class="empty">${mia ? 'La playlist è vuota: premi «Aggiungi brani».' : p.tipo === 'preferiti' ? 'Premi il cuore su un brano per trovarlo qui.' : 'Ancora nessun brano.'}</div>`}`);
  }
  function apri(id) {
    aperta = id || null;
    history.replaceState(null, '', '#playlist' + (aperta ? '/' + encodeURIComponent(aperta) : ''));
    disegnaPagina();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- finestre: nome della playlist e scelta dei brani ----------
  const finestra = $('#finestra');
  function chiediNome(titolo, p = {}, conferma = 'Crea') {
    return new Promise((ok) => {
      finestra.innerHTML = `<form method="dialog"><h2 id="fTitolo">${esc(titolo)}</h2>
        <label>Nome<input class="field" name="nome" required maxlength="80" pattern=".*\\S.*" value="${esc(p.nome || '')}" autocomplete="off"></label>
        <label>Descrizione (facoltativa)<textarea class="field" name="descrizione" rows="2" maxlength="300">${esc(p.descrizione || '')}</textarea></label>
        <div class="f-tasti"><button class="btn ghost" value="" formnovalidate>Annulla</button><button class="btn" value="ok">${esc(conferma)}</button></div></form>`;
      const form = finestra.querySelector('form');
      let esito = null;
      form.onsubmit = (e) => { if (e.submitter && e.submitter.value === 'ok') esito = { nome: form.elements.nome.value, descrizione: form.elements.descrizione.value }; };
      // «Invio» nel campo del nome deve confermare, non premere il primo pulsante
      form.elements.nome.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(form.querySelector('[value="ok"]')); } };
      finestra.onclose = () => ok(esito);
      finestra.returnValue = '';
      finestra.showModal();
      form.elements.nome.select();
    });
  }
  async function nuovaPlaylist(brani = [], proposta = '') {
    const r = await chiediNome('Nuova playlist', { nome: proposta });
    if (!r) return;
    const e = await cambia('crea', { ...r, brani: [...new Set(brani)].slice(0, 5000) }, `Playlist «${r.nome.trim()}» creata${brani.length ? ' con ' + quanti(new Set(brani).size) : ''}`);
    if (e && !brani.length) { app.vai('playlist/' + e.id); scegliBrani(e.id); }
  }
  function scegliBrani(id) {
    const p = () => pl.playlist.find((x) => x.id === id);
    if (!p()) return;
    finestra.innerHTML = `<div class="f-scelta"><h2 id="fTitolo">Aggiungi a «${esc(p().nome)}»</h2>
      <input class="search" type="search" placeholder="Cerca per titolo o genere" aria-label="Cerca un brano da aggiungere"><ul></ul>
      <div class="f-tasti"><span class="muted"></span><button type="button" class="btn">Fine</button></div></div>`;
    const campo = finestra.querySelector('input'), elenco = finestra.querySelector('ul');
    const disegnaScelta = () => {
      const q = campo.value.trim().toLowerCase(), dentro = new Set(p().brani);
      const trovati = app.brani().filter((t) => t.numero !== null && (!q || (t.titolo + ' ' + nm(t.categoria)).toLowerCase().includes(q)));
      elenco.innerHTML = trovati.slice(0, 60).map((t) => `<li>${copertina(t)}<div><b>${esc(t.titolo)}</b><small>${esc(nm(t.categoria))}, ${orologio(t.durata_s || 0)}</small></div>
        <button type="button" class="btn small ${dentro.has(t.numero) ? 'ghost' : ''}" data-metti="${t.numero}" aria-pressed="${dentro.has(t.numero)}">${dentro.has(t.numero) ? 'Aggiunto' : 'Aggiungi'}</button></li>`).join('') || '<li class="empty">Nessun brano corrisponde.</li>';
      finestra.querySelector('.f-tasti span').textContent = `${quanti(p().brani.length)} nella playlist${trovati.length > 60 ? `. Mostrati 60 di ${trovati.length}: cerca per restringere` : ''}`;
    };
    campo.oninput = disegnaScelta;
    elenco.onclick = async (e) => {
      const b = e.target.closest('[data-metti]');
      if (!b) return;
      const n = Number(b.dataset.metti);
      if (await cambia(p().brani.includes(n) ? 'togli' : 'aggiungi', { id, brani: [n] }) && p()) {
        disegnaScelta();
        elenco.querySelector(`[data-metti="${n}"]`)?.focus();
      }
    };
    finestra.querySelector('.f-tasti button').onclick = () => finestra.close();
    finestra.onclose = null;
    disegnaScelta();
    finestra.showModal();
    campo.focus();
  }
  $('#plPagina').addEventListener('click', async (e) => {
    const via = e.target.closest('[data-via]');
    if (via) return cambia('togli', { id: aperta, brani: [Number(via.dataset.via)] }, 'Tolto dalla playlist');
    const b = e.target.closest('[data-pl]');
    if (!b) return;
    const azione = b.dataset.pl;
    if (azione === 'nuova') return nuovaPlaylist();
    const p = lista(aperta);
    if (!p) return;
    if (azione === 'brani') scegliBrani(p.id);
    if (azione === 'accoda') accoda(p.brani, false);
    if (azione === 'copia') nuovaPlaylist(p.brani, p.nome);
    if (azione === 'modifica') {
      const r = await chiediNome('Rinomina la playlist', p, 'Salva');
      if (r) cambia('modifica', { id: p.id, ...r }, 'Playlist salvata');
    }
    if (azione === 'elimina' && await chiedi('Eliminare la playlist?', `«${p.nome}» verrà eliminata. I brani restano nella libreria.`, 'Elimina')) {
      aperta = null;
      history.replaceState(null, '', '#playlist');
      cambia('elimina', { id: p.id }, 'Playlist eliminata');
    }
  });

  // ---------- coda: azioni da qualunque elenco ----------
  const nomeDi = (chiave) => (chiave === 'libreria' ? 'Libreria' : (lista(chiave.slice(3)) || {}).nome);
  const braniDi = (chiave) => (chiave === 'libreria' ? app.inLibreria() : chiave && chiave.startsWith('pl:') ? (lista(chiave.slice(3)) || { brani: [] }).brani : null);
  function suonaElenco(brani, numero, nome) {
    if (!brani.length) return toast('Nessun brano da riprodurre', 'err');
    carica(C.avvia(s, brani, numero, nome));
  }
  function accoda(brani, subito) {
    if (!brani.length) return;
    C.accoda(s, brani, subito);
    // senza nulla in ascolto la coda parte subito
    if (!brano) return successivo();
    toast(subito ? 'Suonerà dopo il brano in corso' : brani.length === 1 ? 'Aggiunto in coda' : quanti(brani.length) + ' aggiunti in coda');
    disegna(); salva();
  }
  // il pulsante di una copertina: gli altri brani dello stesso elenco diventano la coda
  function ascolta(el) {
    const n = Number(el.dataset.ascolta);
    if (brano && s.corrente === n) return commuta();
    const elenco = el.closest('[data-coda]');
    if (!elenco) return suonaElenco([n], n, null);
    const brani = braniDi(elenco.dataset.coda) || [...elenco.querySelectorAll('[data-ascolta]')].map((x) => Number(x.dataset.ascolta));
    return suonaElenco(brani, n, elenco.dataset.nome || null);
  }

  // ---------- menu a comparsa ----------
  function apriPopover(id, html, x, y, ancora) {
    document.getElementById(id)?.remove();
    const m = document.createElement('div');
    m.id = id; m.className = 'menu'; m.popover = 'auto'; m.innerHTML = html;
    // dentro la finestra o il lettore da cui è aperto: fuori, una finestra modale lo renderebbe inerte
    ((ancora && ancora.closest('dialog, #player')) || document.body).appendChild(m);
    m.showPopover();
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(8, y + r.height > innerHeight - 8 ? y - r.height : y) + 'px';
    m.querySelector('button, a, select')?.focus({ preventScroll: true });
    m.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault(); e.stopPropagation();
      const voci = [...m.querySelectorAll('button:not(:disabled), a')];
      voci[(voci.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1) + voci.length) % voci.length]?.focus();
    });
    return m;
  }
  function apriMenu(n, x, y, ancora) {
    const t = info(n);
    if (!t) return;
    const voce = (attr, testo) => `<button type="button" role="menuitem" ${attr}>${testo}</button>`;
    const m = apriPopover('menuBrano', `<p><b>${esc(t.titolo)}</b></p>
      ${voce('data-m="ora"', 'Riproduci ora')}${voce('data-m="dopo"', 'Riproduci dopo')}${voce('data-m="coda"', 'Aggiungi in coda')}<hr>
      ${voce('data-m="cuore"', preferito(n) ? 'Togli dai brani che ti piacciono' : 'Aggiungi ai brani che ti piacciono')}
      <p>Aggiungi a una playlist</p><div class="menu-elenco">${voce('data-m="nuova"', 'Nuova playlist…')}
      ${pl.playlist.map((p) => voce(`data-m="in" data-id="${esc(p.id)}" ${p.brani.includes(n) ? 'disabled' : ''}`, esc(p.nome) + (p.brani.includes(n) ? ' <small>già presente</small>' : ''))).join('')}</div><hr>
      ${voce(`data-info="${n}"`, 'Scheda del brano')}${voce(`data-vota="${n}"`, 'Vota nella pagina Voti')}${voce(`data-produci="${esc(t.categoria)}"`, 'Produci un altro di questo genere')}
      <a role="menuitem" href="/audio/brano?n=${n}&amp;scarica=1" download>Scarica il file</a>`, x, y, ancora);
    m.setAttribute('role', 'menu');
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button, a');
      if (!b) return;
      m.hidePopover(); // resta nella pagina: il gestore comune legge ancora da dove arriva il clic
      const k = b.dataset.m;
      if (k === 'ora') suonaElenco([n], n, null);
      if (k === 'dopo') accoda([n], true);
      if (k === 'coda') accoda([n], false);
      if (k === 'cuore') mettiCuore(n);
      if (k === 'nuova') nuovaPlaylist([n]);
      if (k === 'in') cambia('aggiungi', { id: b.dataset.id, brani: [n] }, 'Aggiunto alla playlist');
    });
  }

  const SCORCIATOIE = [['Spazio', 'ascolta o pausa'], ['← →', 'indietro o avanti di 10 secondi'], ['Maiusc + ← →', 'brano precedente o successivo'], ['Maiusc + ↑ ↓', 'volume'],
    ['M', 'silenzia'], ['C', 'ordine casuale'], ['R', 'ripeti'], ['L', 'mi piace'], ['Q', 'coda'], ['F', 'lettore grande'], ['Esc', 'chiude']];
  function apriOpzioni() {
    const r = $('#pOpzioni').getBoundingClientRect();
    const scelta = (valore, voci) => voci.map(([v, t]) => `<option value="${v}"${String(valore) === String(v) ? ' selected' : ''}>${t}</option>`).join('');
    const ora = !timer ? 0 : timer.brano ? 'brano' : 'attivo';
    const m = apriPopover('menuOpzioni', `<label>Timer di spegnimento<select class="field" id="oTimer">${scelta(ora, [[0, 'Spento'], ...(ora === 'attivo' ? [['attivo', `Tra ${Math.max(1, Math.ceil((timer.fine - Date.now()) / 60000))} min`]] : []),
      [5, '5 minuti'], [15, '15 minuti'], [30, '30 minuti'], [45, '45 minuti'], [60, '1 ora'], [75, '1 ora e 15'], [90, '1 ora e mezza'], ['brano', 'Alla fine del brano']])}</select></label>
      <label>Dissolvenza tra i brani<select class="field" id="oDissolvi">${scelta(opz.dissolvi, [[0, 'Spenta'], [3, '3 secondi'], [6, '6 secondi'], [10, '10 secondi'], [15, '15 secondi']])}</select></label>
      <p>Il timer sfuma il volume negli ultimi 20 secondi.</p><hr><p><b>Scorciatoie da tastiera</b></p>
      <dl>${SCORCIATOIE.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join('')}</dl>`, r.right - 300, r.top - 8, $('#pOpzioni'));
    m.querySelector('#oTimer').onchange = (e) => {
      const v = e.target.value;
      if (v === 'attivo') return;
      timer = v === 'brano' ? { brano: true } : Number(v) ? { fine: Date.now() + Number(v) * 60000 } : null;
      fineSfuma(); volume(); disegnaResta();
    };
    m.querySelector('#oDissolvi').onchange = (e) => { opz.dissolvi = Number(e.target.value); ricorda('lettoreOpzioni', opz); disegnaResta(); };
  }
  setInterval(() => {
    if (!timer || !timer.fine) return;
    if (Date.now() >= timer.fine) {
      attivo().pause();
      timer = null;
      toast('Timer: ascolto fermato');
    }
    volume();
    disegnaResta();
  }, 500);

  // ---------- lettore grande ----------
  function ingrandisci(si) {
    if (grande === si) return;
    grande = si;
    box.classList.toggle('grande', si);
    document.querySelector('.app').inert = si; // la tastiera non finisce dietro al lettore
    premuto('#pGrande', si, si ? 'Riduci il lettore' : 'Ingrandisci il lettore');
    imposta('#pGrande', ic(si ? 'piccolo' : 'grande'));
    if (!si && document.fullscreenElement) document.exitFullscreen();
    disegnaCoda();
    if (si) $('#pPlay').focus();
  }

  // ---------- comandi ----------
  const cambiaVolume = (v) => {
    opz.volume = Math.max(0, Math.min(100, v));
    opz.muto = false;
    $('#pVol').value = opz.volume;
    alPasso($('#pVol'));
    volume(); ricorda('lettoreOpzioni', opz); disegna();
  };
  const muto = () => { opz.muto = !opz.muto; volume(); ricorda('lettoreOpzioni', opz); disegna(); };
  const mescola = () => { C.casuale(s, !s.casuale); disegna(); salva(); };
  const ripeti = () => { s.ripeti = { no: 'tutti', tutti: 'uno', uno: 'no' }[s.ripeti]; disegna(); salva(); };
  $('#pVol').value = opz.volume;
  alPasso($('#pVol'));
  $('#pVol').oninput = (e) => cambiaVolume(Number(e.target.value));
  $('#pVol').addEventListener('wheel', (e) => { e.preventDefault(); cambiaVolume(opz.volume + (e.deltaY < 0 ? 5 : -5)); }, { passive: false });
  $('#pBarra').oninput = (e) => { const a = attivo(); if (a.duration) cerca(e.target.value / 1000 * a.duration); };
  $('#pBarra').style.setProperty('--p', '0%');
  $('#pPlay').onclick = commuta;
  $('#pPrima').onclick = precedente;
  $('#pDopo').onclick = successivo;
  $('#pCasuale').onclick = mescola;
  $('#pRipeti').onclick = ripeti;
  $('#pMuto').onclick = muto;
  $('#pCuore').onclick = () => brano && mettiCuore(brano.numero);
  $('#pAltro').onclick = () => { if (!brano) return; const r = $('#pAltro').getBoundingClientRect(); apriMenu(brano.numero, r.left, r.top - 4, $('#pAltro')); };
  $('#pInfo').onclick = () => brano && app.apriScheda(brano.numero);
  $('#pFine').onclick = () => { opz.restante = !opz.restante; ricorda('lettoreOpzioni', opz); mostraTempo(); };
  $('#pOpzioni').onclick = apriOpzioni;
  $('#pCodaTasto').onclick = () => apriCoda(!codaAperta);
  $('#pGrande').onclick = () => ingrandisci(!grande);
  $('#pSchermo').onclick = () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    ingrandisci(true);
    box.requestFullscreen().catch(() => toast('Schermo intero non disponibile', 'err'));
  };
  $('#pChiudi').onclick = chiudi;
  $('#pStelle').addEventListener('click', (e) => { const x = e.target.closest('[data-pvoto]'); if (x && brano) app.votaDa(brano, Number(x.dataset.pvoto)); });
  $('#lSalva').onclick = () => { const b = app.inLibreria(); if (b.length) nuovaPlaylist(b); else toast('Nessun brano da salvare', 'err'); };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cuore], [data-azioni], [data-suona], [data-apri]');
    if (!b) return;
    if (b.dataset.cuore !== undefined) return mettiCuore(Number(b.dataset.cuore));
    if (b.dataset.azioni !== undefined) { const r = b.getBoundingClientRect(); return apriMenu(Number(b.dataset.azioni), r.right - 270, r.bottom + 4, b); }
    if (b.dataset.apri !== undefined) return apri(b.dataset.apri);
    const brani = braniDi(b.dataset.suona) || [];
    if (!brani.length) return toast('Nessun brano da riprodurre', 'err');
    s.casuale = !!b.dataset.casuale;
    suonaElenco(brani, null, nomeDi(b.dataset.suona));
  });
  // tasto destro su un brano: lo stesso menu del pulsante ⋯
  document.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-brano], [data-ascolta]');
    if (!el || e.shiftKey) return;
    const n = Number(el.dataset.brano ?? el.dataset.ascolta);
    if (!info(n)) return;
    e.preventDefault();
    apriMenu(n, e.clientX, e.clientY, el);
  });
  document.addEventListener('dblclick', (e) => {
    const riga = e.target.closest('tr[data-brano]');
    const b = riga && !e.target.closest('button, a') && riga.querySelector('[data-ascolta]');
    if (b && !(brano && s.corrente === Number(b.dataset.ascolta))) ascolta(b);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || finestra.open || $('#scheda').open || !$('#modal').hidden || document.querySelector('.menu:popover-open')) return;
    if (grande) { ingrandisci(false); $('#pGrande').focus(); } else if (codaAperta) { apriCoda(false); $('#pCodaTasto').focus(); }
  });

  // Scorciatoie: nella pagina Voti valgono i suoi comandi
  function scorciatoia(e) {
    if (box.hidden || $('#t-voti').classList.contains('on') || $('#scheda').open || finestra.open || !$('#modal').hidden || e.target.closest?.('.menu, [data-sposta]')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ') { if (!e.target.closest?.('button, summary, a')) { e.preventDefault(); commuta(); } return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const avanti = k === 'ArrowRight';
      if (e.shiftKey) return avanti ? successivo() : precedente();
      return cerca(attivo().currentTime + (avanti ? 10 : -10));
    }
    if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); return cambiaVolume(opz.volume + (k === 'ArrowUp' ? 5 : -5)); }
    const azione = { m: muto, c: mescola, r: ripeti, l: () => brano && mettiCuore(brano.numero), q: () => apriCoda(!codaAperta), f: () => ingrandisci(!grande) }[k];
    if (azione && !e.repeat) { e.preventDefault(); azione(); }
  }

  window.addEventListener('pagehide', () => { if (!box.hidden) salva(); });
  // l'ascolto riprende da dove era rimasto, in pausa
  if (salvato && salvato.aperto && s.corrente !== null) carica(s.corrente, { parti: false, da: Number(salvato.posizione) || 0 });
  leggiPlaylist();

  return {
    ascolta, azioni, preferito, tasto: scorciatoia,
    pausa: () => attivo().pause(),
    votato(n, voto) {
      if (cache.has(n)) cache.get(n).voto = voto;
      if (brano && brano.numero === n) brano.voto = voto;
      disegna(); disegnaPagina();
    },
    // dopo ogni lettura della libreria: via i brani che non ci sono più, dati freschi a video
    aggiorna() {
      if (app.brani().length) C.pulisci(s, (n) => !!app.trovaBrano(n));
      if (brano) brano = app.trovaBrano(brano.numero) || brano;
      disegna(); disegnaPagina();
    },
    pagina(id) {
      let v = null;
      try { v = id ? decodeURIComponent(id) : null; } catch (e) { /* indirizzo scritto male: si apre l'indice */ }
      aperta = v;
      leggiPlaylist(); // un'altra scheda del browser può averle cambiate
    },
    navigato() {
      ingrandisci(false);
      titoloPagina = document.title;
      disegnaTitolo();
    },
  };
};
