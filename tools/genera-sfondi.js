// Genera in anticipo gli sfondi delle copertine: 8 per genere in assets/sfondi/<categoria>/NN.jpg.
// Uso: node tools/genera-sfondi.js [--genere NOME] [--max N]
// Mette in pausa la produzione, aspetta il render in corso, usa la WebUI e ripristina tutto alla fine.
// Riprendibile: crea solo i file mancanti (per rifare un'immagine, cancellarla e rilanciare).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { stileCopertina } = require('../gateway/copertina');

const DIR = path.join(__dirname, '..');
const SFONDI = path.join(DIR, 'assets', 'sfondi');
const COMANDI = path.join(DIR, 'state', 'comandi.json');
const STATO = path.join(DIR, 'state', 'state.json');
const PID = path.join(DIR, 'state', 'sfondi.pid'); // letto dalla dashboard (gateway/sfondi.js)
const FERMA = path.join(DIR, 'state', 'sfondi.stop'); // richiesta di stop dalla dashboard
const LIBRERIA = 'E:\\Musica di sottofondo';
const FFMPEG = 'E:\\MusicAI\\ffmpeg\\bin\\ffmpeg.exe';
const WEBUI = 'E:\\StableDiffusion\\webui';
const PORTA = 7861;
const NEGATIVO = 'text, letters, watermark, signature, logo, frame, border, face, deformed hands, extra fingers, lowres, blurry, jpeg artifacts';

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const leggi = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };

function mancanti(categorie, cartella = SFONDI, n = 8) {
  return categorie.flatMap((categoria) => Array.from({ length: n }, (_, i) => ({
    categoria, file: path.join(cartella, categoria, String(i + 1).padStart(2, '0') + '.jpg'), seed: Math.floor(Math.random() * 2 ** 31),
  })).filter((x) => !fs.existsSync(x.file)));
}

function scrivi(file, dati) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(dati, null, 2));
  fs.renameSync(file + '.tmp', file);
}

// Pulizie da eseguire subito se la finestra viene chiusa (Windows concede pochi secondi)
const pulizie = new Set();
const emergenza = () => [...pulizie].reverse().forEach((f) => f());

// Esegue fn con la produzione in pausa; lo stato precedente torna anche in caso di errore.
async function conPausa(fn, file = COMANDI) {
  const esisteva = fs.existsSync(file);
  const prima = leggi(file, {});
  if (!prima.pausa) scrivi(file, { ...prima, pausa: true });
  const ripristina = () => {
    if (!prima.pausa) {
      const ora = leggi(file, {});
      delete ora.pausa;
      if (!esisteva && !Object.keys(ora).length) fs.rmSync(file, { force: true });
      else scrivi(file, ora);
    }
  };
  pulizie.add(ripristina);
  try {
    return await fn(() => !!leggi(file, {}).pausa);
  } finally {
    pulizie.delete(ripristina);
    ripristina();
  }
}

// node:http senza il limite di 300 s di fetch: in --lowvram un'immagine puo' superarlo
function webui(rotta, corpo, ms = 20 * 60000) {
  return new Promise((resolve, reject) => {
    const data = corpo ? Buffer.from(JSON.stringify(corpo)) : null;
    const r = http.request({ hostname: '127.0.0.1', port: PORTA, path: rotta, method: data ? 'POST' : 'GET', timeout: ms,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, (res) => {
      const ch = [];
      res.on('data', (c) => ch.push(c));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error('HTTP ' + res.statusCode);
          resolve(JSON.parse(Buffer.concat(ch).toString('utf8')));
        } catch (e) { reject(e); }
      });
    });
    r.on('timeout', () => r.destroy(new Error('tempo scaduto')));
    r.on('error', reject);
    r.end(data);
  });
}
const pronta = () => webui('/sdapi/v1/sd-models', null, 5000).then(() => true, () => false);

