// BLOCCO 3a - Controllo qualita': verifica il brano appena salvato prima del caricamento.
// Lettore MP3 in JavaScript puro (nessun programma esterno): legge i frame, calcola durata reale,
// bitrate medio e integrita' del file. Un brano non superato va in _scartati e non viene caricato.
const inp = $input.first().json;
const state = inp.state;
if (inp.outcome !== 'saved' || !inp.file) return [{ json: { state, outcome: inp.outcome } }];

const file = inp.file;
const jsonPath = file.replace(/\.[^.]+$/, '.json');
const meta = readJsonSafe(jsonPath, {});

const BITRATE_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATE_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// Analizza i frame MP3 e ritorna durata, bitrate medio e frame validi/corrotti
function analizzaMp3(buf) {
  let i = 0;
  // salta l'header ID3, se presente
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size;
  }
  let frames = 0, corrotti = 0, secondi = 0, bytesAudio = 0;
  let durataPrimo = null;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      // cerca il prossimo sync; ogni salto conta come frame corrotto
      i++;
      corrotti++;
      continue;
    }
    const versione = (buf[i + 1] >> 3) & 3;
    const layer = (buf[i + 1] >> 1) & 3;
    const brIdx = buf[i + 2] >> 4;
    const srIdx = (buf[i + 2] >> 2) & 3;
    const pad = (buf[i + 2] >> 1) & 1;
    if (versione === 1 || layer !== 1 || srIdx === 3 || brIdx === 0 || brIdx === 15) { i++; corrotti++; continue; }
    const br = versione === 3 ? BITRATE_V1[brIdx] : BITRATE_V2[brIdx];
    const sr = SR[versione][srIdx];
    const campioni = versione === 3 ? 1152 : 576;
    const lunghezza = Math.floor((campioni / 8) * br * 1000 / sr) + pad;
    if (lunghezza < 24 || i + lunghezza > buf.length + 4) { i++; corrotti++; continue; }
    frames++;
    bytesAudio += lunghezza;
    secondi += campioni / sr;
    if (durataPrimo === null) durataPrimo = br;
    i += lunghezza;
  }
  return {
    frames,
    corrotti,
    durata_s: secondi,
    bitrate_medio_kbps: secondi > 0 ? Math.round((bytesAudio * 8) / secondi / 1000) : 0,
  };
}

let mp3;
try {
  mp3 = analizzaMp3(fs.readFileSync(file));
} catch (e) {
  mp3 = { frames: 0, corrotti: 0, durata_s: 0, bitrate_medio_kbps: 0, errore: e.message };
}

const esito = { problemi: [] };
esito.durata_reale_s = Math.round(mp3.durata_s);
esito.frames = mp3.frames;
esito.frame_corrotti = mp3.corrotti;
esito.bitrate_medio_kbps = mp3.bitrate_medio_kbps;

const target = meta.durata_s || CFG.durDefault;
if (mp3.frames === 0) esito.problemi.push('file audio non leggibile');
if (mp3.frames > 0 && mp3.corrotti / mp3.frames > 0.02) esito.problemi.push('file danneggiato (troppi frame non validi)');
// Brano troppo corto: il motore a volte si ferma prima. Lo si rigenera (max 2 volte), non si carica.
const durataCorta = mp3.durata_s > 0 && mp3.durata_s < target * (CFG.qcDurataMin ?? 0.85);
if (durataCorta) esito.problemi.push(`durata ${Math.round(mp3.durata_s)}s troppo corta rispetto a ${target}s`);
if (mp3.durata_s > target * (CFG.qcDurataMax ?? 1.25)) esito.problemi.push(`durata ${Math.round(mp3.durata_s)}s troppo lunga rispetto a ${target}s`);
if (mp3.bitrate_medio_kbps > 0 && mp3.bitrate_medio_kbps < 48) esito.problemi.push('bitrate troppo basso: possibile audio vuoto o degradato');

// Analisi del suono (gateway): livello, silenzi e clipping. Se non disponibile, il brano passa come prima.
let aud = null;
try {
  // gw() restituisce i campi della risposta al primo livello (rms_db, picco_db, ...)
  const r = await gw('/audio/analizza', { file });
  if (r.error || r.rms_db === undefined) throw new Error(r.error || 'risposta vuota');
  aud = r;
} catch (e) {
  log(`qualita': analisi audio non disponibile (${e.message}): controllo solo strutturale`);
}
if (aud) {
  if (aud.rms_db < (CFG.qcSilenzioDb ?? -45)) esito.problemi.push(`audio quasi silenzioso (${aud.rms_db} dB)`);
  if (aud.frazione_silenzio > (CFG.qcSilenzioFrazione ?? 0.5)) esito.problemi.push('oltre meta\' del brano silenzioso');
  esito.audio = { rms_db: aud.rms_db, picco_db: aud.picco_db, frazione_silenzio: +aud.frazione_silenzio.toFixed(2), frazione_clip: +aud.frazione_clip.toFixed(4) };
  if (aud.frazione_clip > 0.01) esito.avviso_clipping = `${(aud.frazione_clip * 100).toFixed(2)}% dei campioni saturi`; // solo avviso
}

meta.qualita = { ...esito, esito: esito.problemi.length ? 'scartato' : 'ok', controllato_il: new Date().toISOString() };
fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));

if (esito.problemi.length) {
  // Sposta il brano fuori dalla libreria: non viene caricato
  const dest = path.join(CFG.scartati, meta.categoria || 'senza-categoria', meta.tipo || 'senza-tipo');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of [file, jsonPath]) {
    if (fs.existsSync(f)) fs.renameSync(f, path.join(dest, path.basename(f)));
  }
  state.scartati = (state.scartati || 0) + 1;
  // Durata corta e pochi tentativi: il brano viene rimesso in coda con un nuovo seed
  const tentativi = (meta.tentativi_render || 0) + 1;
  if (durataCorta && !esito.problemi.some((p) => p.includes('troppo lunga')) && tentativi <= 2) {
    state.queue.unshift({
      titolo: meta.titolo, descrizione: meta.descrizione, bpm: meta.bpm, tonalita: meta.tonalita, durata_s: meta.durata_s,
      energia: meta.energia, attivita: meta.attivita, struttura: meta.struttura, style: meta.style, avoid: meta.avoid,
      sezioni: meta.sezioni, lyrics: (meta.sezioni || []).join('\n\n'), categoria: meta.categoria, tipo: meta.tipo,
      genere: meta.genere, variante: meta.variante, strumenti: meta.strumenti, influenza: meta.influenza, tonalita: meta.tonalita, guida_versione: meta.guida_versione, ricetta: meta.ricetta, esperimento: meta.esperimento,
      attempts: 0, tentativi_render: tentativi,
    });
    log(`qualita': "${meta.titolo}" troppo corto, rigenero (tentativo ${tentativi}): ${esito.problemi.join('; ')}`);
  } else {
    log(`qualita': scartato ${path.basename(file)}: ${esito.problemi.join('; ')}`);
  }
  return [{ json: { state, outcome: 'scartato', file: null } }];
}
log(`qualita' ok: ${path.basename(file)} (durata ${esito.durata_reale_s}s, ${esito.bitrate_medio_kbps} kbps)`);
return [{ json: { state, outcome: 'saved', file } }];
