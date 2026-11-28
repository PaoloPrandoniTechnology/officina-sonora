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
  const MODI = [['m', 'Minore'], ['M', 'Maggiore']];
  let dati = null;
  let scheda = 'armonia';
  const filtro = { stile: '', modo: '', ruolo: '', andamento: '', q: '', solo: '', quanti: 40 };
  let suono = null;

  const A = window.ScoreAbc;
  // ---------- ascolto: la timeline di riproduzione sta in composizione-lettore.js ----------
  const L = window.LettoreComposizione;
  const SPIEGA = {
    armonia: 'Primo giro: gli accordi da soli. Secondo giro: con una melodia di prova.',
    motivo: 'Le note sono di prova: nei brani le sceglie il compositore, il ritmo è il tuo.',
    cadenza: 'Le note sono di prova: nei brani le sceglie il compositore, il ritmo è il tuo.',
    assolo: 'La frase si ripete su otto accordi: le note cambiano, il disegno resta.',
    richiamo: '',
    forma: 'È un brano intero di prova.',
  };
  function ferma() {
    if (!suono) return;
    const s0 = suono;
    suono = null;
    s0.lettore.ferma();
    s0.pulisci();
  }
  // un colpo breve per sentire l'accordo o la nota appena scelti
  let colpo = null;
  function assaggia(note) {
    ferma();
    colpo?.close().catch(() => {});
    colpo = new AudioContext();
    const nota = L.voce(colpo);
    note.forEach((m) => nota(m, colpo.currentTime + 0.02, 0.5, 'triangle', 0.5 / (note.length + 1)));
  }
  // dove: la carta o il passo 2 dell'editor; lì si apre il lettore, che prende il posto della timeline della voce
  async function ascolta(voce, tasto, { box, errore, aperto = () => {}, chiuso = () => {} }) {
    const era = suono && suono.tasto === tasto;
    ferma();
    if (era) return;
    try {
      const r = await invia('/api/composizione/prova', voce);
      const score = A.leggiAbc(r.abc).score;
      if (!score) throw new Error('non riesco a leggere la prova');
      ferma();
      app.pausaLettore();
      const dove = box();
      const pulisci = () => { chiuso(); if (tasto.isConnected) tasto.textContent = 'Ascolta'; };
      aperto(); // prima si fa spazio, poi il nastro misura la larghezza
      const lettore = L.apri(dove, score, { spiega: SPIEGA[voce.tipo], suFine: () => { suono = null; pulisci(); } });
      suono = { lettore, tasto, pulisci };
      tasto.textContent = 'Ferma';
      dove.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    ferma();
    const lista = filtrate();
    const tutte = dati.voci.filter((v) => v.tipo === scheda);
    $('#cmConta').textContent = `${lista.length} di ${tutte.length} · ${tutte.filter((v) => v.attivo && !v.errore).length} in uso`;
    imposta($('#cmElenco'), lista.slice(0, filtro.quanti).map((v) => `<article class="card cm-voce${v.attivo ? '' : ' spenta'}">
      <h3>${esc(titolo(v))}${v.serie ? (v.modificata ? '<span class="badge">modificata</span>' : '') : '<span class="badge">tua</span>'}${v.attivo ? '' : '<span class="badge">spenta</span>'}</h3>
      ${v.stili ? `<p class="muted">${v.stili.map(stileNome).map(esc).join(', ')}</p>` : ''}
      ${v.errore ? `<p class="err">Non usata: ${esc(v.errore)}</p>` : E.timeline(E.modelloDi(v), { tonica: tonicaDi(v), gesti: GESTI })}
      <div class="cm-qui"></div>
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

  // ---------- modifica: il banco di lavoro (composizione-banco.js) ----------
  const banco = window.BancoComposizione({ finestra, invia, toast, dati: () => dati, schede: SCHEDE, gesti: GESTI, assaggia, fermaAscolto: ferma, pausaLettore: app.pausaLettore });
  function modifica(base, id) {
    ferma();
    banco.apri(
      { tipo: scheda, stile: filtro.stile || 'rock', modo: filtro.modo || 'm', ruolo: filtro.ruolo || 'strofa', andamento: filtro.andamento || 'dritto', stili: [filtro.stile || 'rock'], nome: '', ...base },
      id, async (tipo) => { scheda = tipo; await aggiorna(); });
  }

  radice.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-cm]');
    if (!b) return;
    const azione = b.dataset.cm;
    if (azione === 'nuova') return modifica({});
    if (azione === 'altri') { filtro.quanti += 40; return disegnaElenco(); }
    const v = dati.voci.find((x) => x.id === b.dataset.id);
    if (!v) return;
    if (azione === 'ascolta') {
      const carta = b.closest('.cm-voce');
      return ascolta(v, b, {
        box: () => carta.querySelector('.cm-qui'),
        // la carta in ascolto prende tutta la riga, così la timeline si legge bene
        aperto: () => carta.classList.add('in-ascolto'),
        chiuso: () => carta.classList.remove('in-ascolto'),
      });
    }
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
