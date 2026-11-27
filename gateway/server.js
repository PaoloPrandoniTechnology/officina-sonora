// Gateway locale: unico processo che conosce i token (Telegram, iBroadcast).
// I blocchi di n8n chiamano questo servizio su 127.0.0.1 e non vedono mai i token.
// Avviato dal watchdog con i token nel proprio ambiente; non passano a n8n.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { leggiStato } = require('./stato');
const { datiAnalisi } = require('./analisi');
const controllo = require('./controllo');

const PORT = 5790;
const TOKEN_FILE = path.join(__dirname, 'token.json');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const IB_CLIENT = process.env.IBROADCAST_CLIENT_ID || '';
const TG_METODI = new Set(['sendMessage', 'getUpdates', 'answerCallbackQuery']);
const IB_MODI = new Set(['createtag', 'tagtracks', 'createplaylist', 'appendplaylist', 'trash', 'ratetrack']);

let cache = { access: null, scadenza: 0 };

function leggiRefresh() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).refresh; } catch (e) { return process.env.IBROADCAST_REFRESH || ''; }
}
function salvaRefresh(refresh) {
  const tmp = TOKEN_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ refresh, aggiornato: new Date().toISOString() }));
  fs.renameSync(tmp, TOKEN_FILE);
}

// Richiesta HTTPS generica: ritorna {status, json, buf}
function httpsReq(hostname, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({ hostname, path: pathname, method: 'POST', headers: { ...headers, 'Content-Length': body.length }, timeout: 900000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch (e) { /* non JSON */ }
        resolve({ status: res.statusCode, json, buf });
      });
    });
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

