// Genera un lotto di copertine: gli sfondi mancanti dei generi (8 in assets/sfondi/<categoria>/NN.jpg) e
// un'immagine propria per ogni brano che non l'ha (assets/copertine/<numero>.jpg), anche per quelli in coda.
// La scena di ogni brano la scrivono i modelli di testo e resta nel registro, per non ripetersi.
// Uso: node tools/genera-sfondi.js [--genere NOME] [--max N]   (N = immagini del lotto, 40 se non indicato)
// Mette in pausa la produzione, aspetta il render in corso, usa la WebUI e ripristina tutto alla fine.
// Riprendibile: per rifare la copertina di un brano togliere copertina_propria dalla scheda e cancellare l'immagine.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { stileCopertina, componi } = require('../gateway/copertina');
const { sostituisciCopertina } = require('../gateway/id3');
const { daFare } = require('../gateway/sfondi');

const DIR = path.join(__dirname, '..');
const SFONDI = path.join(DIR, 'assets', 'sfondi');
const COPERTINE = path.join(DIR, 'assets', 'copertine');
const REGISTRO = path.join(COPERTINE, 'registro.json');
const LOTTO = 40; // circa mezz'ora di produzione ferma
const GATEWAY = Number(process.env.OFS_PORTA) || 5790;
const COMANDI = path.join(DIR, 'state', 'comandi.json');
const STATO = path.join(DIR, 'state', 'state.json');
const PID = path.join(DIR, 'state', 'sfondi.pid'); // letto dalla dashboard (gateway/sfondi.js)
const FERMA = path.join(DIR, 'state', 'sfondi.stop'); // richiesta di stop dalla dashboard
const LIBRERIA = 'E:\\Musica di sottofondo';
const FFMPEG = 'E:\\MusicAI\\ffmpeg\\bin\\ffmpeg.exe';
const WEBUI = 'E:\\StableDiffusion\\webui';
const { scriviAtomico } = require('../gateway/disco');
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
  scriviAtomico(file, JSON.stringify(dati, null, 2));
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
function webui(rotta, corpo, ms = 20 * 60000, porta = PORTA) {
  return new Promise((resolve, reject) => {
    const data = corpo ? Buffer.from(JSON.stringify(corpo)) : null;
    const r = http.request({ hostname: '127.0.0.1', port: porta, path: rotta, method: data ? 'POST' : 'GET', timeout: ms,
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

// Una tecnica diversa a ogni richiesta: senza, i modelli tendono a proporre sempre la stessa fotografia
const TECNICHE = ['fine art photography', 'oil painting', 'gouache illustration', 'screen print poster', 'watercolor',
  'linocut print', 'cinematic matte painting', 'paper cut collage', 'long exposure photography', 'ink wash painting',
  'risograph print', 'aerial photography', 'pastel drawing', 'macro photography', 'art nouveau lithograph', 'low poly 3d render'];

const parole = (s) => new Set(String(s).toLowerCase().match(/\p{L}{4,}/gu) || []);
// Quota di parole in comune tra due scene (0 nessuna, 1 identiche)
function somiglianza(a, b) {
  const x = parole(a), y = parole(b);
  const comuni = [...x].filter((p) => y.has(p)).length;
  return comuni / (x.size + y.size - comuni || 1);
}

function richiestaScena(meta, tecnica, usate) {
  return {
    system: 'You are the art director of a record label. Reply ONLY with JSON: {"scena":"..."}. '
      + 'scena is the cover image of ONE specific track, in English, 20 to 45 words, for a text-to-image model: '
      + 'a concrete main subject that evokes the meaning of the track title and description, its setting, light and colors, '
      + 'coherent with genre, instruments and energy, rendered in the requested technique. '
      + 'No text, letters, logos or human faces. It must differ in subject and composition from every scene in "already_used".',
    user: JSON.stringify({
      title: meta.titolo, description: meta.descrizione, category: meta.categoria, genre: meta.genere, variant: meta.variante,
      instruments: meta.strumenti, activity: meta.attivita, energy_1_to_5: meta.energia, structure: meta.struttura,
      bpm: meta.bpm, key: meta.tonalita, music_style: meta.style, technique: tecnica, already_used: usate,
    }),
    maxTokens: 300,
  };
}

// Scena nuova per un brano: fino a tre richieste se il modello ripropone qualcosa di già usato.
async function scenaPer(meta, registro, chiedi) {
  const voci = Object.values(registro);
  const usate = [...voci.filter((v) => v.categoria === meta.categoria).slice(-12), ...voci.slice(-8)].map((v) => v.scena);
  for (let i = 0; i < 3; i++) {
    const tecnica = TECNICHE[Math.floor(Math.random() * TECNICHE.length)];
    const r = await chiedi(richiestaScena(meta, tecnica, usate));
    const scena = String((r && r.scena) || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    // shortcut: confronto a parole, non di significato; passare agli embedding se si vedono scene troppo simili
    if (scena.length >= 20 && voci.every((v) => somiglianza(scena, v.scena) < 0.5)) return { scena, tecnica };
    usate.push(scena);
  }
  throw new Error('il modello di testo ripete scene già usate o non risponde come richiesto');
}

async function gateway(rotta, corpo) {
  const r = await webui(rotta, corpo, 11 * 60000, GATEWAY);
  if (r.ok === false) throw new Error(r.error || 'il gateway rifiuta la richiesta');
  return r;
}
const chiediModello = async (richiesta) => (await gateway('/llm/chat', richiesta)).dati;

// La copertina entra nell'MP3 solo dei brani che la produzione ha finito: agli altri la mette il blocco 3d1.
async function applica(lavoro, cartella = COPERTINE, componiFn = componi) {
  const m = lavoro.meta;
  if (!lavoro.file || !m.ibroadcast || !m.id3_frames) return false;
  const r = await componiFn({ categoria: m.categoria, titolo: m.titolo, numero: m.numero_traccia }, SFONDI, cartella);
  if (!r || !sostituisciCopertina(lavoro.file.replace(/json$/, 'mp3'), r.jpeg)) return false;
  // rilettura subito prima di scrivere: nel frattempo può essere arrivato un voto
  const scheda = JSON.parse(fs.readFileSync(lavoro.file, 'utf8'));
  scriviAtomico(lavoro.file, JSON.stringify({ ...scheda, copertina_propria: new Date().toISOString() }, null, 2), '.cop.tmp');
  return true;
}

async function genera(lavoro) {
  const r = await webui('/sdapi/v1/txt2img', {
    prompt: (lavoro.prompt || stileCopertina(lavoro.categoria).prompt) + ', masterpiece, detailed', negative_prompt: NEGATIVO, width: 768, height: 768, steps: 28, cfg_scale: 7,
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
  const quante = Number(arg('--max')) || LOTTO;
  const sfondiMancanti = () => {
    const presenti = conBrani();
    return mancanti(genere ? [genere] : [...cat].sort((a, b) => Number(presenti.has(b)) - Number(presenti.has(a))));
  };
  const braniSenza = () => daFare().lavori.filter((x) => cat.includes(x.meta.categoria) && (!genere || x.meta.categoria === genere));
  if (!sfondiMancanti().length && !braniSenza().length) return console.log('tutti i brani hanno già la loro copertina');

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
    // l'elenco si fa adesso, così comprende anche il brano appena finito
    const sfondi = sfondiMancanti().slice(0, quante);
    const immagine = (b) => path.join(COPERTINE, b.chiave + '.jpg');
    const tutti = braniSenza();
    // chi ha già l'immagine va solo applicato e non occupa posti nel lotto
    const brani = [...tutti.filter((b) => fs.existsSync(immagine(b))),
      ...tutti.filter((b) => !fs.existsSync(immagine(b))).slice(0, quante - sfondi.length)];
    const registro = leggi(REGISTRO, {});
    const scritta = (b) => (registro[b.chiave] && registro[b.chiave].titolo === b.meta.titolo ? registro[b.chiave] : null);
    let errori = 0;
    const fallito = (cosa, e) => {
      console.error(cosa + ' non riuscito: ' + e.message);
      if (++errori >= 3) throw new Error('tre errori di fila: mi fermo');
    };

    // 1. tutte le scene prima delle immagini: il modello locale e Stable Diffusion non stanno insieme in 6 GB
    const nuovi = brani.filter((b) => !fs.existsSync(immagine(b)) && !scritta(b)); // le scene di un lotto interrotto restano
    for (let i = 0; i < nuovi.length && !interrotto(); i++) {
      const b = nuovi[i];
      try {
        const { scena, tecnica } = await scenaPer(b.meta, registro, chiediModello);
        const usati = new Set(Object.values(registro).map((v) => v.seed));
        let seed;
        do seed = Math.floor(Math.random() * 2 ** 31); while (usati.has(seed));
        delete registro[b.chiave]; // in fondo all'elenco: è la più recente
        registro[b.chiave] = { titolo: b.meta.titolo, categoria: b.meta.categoria, scena, tecnica, seed, il: new Date().toISOString() };
        scrivi(REGISTRO, registro);
        errori = 0;
        console.log('scena ' + (i + 1) + '/' + nuovi.length + ': ' + b.meta.titolo);
      } catch (e) { fallito('scena di ' + b.meta.titolo, e); }
    }
    errori = 0;

    // 2. le immagini
    const lavori = [
      ...sfondi.map((l) => ({ ...l, nome: l.categoria + '/' + path.basename(l.file) })),
      ...brani.filter((b) => fs.existsSync(immagine(b)) || scritta(b)).map((b) => ({
        brano: b, file: immagine(b), nome: b.meta.titolo, prompt: (scritta(b) || {}).scena, seed: (scritta(b) || {}).seed,
      })),
    ];
    console.log('immagini del lotto: ' + lavori.length);
    let chiudi = null;
    try {
      for (let i = 0; i < lavori.length && !interrotto(); i++) {
        const l = lavori[i];
        const t = Date.now();
        const nuova = !fs.existsSync(l.file);
        if (nuova && !chiudi) {
          await gateway('/llm/scarica', {}).catch((e) => console.log('modello locale non scaricato: ' + e.message));
          chiudi = await avviaWebui(interrotto); // se non parte, inutile continuare
        }
        try {
          if (nuova) await genera(l);
          if (l.brano) await applica(l.brano);
          errori = 0;
          console.log((i + 1) + '/' + lavori.length + ' ' + l.nome + ' (' + Math.round((Date.now() - t) / 1000) + ' s)');
        } catch (e) { fallito(l.nome, e); }
        if (!l.brano && (!lavori[i + 1] || lavori[i + 1].categoria !== l.categoria) && fs.existsSync(path.dirname(l.file))) foglio(path.dirname(l.file));
      }
      if (!inPausa()) console.log('produzione ripresa dalla dashboard: mi fermo');
      else if (fs.existsSync(FERMA)) console.log('generazione fermata dalla dashboard');
    } finally {
      if (chiudi) chiudi();
    }
  });
  console.log('finito; produzione nello stato precedente; brani ancora senza copertina propria: ' + braniSenza().length);
}

module.exports = { mancanti, conPausa, emergenza, somiglianza, scenaPer, applica };
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
