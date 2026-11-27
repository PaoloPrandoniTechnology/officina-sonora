// Stato in tempo reale per la dashboard locale. Sola lettura: non scrive nulla e non contiene token.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const STATE = 'E:\\n8n\\officina-sonora\\state';
const LMS = path.join(process.env.USERPROFILE || '', '.cache', 'lm-studio', 'bin', 'lms.exe');

function ping(url, ms = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function getJson(url, ms = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      const ch = [];
      res.on('data', (c) => ch.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(ch).toString('utf8'))); } catch (e) { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// Modelli caricati in LM Studio (stesso comando che usa il watchdog)
function lmsPs() {
  return new Promise((resolve) => {
    execFile(LMS, ['ps'], { timeout: 8000, windowsHide: true }, (err, stdout, stderr) => {
      resolve(String(stdout || '') + String(stderr || ''));
    });
  });
}

function leggiJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// Ultime righe di un file, leggendo solo la coda (il log puo' essere grande)
function coda(file, righe = 15) {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, 65536);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      return buf.toString('utf8').split('\n').filter(Boolean).slice(-righe);
    } finally { fs.closeSync(fd); }
  } catch (e) { return []; }
}

// Durata media degli ultimi render, dal log di produzione
function renderMedio() {
  const durate = coda(path.join(STATE, 'tick.log'), 400)
    .map((l) => /render (\d+)s/.exec(l)).filter(Boolean).map((m) => Number(m[1]));
  const ultimi = durate.slice(-5);
  return ultimi.length ? Math.round(ultimi.reduce((a, b) => a + b, 0) / ultimi.length) : null;
}

function eta(file) {
  try { return Math.round((Date.now() - fs.statSync(file).mtimeMs) / 1000); } catch (e) { return null; }
}

// Ultime esecuzioni del workflow dal database di n8n (sola lettura, se disponibile)
function ultimeEsecuzioni() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('E:/n8n/data/.n8n/database.sqlite', { readOnly: true });
    try {
      return db.prepare(`SELECT id, status, startedAt, stoppedAt FROM execution_entity
        WHERE workflowId = 'yogaMusicFactory01' ORDER BY id DESC LIMIT 5`).all();
    } finally { db.close(); }
  } catch (e) { return []; }
}

async function leggiStato() {
  const [n8n, yue, lmAttivo, ps] = await Promise.all([
    ping('http://127.0.0.1:5678/healthz'),
    ping('http://127.0.0.1:18087/health'),
    ping('http://127.0.0.1:1234/v1/models'),
    lmsPs(),
  ]);
  const state = leggiJson(path.join(STATE, 'state.json'), {});
  const job = state.job || null;
  let render = null;
  let statoYue = null;
  if (job) {
    statoYue = (await getJson(`http://127.0.0.1:18087/job?id=${encodeURIComponent(job.id)}`)) || {};
    render = {
      titolo: job.concept && job.concept.titolo,
      genere: job.concept && job.concept.genere,
      categoria: job.concept && job.concept.categoria,
      durataRichiesta_s: job.concept && job.concept.durata_s,
      trascorsi_s: Math.round((Date.now() - job.submittedAt) / 1000),
      renderMedio_s: renderMedio(),
      statoMotore: statoYue.status || 'sconosciuto',
    };
  }
  const lockFile = path.join(STATE, 'pipeline.lock');
  const lockEta = eta(lockFile);
  const supervisoreLog = coda(path.join(STATE, 'supervisore.log'), 3);
  const liberoGb = (() => {
    try { const s = fs.statfsSync('E:\\'); return Math.round((s.bavail * s.bsize) / 1e9); } catch (e) { return null; }
  })();
  return {
    ora: new Date().toISOString(),
    servizi: {
      n8n,
      motoreYue: yue,
      lmStudio: lmAttivo,
      gemmaCaricato: /gemma/i.test(ps),
    },
    render,
    pipeline: {
      occupata: lockEta !== null && lockEta < 900,
      etaLock_s: lockEta,
      coda: (state.queue || []).length,
      brani: state.done || 0,
      scartati: state.scartati || 0,
    },
    watchdog: { battito_s: eta(path.join(STATE, 'watchdog.heartbeat')) },
    supervisore: { ultimeRighe: supervisoreLog, ultimoRun_s: eta(path.join(STATE, 'supervisore.log')) },
    sistema: { disco_E_liberoGb: liberoGb },
    esecuzioni: ultimeEsecuzioni(),
    logProduzione: coda(path.join(STATE, 'tick.log'), 20),
  };
}

module.exports = { leggiStato };
