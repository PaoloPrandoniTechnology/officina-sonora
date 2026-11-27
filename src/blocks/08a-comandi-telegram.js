// BLOCCO 8 - Telegram: comandi, feedback interpretati con conferma, avvisi per errori ripetuti.
// Ogni modifica richiesta viene riscritta in chiaro e applicata solo dopo il pulsante "Conferma".
// Stato proprio in state/telegram.json, cosi' non interferisce con la produzione dei brani.
// il token Telegram sta nel gateway locale: qui non c'e'
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const TG_FILE = path.join(CFG.dir, 'state', 'telegram.json');
if (!CHAT) return [{ json: { telegram: 'non configurato' } }];

let tgs = readJsonSafe(TG_FILE, { offset: 0, pending: {}, alerted: {}, seq: 0 });
const DEFAULT_MAX_EXP = 5;

// Telegram si chiama tramite il gateway locale
async function tgRequest(method, body) {
  return gw('/tg', { method, body });
}

async function say(text, buttons) {
  const body = { chat_id: CHAT, text: String(text).slice(0, 3900) };
  // buttons: una riga di bottoni, oppure gia' un elenco di righe
  if (buttons) body.reply_markup = { inline_keyboard: Array.isArray(buttons[0]) ? buttons : [buttons] };
  return tgRequest('sendMessage', body);
}

const AIUTO = [
  'Officina Sonora - comandi:',
  '/stato - a che punto siamo (brani, coda, errori)',
  '/annulla - scarta le modifiche in attesa',
  '/aiuto - questo elenco',
  '',
  'Oppure scrivi in italiano cosa vuoi cambiare, per esempio:',
  '- "Vinyasa piu ritmato, bpm tra 100 e 120"',
  '- "Aggiungi la categoria Batfit: energia 4, strutture loop e crescendo"',
  '- "Aggiungi una struttura breve con solo intro, main e outro"',
  'Ti mostro sempre il riepilogo e applico solo dopo il tuo Conferma.',
].join('\n');

function statoTesto() {
  const s = readJsonSafe(CFG.stateFile, {}) || {};
  const g = readGuidance();
  const cats = (CFG.categories || []).map((c) => c.name).join(', ');
  return [
    `Brani salvati: ${s.done || 0}`,
    `In coda: ${(s.queue || []).length}`,
    `Render in corso: ${s.job ? s.job.concept.titolo : 'nessuno'}`,
    `Scartati: ${(s.failed || []).length}`,
    `Linee guida: v${g.versione}`,
    `Categorie: ${cats}`,
  ].join('\n');
}

// Interpreta il messaggio in un'azione strutturata; se non e' chiaro, restituisce una domanda.
async function interpreta(testo, contesto) {
  const sistema = 'Sei l\'assistente di configurazione di un generatore di musica di sottofondo. Rispondi solo con JSON valido.';
  const utente = `${contesto ? `Contesto: ${contesto}\n` : ''}Messaggio dell'utente: "${testo}"

Categorie attuali: ${(CFG.categories || []).map((c) => `${c.name} (energia ${c.energia}, bpm ${c.bpm.join('-')}, strutture ${c.strutture.join('/')})`).join('; ')}
Strutture disponibili: ${Object.keys(CFG.strutture || {}).join(', ')}
Sezioni valide: ${CFG.sections.join(' ')}

Rispondi con un oggetto JSON con i campi:
- "azione": una tra "linee_guida", "nuova_categoria", "modifica_categoria", "nuova_struttura", "tag_extra", "domanda"
- "riassunto": frase in italiano che descrive la modifica che applicherai
- "dati": oggetto con i valori della modifica:
  * linee_guida: style_extra (max 5 keyword inglesi), style_avoid (max 6), durata_hint / bpm_range / struttura_pref (oggetto categoria -> valore), note (italiano)
  * nuova_categoria: name (senza spazi), energia (1-5), bpm ([min,max] tra 30 e 150), attivita (italiano), strutture (array di strutture disponibili), genere (nome del genere, italiano), strumenti (italiano), stile_base (keyword inglesi che definiscono l'identita' sonora)
  * modifica_categoria: name (esistente), campi con energia, bpm, attivita, strutture
  * nuova_struttura: nome (senza spazi), sezioni (array di sezioni valide, minimo 3)
  * tag_extra: categoria (esistente), tag (max 3 parole)
- "testo": solo per azione "domanda": la domanda da fare all'utente in italiano
Se non e' chiaro, usa "domanda" e chiedi cosa intende.`;
  return llmJson(sistema, utente, 1200);
}

