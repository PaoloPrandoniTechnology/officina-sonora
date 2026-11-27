// ---- Libreria condivisa: viene incollata in testa a ogni blocco dal build-workflow.mjs ----
const fs = require('fs');
const path = require('path');
const http = require('http');

// Confinamento: i blocchi possono scrivere solo nelle cartelle del progetto
const ZONE_SCRITTURA = ['E:\\Musica di sottofondo', 'E:\\n8n\\officina-sonora'].map((p) => p.toLowerCase());
if (!fs.__osGuard) {
  const dentro = (p) => {
    const abs = path.resolve(String(p)).toLowerCase();
    return ZONE_SCRITTURA.some((z) => abs === z || abs.startsWith(z + path.sep));
  };
  for (const nome of ['writeFileSync', 'appendFileSync', 'renameSync', 'mkdirSync', 'unlinkSync', 'rmSync', 'copyFileSync']) {
    const originale = fs[nome];
    fs[nome] = function (...args) {
      const destinazioni = nome === 'renameSync' || nome === 'copyFileSync' ? [args[1]] : [args[0]];
      for (const d of destinazioni) {
        if (!dentro(d)) throw new Error(`scrittura fuori dalle cartelle del progetto bloccata: ${d}`);
      }
      return originale.apply(this, args);
    };
  }
  fs.__osGuard = true;
}
// Lettura: le cartelle dei segreti e del gateway non sono leggibili dai blocchi
const LETTURA_VIETATA = ['E:\\n8n\\officina-sonora\\secrets', 'E:\\n8n\\officina-sonora\\gateway'].map((p) => p.toLowerCase());
if (!fs.__osReadGuard) {
  const letturaOriginale = fs.readFileSync;
  fs.readFileSync = function (p, ...args) {
    if (typeof p === 'string' && LETTURA_VIETATA.some((z) => path.resolve(p).toLowerCase().startsWith(z))) {
      throw new Error(`lettura bloccata: ${p}`);
    }
    return letturaOriginale.call(this, p, ...args);
  };
  fs.__osReadGuard = true;
}