async function accessToken() {
  if (cache.access && Date.now() < cache.scadenza - 60000) return cache.access;
  const refresh = leggiRefresh();
  if (!refresh || !IB_CLIENT) throw new Error('iBroadcast non configurato');
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  const body = Buffer.from(`grant_type=refresh_token&client_id=${enc(IB_CLIENT)}&refresh_token=${enc(refresh)}`);
  const r = await httpsReq('oauth.ibroadcast.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  if (!r.json || !r.json.access_token) throw new Error(`refresh non valido (HTTP ${r.status}): ${r.json ? r.json.error : ''}`);
  // il refresh token ruota: il nuovo va salvato subito
  salvaRefresh(r.json.refresh_token || refresh);
  cache = { access: r.json.access_token, scadenza: Date.now() + (r.json.expires_in || 3600) * 1000 };
  return cache.access;
}

// Lettura della libreria (sola lettura): brani, playlist, tag e ascolti
async function ibLibrary() {
  const access = await accessToken();
  const body = Buffer.from(JSON.stringify({ client: 'yoga-music-factory', version: '1.0', device_name: 'yoga-music-factory', user_agent: 'yoga-music-factory', mode: 'library' }));
  const r = await httpsReq('library.ibroadcast.com', '/library', { 'Content-Type': 'application/json', 'User-Agent': 'yoga-music-factory', Authorization: 'Bearer ' + access }, body);
  return { status: r.status, json: r.json };
}

async function ibApi(mode, args) {
  if (!IB_MODI.has(mode)) throw new Error(`operazione non permessa: ${mode}`);
  const access = await accessToken();
  const body = Buffer.from(JSON.stringify({ client: 'yoga-music-factory', version: '1.0', device_name: 'yoga-music-factory', user_agent: 'yoga-music-factory', mode, ...args }));
  const r = await httpsReq('api.ibroadcast.com', `/${mode}`, { 'Content-Type': 'application/json', 'User-Agent': 'yoga-music-factory', Authorization: `Bearer ${access}` }, body);
  return { status: r.status, json: r.json };
}

function multipart(fields, fileName, fileData) {
  const boundary = '----gw' + Date.now().toString(16);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
  parts.push(fileData);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function upload(fileName, data) {
  const access = await accessToken();
  const m = multipart({ client: 'yoga-music-factory', version: '1.0', file_path: fileName, method: 'yoga-music-factory' }, fileName, data);
  const r = await httpsReq('upload.ibroadcast.com', '/', { 'Content-Type': m.contentType, Authorization: `Bearer ${access}` }, m.body);
  return { status: r.status, json: r.json };
}

async function telegram(method, body) {
  if (!TG_METODI.has(method)) throw new Error(`metodo Telegram non permesso: ${method}`);
  const data = Buffer.from(JSON.stringify(body || {}));
  const r = await httpsReq('api.telegram.org', `/bot${TG_TOKEN}/${method}`, { 'Content-Type': 'application/json' }, data);
  return r.json || { ok: false, status: r.status };
}

function leggiCorpo(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Analisi PCM di un brano della libreria: livello, silenzi e clipping. Il decoder si carica solo qui.
const LIBRERIA = 'e:\\musica di sottofondo';
async function analizzaAudio(file) {
  const abs = path.resolve(String(file || ''));
  if (!abs.toLowerCase().startsWith(LIBRERIA + path.sep)) throw new Error('file fuori dalla libreria');
  const { MPEGDecoder } = require('mpg123-decoder');
  const dec = new MPEGDecoder();
  await dec.ready;
  try {
    const out = dec.decode(new Uint8Array(fs.readFileSync(abs)));
    const canali = out.channelData;
    const n = out.samplesDecoded;
    const blocco = Math.round(out.sampleRate * 0.5); // blocchi da mezzo secondo per cercare i silenzi
    let sommaQuadr = 0, picco = 0, clip = 0, blocchi = 0, silenziosi = 0, quadrBlocco = 0, contaBlocco = 0;
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let c = 0; c < canali.length; c++) v += canali[c][i];
      v /= canali.length;
      const a = Math.abs(v);
      if (a > picco) picco = a;
      if (a >= 0.999) clip++;
      sommaQuadr += v * v;
      quadrBlocco += v * v;
      contaBlocco++;
      if (contaBlocco === blocco || i === n - 1) {
        const db = 10 * Math.log10(quadrBlocco / contaBlocco + 1e-12);
        blocchi++;
        if (db < -50) silenziosi++;
        quadrBlocco = 0; contaBlocco = 0;
      }
    }
    const db = (x) => Math.round(10 * Math.log10(x + 1e-12) * 10) / 10;
    return {
      durata_s: Math.round(n / out.sampleRate),
      rms_db: db(sommaQuadr / Math.max(1, n)),
      picco_db: db(picco * picco),
      frazione_silenzio: blocchi ? silenziosi / blocchi : 0,
      frazione_clip: n ? clip / (n * canali.length) : 0,
    };
  } finally {
    dec.free();
  }
}

const server = http.createServer(async (req, res) => {
  const rispondi = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') return rispondi(403, { ok: false });
    // Dashboard di sola lettura (solo da questo PC)
    if (req.method === 'GET' && req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(__dirname, 'dashboard.html')));
    }
    if (req.method === 'GET' && req.url === '/api/stato') return rispondi(200, await leggiStato());
    if (req.method === 'GET' && req.url === '/api/dati') return rispondi(200, datiAnalisi());
    if (req.method === 'GET' && req.url === '/api/controllo') return rispondi(200, controllo.lettura());
    if (req.method !== 'POST') return rispondi(405, { ok: false });
    const corpo = await leggiCorpo(req);
    // Plancia di controllo: le scritture richiedono l'intestazione X-Controllo (un sito esterno non puo' inviarla)
    if (req.url.startsWith('/api/controllo/')) {
      if (req.headers['x-controllo'] !== '1') return rispondi(403, { ok: false, error: 'intestazione mancante' });
      let dati;
      try { dati = JSON.parse(corpo.toString('utf8') || '{}'); } catch (e) { return rispondi(400, { ok: false, error: 'JSON non valido' }); }
      const r = await controllo.gestisci(req.url, dati);
      return rispondi(r.codice, r.corpo);
    }
    if (req.url === '/tg') {
      const { method, body } = JSON.parse(corpo.toString('utf8'));
      return rispondi(200, await telegram(method, body));
    }
    if (req.url === '/ib/api') {
      const { mode, args } = JSON.parse(corpo.toString('utf8'));
      return rispondi(200, await ibApi(mode, args || {}));
    }
    if (req.url === '/audio/analizza') {
      const { file } = JSON.parse(corpo.toString('utf8'));
      return rispondi(200, await analizzaAudio(file));
    }
    if (req.url === '/copertina') {
      const r = await require('./copertina').componi(JSON.parse(corpo.toString('utf8')));
      return rispondi(200, r ? { ok: true, jpeg: r.jpeg.toString('base64') } : { ok: false, error: 'nessuno sfondo per il genere' });
    }
    if (req.url === '/ib/library') {
      return rispondi(200, await ibLibrary());
    }
    if (req.url === '/ib/upload') {
      const nome = path.basename(String(req.headers['x-file-name'] || 'brano.mp3'));
      return rispondi(200, await upload(nome, corpo));
    }
    return rispondi(404, { ok: false });
  } catch (e) {
    return rispondi(500, { ok: false, error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`gateway in ascolto su 127.0.0.1:${PORT}`));