// Controlli stretti prima di mostrare la modifica
function valida(p) {
  const d = p.dati || {};
  const isName = (s) => typeof s === 'string' && /^[A-Za-z0-9-]{2,40}$/.test(s);
  const bpmOk = (b) => Array.isArray(b) && b.length === 2 && b[0] >= 30 && b[1] <= 150 && b[0] < b[1];
  const catNames = (CFG.categories || []).map((c) => c.name);
  const strutNames = Object.keys(CFG.strutture || {});
  switch (p.azione) {
    case 'linee_guida':
      return Object.keys(d).length > 0 ? null : 'nessuna modifica indicata';
    case 'nuova_categoria':
      if (!isName(d.name)) return 'nome categoria non valido';
      if (catNames.includes(d.name)) return 'la categoria esiste gia\'';
      if (!(d.energia >= 1 && d.energia <= 5)) return 'energia deve essere tra 1 e 5';
      if (!bpmOk(d.bpm)) return 'bpm non validi';
      if (!Array.isArray(d.strutture) || !d.strutture.length || !d.strutture.every((s) => strutNames.includes(s))) return 'strutture non riconosciute';
      return null;
    case 'modifica_categoria':
      if (!catNames.includes(d.name)) return 'categoria da modificare non esiste';
      if (d.campi && d.campi.bpm && !bpmOk(d.campi.bpm)) return 'bpm non validi';
      if (d.campi && d.campi.energia && !(d.campi.energia >= 1 && d.campi.energia <= 5)) return 'energia non valida';
      if (d.campi && d.campi.strutture && !d.campi.strutture.every((s) => strutNames.includes(s))) return 'strutture non riconosciute';
      return null;
    case 'nuova_struttura':
      if (!isName(d.nome)) return 'nome struttura non valido';
      if (strutNames.includes(d.nome)) return 'la struttura esiste gia\'';
      if (!Array.isArray(d.sezioni) || d.sezioni.length < 3 || !d.sezioni.every((s) => CFG.sections.includes(s))) return 'sezioni non valide';
      return null;
    case 'tag_extra':
      if (!catNames.includes(d.categoria)) return 'categoria non esiste';
      if (!Array.isArray(d.tag) || !d.tag.length || d.tag.length > 3) return 'tag non validi';
      return null;
    default:
      return 'azione non riconosciuta';
  }
}

// Applica la modifica confermata
function applica(p) {
  const d = p.dati;
  if (p.azione === 'linee_guida') {
    const cur = readGuidance();
    const next = { ...cur, versione: cur.versione + 1, aggiornato: new Date().toISOString() };
    if (d.style_extra) next.style_extra = [...new Set(d.style_extra.map(String))].slice(0, 5);
    if (d.style_avoid) next.style_avoid = [...new Set([...(cur.style_avoid || []), ...d.style_avoid.map(String)])].slice(0, 9);
    if (d.durata_hint) next.durata_hint = { ...(cur.durata_hint || {}), ...d.durata_hint };
    if (d.bpm_range) next.bpm_range = { ...(cur.bpm_range || {}), ...d.bpm_range };
    if (d.struttura_pref) next.struttura_pref = { ...(cur.struttura_pref || {}), ...d.struttura_pref };
    if (d.note) next.note = String(d.note).slice(0, 300);
    fs.mkdirSync(CFG.historyDir, { recursive: true });
    fs.writeFileSync(path.join(CFG.historyDir, `guidance-v${cur.versione}.json`), JSON.stringify(cur, null, 2));
    fs.writeFileSync(CFG.guidanceFile, JSON.stringify(next, null, 2));
    return `linee guida aggiornate a v${next.versione}`;
  }
  // Tutte le altre modifiche riguardano il catalogo
  const cat = readJsonSafe(CFG.catalogoFile, {});
  if (p.azione === 'nuova_categoria') {
    cat.categories.push({ name: d.name, energia: d.energia, bpm: d.bpm, attivita: d.attivita || d.name, strutture: d.strutture,
      genere: d.genere || d.name, strumenti: d.strumenti || '', stile_base: d.stile_base || '' });
  } else if (p.azione === 'modifica_categoria') {
    const c = cat.categories.find((x) => x.name === d.name);
    Object.assign(c, d.campi || {});
  } else if (p.azione === 'nuova_struttura') {
    cat.strutture[d.nome] = d.sezioni;
  } else if (p.azione === 'tag_extra') {
    cat.tag_extra = cat.tag_extra || {};
    cat.tag_extra[d.categoria] = d.tag;
  }
  fs.writeFileSync(CFG.catalogoFile, JSON.stringify(cat, null, 2));
  return 'catalogo aggiornato';
}