const CFG = {
  root: 'E:\\Musica di sottofondo',
  dir: 'E:\\n8n\\officina-sonora',
  llm: 'http://127.0.0.1:1234/v1',
  llmModel: 'google/gemma-4-e4b',
  yue: 'http://127.0.0.1:18087',
  maxAttempts: 3,
  jobTimeoutMs: 4 * 3600 * 1000,
  resultFailsMax: 5,
  reviewEvery: 5,
  durMin: 120,
  durMax: 270,
  durDefault: 180,
  // energia 1 (molto calmo) .. 5 (molto energico). bpm: range di partenza, modificabile da guidance.json
  categories: [
    { name: 'Meditazione', energia: 1, bpm: [45, 65], attivita: 'meditazione, mindfulness', strutture: ['piatto', 'onda'] },
    { name: 'Pranayama-respiro', energia: 1, bpm: [50, 75], attivita: 'esercizi di respiro', strutture: ['piatto', 'onda'] },
    { name: 'Yin-Savasana', energia: 1, bpm: [40, 62], attivita: 'posizioni passive lunghe', strutture: ['piatto', 'onda'] },
    { name: 'Restorative', energia: 2, bpm: [50, 72], attivita: 'rilassamento guidato', strutture: ['onda', 'arco'] },
    { name: 'Sound-bath-rilassamento', energia: 2, bpm: [40, 60], attivita: 'sound bath', strutture: ['piatto', 'crescendo'] },
    { name: 'Hatha-base', energia: 3, bpm: [70, 95], attivita: 'hatha, asana basilari', strutture: ['arco', 'onda'] },
    { name: 'Vinyasa-dinamico', energia: 4, bpm: [90, 115], attivita: 'vinyasa, flusso', strutture: ['loop', 'crescendo', 'arco'] },
    { name: 'Power-yoga', energia: 5, bpm: [110, 135], attivita: 'power yoga, forza', strutture: ['loop', 'arco'] },
  ],
  tipi: ['ambient-pad', 'ambient-profondo', 'melodico-dolce', 'drone-spaziale', 'ritmico-leggero', 'ritmico-energico'],
  // Strutture: sezioni in ordine. Ogni categoria ne usa solo alcune.
  strutture: {
    piatto: ['[intro]', '[verse]', '[bridge]', '[verse]', '[outro]'],
    onda: ['[intro]', '[verse]', '[chorus]', '[verse]', '[bridge]', '[chorus]', '[outro]'],
    arco: ['[intro]', '[verse]', '[pre-chorus]', '[chorus]', '[verse]', '[bridge]', '[chorus]', '[outro]'],
    crescendo: ['[intro]', '[verse]', '[verse]', '[pre-chorus]', '[chorus]', '[bridge]', '[pre-chorus]', '[chorus]', '[outro]'],
    loop: ['[intro]', '[verse]', '[chorus]', '[verse]', '[bridge]', '[verse]', '[chorus]', '[chorus]', '[outro]'],
  },
  // solo i tag che la LoRA strumentale conosce
  sections: ['[intro]', '[verse]', '[pre-chorus]', '[chorus]', '[bridge]', '[outro]'],
  artista: 'Officina Sonora',
};
CFG.stateFile = path.join(CFG.dir, 'state', 'state.json');
CFG.logFile = path.join(CFG.dir, 'state', 'tick.log');
CFG.guidanceFile = path.join(CFG.dir, 'config', 'guidance.json');
CFG.historyDir = path.join(CFG.dir, 'config', 'history');
CFG.ffmpeg = 'E:\\MusicAI\\ffmpeg\\bin\\ffmpeg.exe';
CFG.scartati = path.join(CFG.root, '_scartati');
CFG.catalogoFile = path.join(CFG.dir, 'config', 'catalogo.json');
CFG.telegramFile = path.join(CFG.dir, 'config', 'telegram.json');
CFG.errorsFile = path.join(CFG.dir, 'state', 'errori.jsonl');
// Categorie, tipi, strutture e artista sono nel catalogo modificabile (anche da Telegram)
(function caricaCatalogo() {
  try {
    const c = JSON.parse(fs.readFileSync(CFG.catalogoFile, 'utf8'));
    for (const k of ['artista', 'categories', 'strutture', 'tag_extra', 'tassonomia']) if (c[k] !== undefined) CFG[k] = c[k];
    // i tipi sono oggetti {name, palette}; nel resto del codice servono i nomi
    if (c.tipi) {
      CFG.tipiPalette = Object.fromEntries(c.tipi.map((t) => [typeof t === 'string' ? t : t.name, typeof t === 'string' ? '' : t.palette]));
      CFG.tipi = Object.keys(CFG.tipiPalette);
    }
  } catch (e) { /* catalogo assente: restano i default del codice */ }
})();