async function avviaWebui(interrotto) {
  if (await pronta()) return () => {}; // gia' aperta da qualcun altro: la si usa e non la si chiude
  const log = fs.openSync(path.join(DIR, 'state', 'webui-sfondi.log'), 'w');
  const p = spawn('cmd.exe', ['/d', '/c', `call .\\environment.bat && cd webui && python launch.py --api --lowvram --port ${PORTA}`], { cwd: WEBUI, stdio: ['ignore', log, log], windowsHide: true });
  const chiudi = () => { try { execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* gia' chiusa */ } };
  pulizie.add(chiudi);
  const fine = Date.now() + 10 * 60000;
  while (Date.now() < fine && p.exitCode === null && !interrotto()) {
    if (await pronta()) return chiudi;
    await attendi(5000);
  }
  chiudi();
  throw new Error('WebUI non avviata: vedere state\\webui-sfondi.log');
}

function conBrani() {
  const nomi = new Set();
  if (fs.existsSync(LIBRERIA)) {
    for (const f of fs.readdirSync(LIBRERIA, { recursive: true })) {
      if (f.endsWith('.mp3') && !f.includes('_scartati')) for (const parte of f.split(path.sep)) nomi.add(parte);
    }
  }
  return nomi;
}

function foglio(dir) {
  const file = fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).sort();
  if (file.length < 2) return;
  const filtro = file.map((_, i) => `[${i}]scale=384:384[s${i}]`).join(';') + ';' + file.map((_, i) => `[s${i}]`).join('')
    + `xstack=inputs=${file.length}:fill=white:layout=${file.map((_, i) => `${(i % 4) * 384}_${Math.floor(i / 4) * 384}`).join('|')}`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...file.flatMap((f) => ['-i', path.join(dir, f)]), '-filter_complex', filtro, '-frames:v', '1', '-q:v', '3', path.join(dir, '_foglio.jpg')]);
}

async function genera(lavoro) {
  const stile = stileCopertina(lavoro.categoria);
  const r = await webui('/sdapi/v1/txt2img', {
    prompt: stile.prompt + ', masterpiece, detailed', negative_prompt: NEGATIVO, width: 768, height: 768, steps: 28, cfg_scale: 7,
    sampler_name: 'DPM++ 2M', scheduler: 'Karras', seed: lavoro.seed, override_settings: { sd_model_checkpoint: 'Deliberate_v6' },
  });
  if (!r.images || !r.images[0]) throw new Error('nessuna immagine nella risposta');
  fs.mkdirSync(path.dirname(lavoro.file), { recursive: true });
  const tmp = lavoro.file + '.tmp.jpg'; // il nome finale compare solo a conversione riuscita
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'png_pipe', '-i', 'pipe:0', '-q:v', '3', tmp], { input: Buffer.from(r.images[0], 'base64') });
  fs.renameSync(tmp, lavoro.file);
}

async function main() {
  const arg = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined; };
  const cat = require('../config/catalogo.json').categories.map((c) => c.name);
  const genere = arg('--genere');
  if (genere && !cat.includes(genere)) throw new Error('genere sconosciuto: ' + genere);
  const presenti = conBrani();
  const scelte = genere ? [genere] : [...cat].sort((a, b) => Number(presenti.has(b)) - Number(presenti.has(a)));
  const lavori = mancanti(scelte).slice(0, Number(arg('--max')) || undefined);
  if (!lavori.length) return console.log('nessuno sfondo da generare');
  console.log(`sfondi da generare: ${lavori.length}`);

  let stop = false;
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { stop = true; console.log('interruzione richiesta: chiudo dopo la fase in corso'); });
  for (const s of ['SIGHUP', 'SIGBREAK']) process.on(s, () => { emergenza(); process.exit(1); });
  console.log('la produzione resta in pausa finche questo programma lavora');
  fs.writeFileSync(PID, String(process.pid));
  fs.rmSync(FERMA, { force: true });
  process.on('exit', () => { fs.rmSync(PID, { force: true }); fs.rmSync(FERMA, { force: true }); });

  await conPausa(async (inPausa) => {
    const interrotto = () => stop || !inPausa() || fs.existsSync(FERMA);
    const limite = Date.now() + 20 * 60000;
    while (leggi(STATO, {}).job) {
      if (interrotto()) return;
      if (Date.now() > limite) throw new Error('il render in corso non finisce: riprovare piu tardi');
      console.log('attendo la fine del render in corso...');
      await attendi(30000);
    }
    const chiudi = await avviaWebui(interrotto);
    let errori = 0;
    try {
      for (let i = 0; i < lavori.length && !interrotto(); i++) {
        const l = lavori[i];
        const t = Date.now();
        try {
          await genera(l);
          errori = 0;
          console.log(`${i + 1}/${lavori.length} ${l.categoria}/${path.basename(l.file)} (${Math.round((Date.now() - t) / 1000)} s)`);
        } catch (e) {
          console.error(`${l.categoria}/${path.basename(l.file)} non riuscito: ${e.message}`);
          if (++errori >= 3) throw new Error('tre errori di fila: mi fermo');
        }
        if (!lavori[i + 1] || lavori[i + 1].categoria !== l.categoria) {
          if (fs.existsSync(path.dirname(l.file))) foglio(path.dirname(l.file));
        }
      }
      if (!inPausa()) console.log('produzione ripresa dalla dashboard: mi fermo');
      else if (fs.existsSync(FERMA)) console.log('generazione fermata dalla dashboard');
    } finally {
      chiudi();
    }
  });
  console.log('finito; produzione nello stato precedente');
}

module.exports = { mancanti, conPausa, emergenza };
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