// ---- Menu guidato: bottoni per navigare, con percorsi passo-passo ----
const MENU_BUTTONS = [
  [{ text: '📊 Stato', callback_data: 'm:stato' }, { text: '⭐ Vota un brano', callback_data: 'm:vota' }],
  [{ text: '🧘 Categorie', callback_data: 'm:cat' }, { text: '🧩 Strutture', callback_data: 'm:strut' }],
  [{ text: '🏷 Tag', callback_data: 'm:tag' }, { text: '🎚 Linee guida', callback_data: 'm:linee' }],
  [{ text: '❓ Aiuto', callback_data: 'm:aiuto' }, { text: '✖ Annulla', callback_data: 'm:annulla' }],
];

async function menu(testo) {
  return tgRequest('sendMessage', { chat_id: CHAT, text: testo || 'Cosa vuoi fare?', reply_markup: { inline_keyboard: MENU_BUTTONS } });
}

// Bottoni per liste (una riga ciascuno)
function listaBottoni(items, prefix) {
  return items.map((x) => [{ text: x.label, callback_data: `${prefix}:${x.value}` }]);
}

// Imposta una richiesta libera: il prossimo messaggio di testo viene letto con questo contesto
function chiediTesto(contesto, domanda) {
  tgs.flow = { contesto };
  return say(domanda + '\n\n(scrivi la risposta; /annulla per uscire)');
}

async function sezione(nome) {
  if (nome === 'stato') return say(statoTesto()).then(() => menu());
  if (nome === 'aiuto') return say(AIUTO).then(() => menu());
  if (nome === 'annulla') { tgs.flow = null; tgs.pending = {}; return menu('Annullato.'); }
  if (nome === 'vota') {
    const recenti = libraryTracks()
      .filter((t) => Number.isInteger(t.meta.numero_traccia))
      .sort((a, b) => String(b.meta.generato_il || '').localeCompare(String(a.meta.generato_il || '')))
      .slice(0, 8);
    if (!recenti.length) return say('Ancora nessun brano da votare.');
    return say('Quale brano vuoi votare?', listaBottoni(recenti.map(({ meta }) => ({ label: `${meta.titolo} (${meta.categoria})`, value: meta.numero_traccia })), 'v'));
  }
  if (nome === 'cat') {
    const cats = (CFG.categories || []).map((c) => ({ label: `${c.name} (energia ${c.energia})`, value: c.name }));
    return say('Categorie:', [...listaBottoni(cats, 'c'), [{ text: '➕ Nuova categoria', callback_data: 'n:cat' }]]);
  }
  if (nome === 'strut') {
    const st = Object.keys(CFG.strutture || {}).map((s) => ({ label: `${s}: ${CFG.strutture[s].join(' ')}`, value: s }));
    return say('Strutture disponibili:', [...listaBottoni(st, 's'), [{ text: '➕ Nuova struttura', callback_data: 'n:strut' }]]);
  }
  if (nome === 'tag') {
    const cats = (CFG.categories || []).map((c) => ({ label: c.name, value: c.name }));
    return say('Per quale categoria vuoi aggiungere tag extra?', listaBottoni(cats, 't'));
  }
  if (nome === 'linee') {
    const g = readGuidance();
    return say([`Linee guida v${g.versione}: ${g.note}`, `Stile extra: ${(g.style_extra || []).join(', ') || 'nessuno'}`,
      `Da evitare: ${(g.style_avoid || []).join(', ')}`].join('\n'), [
      [{ text: '✍ Scrivi una modifica', callback_data: 'n:linee' }],
    ]);
  }
  return menu();
}