// Parametri modificabili dalla dashboard (config/parametri.json) e comandi di produzione (state/comandi.json).
// Ogni valore e' accettato solo entro i limiti: un valore fuori scala viene ignorato e resta quello di default.
const LIMITI_PARAMETRI = {
  durMin: [60, 240], durMax: [120, 600], durDefault: [60, 600],
  maxAttempts: [1, 10], reviewEvery: [1, 50],
  pesoVoto: [0, 1000], minVotiAffidabili: [1, 20], maxEsperimenti: [0, 10],
  esplorazione: [0, 2], durataEsperimentoBrani: [1, 100],
  qcSilenzioDb: [-80, -20], qcSilenzioFrazione: [0.1, 1], qcDurataMin: [0.5, 1], qcDurataMax: [1, 2],
};
(function caricaParametri() {
  const p = readJsonSafe(path.join(CFG.dir, 'config', 'parametri.json'), {});
  for (const [k, [min, max]] of Object.entries(LIMITI_PARAMETRI)) {
    if (typeof p[k] === 'number' && p[k] >= min && p[k] <= max) CFG[k] = p[k];
  }
  // Generi: peso (0..5) e attivo (true/false) per nome di categoria
  CFG.generiOverride = {};
  for (const [nome, v] of Object.entries(p.generi || {})) {
    if (!v || typeof v !== 'object') continue;
    const peso = typeof v.peso === 'number' && v.peso >= 0 && v.peso <= 5 ? v.peso : 1;
    // Direttive scritte dal produttore per questo genere (in inglese se tradotte), massimo 10
    const direttive = (Array.isArray(v.note) ? v.note : [])
      .map((n) => String((n && (n.inglese || n.testo)) || '').trim()).filter(Boolean).slice(0, 10);
    CFG.generiOverride[nome] = { peso, attivo: v.attivo !== false, direttive };
  }
  CFG.comandi = readJsonSafe(path.join(CFG.dir, 'state', 'comandi.json'), {});
})();

// Aggiorna state\comandi.json: null/false/undefined rimuovono la chiave. Scrittura atomica.
function aggiornaComandi(patch) {
  const file = path.join(CFG.dir, 'state', 'comandi.json');
  const cur = readJsonSafe(file, {});
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === false) delete cur[k];
    else cur[k] = v;
  }
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 2));
  fs.renameSync(tmp, file);
  CFG.comandi = cur;
}

const DEFAULT_GUIDANCE = {
  versione: 1,
  style_extra: [],
  style_avoid: ['vocals', 'drums', 'sudden changes'],
  durata_hint: {
    'Meditazione': '240-270',
    'Pranayama-respiro': '180-240',
    'Hatha-base': '180-240',
    'Vinyasa-dinamico': '150-210',
    'Power-yoga': '120-180',
    'Yin-Savasana': '240-270',
    'Restorative': '240-270',
    'Sound-bath-rilassamento': '240-270',
  },
  bpm_range: {},
  struttura_pref: {},
  note: 'linee guida iniziali',
  aggiornato: null,
};

function log(msg) {
  fs.mkdirSync(path.dirname(CFG.logFile), { recursive: true });
  const ts = new Date().toISOString();
  // Rotazione: oltre 5 MB il log corrente viene archiviato (si tiene solo l'ultimo archivio)
  try {
    if (fs.statSync(CFG.logFile).size > 5 * 1024 * 1024) fs.renameSync(CFG.logFile, CFG.logFile + '.1');
  } catch (e) { /* log non ancora creato */ }
  try {
    if (fs.statSync(CFG.errorsFile).size > 2 * 1024 * 1024) fs.renameSync(CFG.errorsFile, CFG.errorsFile + '.1');
  } catch (e) { /* file non ancora creato */ }
  fs.appendFileSync(CFG.logFile, `${ts} ${msg}\n`);
  // Gli errori vengono anche registrati a parte: il bot Telegram avvisa quando si ripetono
  if (/fallit|errore|non riuscit|non valid|rifiutat|non raggiungibile|non attivo|scartat/i.test(msg)) {
    const key = msg.replace(/[0-9a-f]{12,}|\d+(\.\d+)?/gi, '#').slice(0, 160);
    fs.appendFileSync(CFG.errorsFile, JSON.stringify({ ts, key }) + '\n');
  }
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function loadState() {
  const s = readJsonSafe(CFG.stateFile, null) || {};
  return { cursor: 0, queue: [], job: null, done: 0, failed: [], recent: [], lastReview: 0, ...s };
}

function saveState(s) {
  fs.mkdirSync(path.dirname(CFG.stateFile), { recursive: true });
  const tmp = CFG.stateFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  try {
    fs.renameSync(tmp, CFG.stateFile);
  } catch (e) {
    fs.writeFileSync(CFG.stateFile, JSON.stringify(s, null, 2)); // Windows: rename puo' fallire se il file e' aperto
  }
}

// Lock contro esecuzioni sovrapposte: un file con token. Scade dopo maxMs, cosi' un crash non blocca per sempre.
const LOCK_MAX_MS = 15 * 60 * 1000;
function lockFile(nome) {
  return path.join(CFG.dir, 'state', nome + '.lock');
}
function acquireLock(nome, maxMs = LOCK_MAX_MS) {
  const file = lockFile(nome);
  const token = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  for (let giro = 0; giro < 2; giro++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ token, creato: new Date().toISOString() }), { flag: 'wx' });
      return token;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let eta;
      try { eta = Date.now() - fs.statSync(file).mtimeMs; } catch (e2) { continue; } // rilasciato nel frattempo: riprova
      if (eta < maxMs) return null; // occupato da un'altra esecuzione
      try { fs.unlinkSync(file); } catch (e3) { /* gia' rimosso */ }
    }
  }
  return null;
}
function releaseLock(nome, token) {
  const file = lockFile(nome);
  if (token && readJsonSafe(file, {}).token === token) fs.unlinkSync(file);
}
function lockOccupato(nome, maxMs = LOCK_MAX_MS) {
  try { return Date.now() - fs.statSync(lockFile(nome)).mtimeMs < maxMs; } catch (e) { return false; }
}