// Gestisce i pulsanti del menu. Ritorna true se il pulsante e' stato gestito qui.
async function menuPulsante(data) {
  const [tipo, ...resto] = String(data).split(':');
  const valore = resto.join(':');
  if (tipo === 'm') { await sezione(valore); return true; }
  if (tipo === 'v') {
    // i pulsanti vecchi portano il nome del file al posto del numero di traccia
    if (!/^\d+$/.test(valore)) return say(PULSANTE_VECCHIO).then(() => true);
    return say(`Voto per il brano n. ${valore}`, [1, 2, 3, 4, 5].map((n) => ({ text: String(n), callback_data: `vv:${n}:${valore}` }))).then(() => true);
  }
  if (tipo === 'vv') {
    if (!/^\d:\d+$/.test(valore)) { await say(PULSANTE_VECCHIO); return true; }
    const [voto, numero] = valore.split(':').map(Number);
    const r = await salvaVoto({ numero, voto });
    if (!r.ok) { await say(`Non ho salvato il voto: ${r.error}`); return true; }
    tgs.flow = { contesto: 'nota-voto', numero, voto };
    await say(`Voto ${voto}/5 salvato per "${r.titolo}". Vuoi aggiungere una nota? Scrivila ora (oppure /annulla).`);
    return true;
  }
  if (tipo === 'c') {
    const c = (CFG.categories || []).find((x) => x.name === valore);
    if (!c) return say('Categoria non trovata.').then(() => true);
    await say(`${c.name}\nEnergia ${c.energia} · bpm ${c.bpm.join('-')} · strutture ${c.strutture.join(', ')}\nAttivita': ${c.attivita}`, [
      [{ text: '✏ Modifica', callback_data: `e:${c.name}` }],
    ]);
    return true;
  }
  if (tipo === 'e') return chiediTesto(`modifica categoria ${valore}`, `Cosa vuoi cambiare in ${valore}? (energia, bpm, attivita, strutture)`).then(() => true);
  if (tipo === 's') {
    return say(`Struttura ${valore}: ${CFG.strutture[valore].join(' ')}`).then(() => true);
  }
  if (tipo === 't') return chiediTesto(`tag extra per la categoria ${valore}`, `Quali tag extra vuoi per ${valore}? (max 3, separati da virgola)`).then(() => true);
  if (tipo === 'n') {
    if (valore === 'cat') return chiediTesto('nuova categoria', 'Descrivi la nuova categoria: nome, energia (1-5), bpm, attivita e strutture.').then(() => true);
    if (valore === 'strut') return chiediTesto('nuova struttura', 'Descrivi la nuova struttura: nome e sezioni (Intro, Build, Main, Peak, Release, Outro).').then(() => true);
    if (valore === 'linee') return chiediTesto('linee guida', 'Scrivi la modifica alle linee guida (stile, cose da evitare, bpm, durate).').then(() => true);
  }
  return false;
}

const PULSANTE_VECCHIO = 'Questo pulsante non e\' piu\' valido. Riapri "Vota un brano" dal /menu.';