function readGuidance() {
  return readJsonSafe(CFG.guidanceFile, DEFAULT_GUIDANCE);
}

// Richiesta HTTP con modulo 'http' (la sandbox di n8n non ha fetch/URL).
// Ritorna {status, ok, headers, buf} senza lanciare su 4xx/5xx.
function req(method, url, { body, ms = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const m = /^http:\/\/([^:\/]+):(\d+)(\/.*)?$/.exec(url);
    if (!m) return reject(new Error(`URL non valido: ${url}`));
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {};
    const r = http.request(
      { hostname: m[1], port: Number(m[2]), path: m[3] || '/', method, headers, timeout: ms },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const code = res.statusCode;
          resolve({ status: code, ok: code >= 200 && code < 300, headers: res.headers, buf: Buffer.concat(chunks) });
        });
      }
    );
    r.on('timeout', () => r.destroy(new Error(`timeout ${ms}ms`)));
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Chiamate al gateway locale (token non presenti nei blocchi)
function gw(route, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body || {}));
    const r = http.request({ hostname: '127.0.0.1', port: 5790, path: route, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }, timeout: 900000 }, (res) => {
      const ch = [];
      res.on('data', (c) => ch.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, ...JSON.parse(Buffer.concat(ch).toString('utf8')) }); } catch (e) { reject(new Error('risposta gateway non valida')); }
      });
    });
    r.on('timeout', () => r.destroy(new Error('timeout gateway')));
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}
// Upload di un brano: il gateway aggiunge l'autenticazione
function gwUpload(nome, buf) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: '127.0.0.1', port: 5790, path: '/ib/upload', method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length, 'x-file-name': nome }, timeout: 900000 }, (res) => {
      const ch = [];
      res.on('data', (c) => ch.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, ...JSON.parse(Buffer.concat(ch).toString('utf8')) }); } catch (e) { reject(new Error('risposta gateway non valida')); }
      });
    });
    r.on('timeout', () => r.destroy(new Error('timeout gateway')));
    r.on('error', reject);
    r.write(buf);
    r.end();
  });
}

async function getJson(url, ms = 20000) {
  const r = await req('GET', url, { ms });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} ${url}`), { status: r.status });
  return JSON.parse(r.buf.toString('utf8'));
}

async function engineUp() {
  try {
    await getJson(`${CFG.yue}/health`, 5000);
    return true;
  } catch (e) {
    return false;
  }
}

// Chiamata al modello locale: ritorna il primo oggetto JSON presente nella risposta.
async function llmJson(system, user, maxTokens = 1200) {
  const r = await req('POST', `${CFG.llm}/chat/completions`, {
    ms: 600000,
    body: {
      model: CFG.llmModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    },
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}`);
  const text = JSON.parse(r.buf.toString('utf8')).choices[0].message.content || '';
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('nessun JSON nella risposta del modello');
  return JSON.parse(text.slice(a, b + 1));
}

function slugify(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'brano';
}

function uniquePath(dir, base, ext) {
  let name = base;
  let i = 2;
  while (fs.existsSync(path.join(dir, name + ext))) name = `${base}-${i++}`;
  return path.join(dir, name + ext);
}

// Cartella di un brano: radice / Yoga o Sottofondo / famiglia / categoria / tipo
function cartellaBrano(categoria, tipo) {
  const c = (CFG.categories || []).find((x) => x.name === categoria) || {};
  const ambito = c.ambito === 'yoga' ? 'Yoga' : 'Sottofondo';
  return path.join(CFG.root, ambito, c.famiglia || 'generale', categoria || 'senza-categoria', tipo || 'senza-tipo');
}

// Slot deterministico: ruota su categoria, tipo e struttura, cosi' i brani sono variati.
function slotFor(cursor, guidance = DEFAULT_GUIDANCE) {
  const n = CFG.categories.length;
  const category = CFG.categories[cursor % n];
  const round = Math.floor(cursor / n);
  const allowed = (guidance.struttura_pref && guidance.struttura_pref[category.name]) || category.strutture;
  const structure = allowed[round % allowed.length];
  const tipo = CFG.tipi[round % CFG.tipi.length];
  return { category: { ...category, bpm: bpmRangeOf(guidance, category) }, tipo, struttura: structure, sezioni: CFG.strutture[structure] };
}

// Intervallo bpm "min-max" da guidance, o il default della categoria
function bpmRangeOf(guidance, category) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec((guidance.bpm_range || {})[category.name] || '');
  return m ? [Number(m[1]), Number(m[2])] : category.bpm;
}

function clampDur(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return CFG.durDefault;
  return Math.min(CFG.durMax, Math.max(CFG.durMin, n));
}

// Intervallo "min-max" dal suggerimento di durata per categoria (default: intero range).
function durRange(guidance, category) {
  const h = (guidance.durata_hint || {})[category];
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(h || '');
  if (!m) return [CFG.durMin, CFG.durMax];
  return [clampDur(m[1]), clampDur(m[2])];
}

// ---- Richieste al motore: prima il solo score (lo scrive il modello), poi il render dell'audio ----
function richiestaBase(concept, adapters, seed) {
  return {
    style: concept.style,
    lyrics: concept.lyrics,
    cot: (concept.attempts || 0) >= 2 ? 'melody' : 'full', // full: score con melodia e accordi
    ...(adapters.length ? { adapters } : {}),
    seed,
  };
}

// Solo lo score, senza LoRA (agiscono sul render): un secondo di audio e un passo, il resto si butta
function corpoPiano(concept, seed) {
  return {
    ...richiestaBase(concept, [], seed),
    duration: 1,
    steps: 1,
    semantic_sampling: { min_tokens: 1, max_tokens: 25 },
    abc_sampling: { max_tokens: 6000 }, // circa 6 minuti: oltre, il modello sta girando a vuoto
    output_format: 'mp3',
  };
}

// Render dell'audio. secondi = durata dello score, se nota: il motore non puo' chiudere prima del 90%.
function corpoRender(concept, adapters, seed, abc, secondi) {
  // 360 s: limite del motore. Si chiede piu' durata dello score, cosi' il brano si chiude da solo
  const durata = Math.min(360, secondi ? Math.ceil(secondi * 1.15) : Math.round(concept.durata_s * 1.2));
  const token = Math.min(9000, Math.round(durata * 25 * 1.2));
  return {
    ...richiestaBase(concept, adapters, seed),
    duration: durata,
    semantic_sampling: { max_tokens: token, ...(secondi ? { min_tokens: Math.floor(secondi * 0.9 * 25) } : {}) },
    ...(abc ? { abc } : { abc_sampling: { max_tokens: Math.max(512, token) } }),
    // WAV per il mastering; dopo un fallimento si chiede l'MP3, che ne puo' fare a meno
    output_format: concept.attempts ? 'mp3' : 'wav32',
  };
}