// Voto e nota passano dal gateway, che li scrive nella scheda del brano
async function salvaVoto(dati) {
  try {
    return await gw('/voto', { ...dati, fonte: 'telegram' });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function gestisciTesto(msg) {
  const testo = (msg.text || '').trim();
  if (/^\/(start|aiuto|menu)/.test(testo)) return menu('Benvenuto in Officina Sonora. Scegli una voce oppure scrivi direttamente la modifica.');
  if (/^\/stato/.test(testo)) return say(statoTesto());
  if (/^\/annulla/.test(testo)) { tgs.pending = {}; tgs.flow = null; return say('Annullato.').then(() => menu()); }
  if (!testo) return;
  // Nota a un voto appena dato: si salva direttamente
  if (tgs.flow && tgs.flow.contesto === 'nota-voto') {
    const { numero } = tgs.flow;
    // attesa di una nota rimasta dal formato precedente (nome del file)
    if (!numero) { tgs.flow = null; return say(PULSANTE_VECCHIO); }
    // solo la nota: il voto nella scheda puo' essere cambiato nel frattempo e non va riscritto
    const r = await salvaVoto({ numero, nota: testo });
    // in caso di errore si resta in attesa, cosi' la nota si puo' riscrivere
    if (!r.ok) return say(`Non ho salvato la nota: ${r.error}\nRiscrivi la nota oppure /annulla.`);
    tgs.flow = null;
    return say('Nota salvata.').then(() => menu());
  }
  const contesto = tgs.flow ? tgs.flow.contesto : '';
  tgs.flow = null;
  let p;
  try {
    p = await interpreta(testo, contesto);
  } catch (e) {
    return say(`Non riesco a interpretare il messaggio adesso (${e.message}). Riprova tra poco.`);
  }
  if (p.azione === 'domanda') return say(p.testo || 'Puoi spiegarmi meglio?');
  const err = valida(p);
  if (err) return say(`Non posso applicare questa modifica: ${err}. Puoi riformularla?`);
  tgs.seq = (tgs.seq || 0) + 1;
  const id = String(tgs.seq);
  tgs.pending[id] = p;
  const dettagli = JSON.stringify(p.dati, null, 1).slice(0, 1200);
  return say(`Ho capito cosi':\n${p.riassunto}\n\nDettagli:\n${dettagli}\n\nApplico?`, [
    { text: 'Conferma', callback_data: `ok:${id}` },
    { text: 'Annulla', callback_data: `no:${id}` },
  ]);
}

async function gestisciPulsante(cb) {
  // Pulsanti del menu guidato (m, v, vv, c, e, s, t, n)
  if (/^(m|v|vv|c|e|s|t|n):/.test(String(cb.data || ''))) {
    await tgRequest('answerCallbackQuery', { callback_query_id: cb.id });
    return menuPulsante(cb.data);
  }
  const [esito, id] = String(cb.data || '').split(':');
  const p = tgs.pending[id];
  await tgRequest('answerCallbackQuery', { callback_query_id: cb.id });
  if (!p) return say('Questa modifica non e\' piu\' in attesa.');
  delete tgs.pending[id];
  if (esito === 'no') return say('Modifica annullata.');
  try {
    const esitoApplicato = applica(p);
    log(`telegram: applicata modifica "${p.riassunto}" (${esitoApplicato})`);
    return say(`Applicato: ${esitoApplicato}.`);
  } catch (e) {
    log(`telegram: applicazione fallita: ${e.message}`);
    return say(`Non sono riuscito ad applicare la modifica: ${e.message}`);
  }
}

async function main() {
  const up = await tgRequest('getUpdates', { offset: tgs.offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  for (const u of up.result || []) {
    tgs.offset = u.update_id + 1;
    if (u.callback_query && u.callback_query.from && u.callback_query.from.id === CHAT) await gestisciPulsante(u.callback_query);
    else if (u.message && u.message.chat && u.message.chat.id === CHAT) await gestisciTesto(u.message);
    else log('telegram: messaggio da chat non autorizzata ignorato');
  }
}

try {
  await main();
  fs.writeFileSync(TG_FILE, JSON.stringify(tgs, null, 2));
  return [{ json: { telegram: 'ok', pending: Object.keys(tgs.pending).length } }];
} catch (e) {
  fs.writeFileSync(TG_FILE, JSON.stringify(tgs, null, 2));
  log(`telegram: errore: ${e.message}`);
  return [{ json: { telegram: 'errore', message: e.message } }];
}