// Invia una richiesta al motore; ritorna l'id del job, o null se rifiutata
async function inviaSynth(body) {
  const r = await req('POST', `${CFG.yue}/synth`, { body, ms: 20000 });
  if (!r.ok) { log(`/synth rifiutato (HTTP ${r.status}): riprovo al prossimo giro`); return null; }
  return JSON.parse(r.buf.toString('utf8')).id;
}

const nuovoSeed = () => Math.floor(Math.random() * 2147483647);

// Rimette in coda il concept del job corrente, o lo scarta dopo maxAttempts tentativi.
function requeue(state, reason) {
  const c = state.job.concept;
  state.job = null;
  c.attempts = (c.attempts || 0) + 1;
  if (c.attempts >= CFG.maxAttempts) {
    state.failed.push({ titolo: c.titolo, categoria: c.categoria, tipo: c.tipo, motivo: reason, at: new Date().toISOString() });
    log(`scartato "${c.titolo}" dopo ${c.attempts} tentativi: ${reason}`);
  } else {
    state.queue.unshift(c);
    log(`riaccodo "${c.titolo}" (tentativo ${c.attempts}): ${reason}`);
  }
}

// Lo score ABC che il motore ha seguito, dalle parti JSON della risposta; null se assente.
function extractAbc(buf, ct) {
  const m = /boundary="?([^";]+)"?/i.exec(ct || '');
  if (!m) return null;
  // si leggono come testo solo le parti JSON: l'audio WAV pesa oltre 100 MB
  const sep = Buffer.from('--' + m[1]);
  for (let da = buf.indexOf(sep); da !== -1;) {
    const a = buf.indexOf(sep, da + sep.length);
    const parte = buf.subarray(da + sep.length, a === -1 ? buf.length : a);
    da = a;
    const i = parte.indexOf('\r\n\r\n');
    if (i === -1 || !/application\/json/i.test(parte.subarray(0, i).toString('utf8'))) continue;
    try {
      const abc = JSON.parse(parte.subarray(i + 4).toString('utf8').trim()).abc;
      if (abc) return abc;
    } catch (e) { /* parte JSON non valida */ }
  }
  return null;
}

// Estrae la traccia audio dalla risposta multipart del motore.
function extractAudio(buf, ct) {
  const m = /boundary="?([^";]+)"?/i.exec(ct || '');
  if (!m) return { data: buf, ext: 'mp3' };
  const sep = Buffer.from('--' + m[1]);
  const parts = [];
  let idx = buf.indexOf(sep);
  while (idx !== -1) {
    const start = idx + sep.length;
    const next = buf.indexOf(sep, start);
    parts.push(buf.subarray(start, next === -1 ? buf.length : next));
    idx = next;
  }
  for (const p of parts) {
    const hEnd = p.indexOf('\r\n\r\n');
    if (hEnd === -1) continue;
    const head = p.subarray(0, hEnd).toString('utf8').toLowerCase();
    if (!(head.includes('audio/') || head.includes('filename'))) continue;
    let data = p.subarray(hEnd + 4);
    if (data.length >= 2 && data[data.length - 2] === 13 && data[data.length - 1] === 10) data = data.subarray(0, -2);
    const ext = /flac/.test(head) ? 'flac' : /wav/.test(head) ? 'wav' : /ogg/.test(head) ? 'ogg' : 'mp3';
    return { data, ext };
  }
  throw new Error('nessuna traccia audio nella risposta');
}
