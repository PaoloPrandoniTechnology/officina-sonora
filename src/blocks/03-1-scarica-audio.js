// BLOCCO 3a - Scarica audio: scarica il risultato dal motore YuE2 e scrive il file MP3 nella libreria.
// Non scrive ancora i metadati (lo fa il blocco 3b) e non chiude il job.
const state = $input.first().json.state;
const job = state.job;
const c = job.concept;

let r;
try {
  r = await req('GET', `${CFG.yue}/job?id=${job.id}&result=1`, { ms: 180000 });
  if (!r.ok) throw new Error(`result HTTP ${r.status}`);
} catch (e) {
  job.resultFails = (job.resultFails || 0) + 1;
  log(`download risultato fallito (${job.resultFails}): ${e.message}`);
  if (job.resultFails >= CFG.resultFailsMax) {
    requeue(state, 'risultato non scaricabile');
    return [{ json: { state, outcome: 'failed' } }];
  }
  return [{ json: { state, outcome: 'waiting' } }];
}

const { data, ext } = extractAudio(r.buf, r.headers['content-type']);
// Il tipo deve essere un nome: se un concept vecchio lo ha come oggetto, si recupera il nome
if (c.tipo && typeof c.tipo === 'object') c.tipo = c.tipo.name;
const dir = cartellaBrano(c.categoria, c.tipo);
fs.mkdirSync(dir, { recursive: true });
let file = uniquePath(dir, slugify(c.titolo), '.' + ext);
fs.writeFileSync(file, data);
let bytes = data.length;
// Il WAV del motore diventa l'MP3 della libreria nel gateway (loudness, dissolvenza, 320 kbps)
if (ext === 'wav') {
  const mp3 = uniquePath(dir, slugify(c.titolo), '.mp3');
  try {
    const m = await gw('/audio/master', { file, uscita: mp3 });
    if (!m.ok) throw new Error(m.error || `HTTP ${m.status}`);
    log(`mastering: ${m.lufs} LUFS, picco ${m.picco_db} dB`);
    bytes = fs.statSync(mp3).size;
    fs.unlinkSync(file);
    file = mp3;
  } catch (e) {
    fs.rmSync(file, { force: true });
    fs.rmSync(mp3, { force: true });
    job.resultFails = (job.resultFails || 0) + 1;
    log(`mastering fallito (${job.resultFails}): ${e.message}`);
    if (job.resultFails >= CFG.resultFailsMax) {
      requeue(state, 'mastering non riuscito'); // il tentativo successivo chiede l'MP3 al motore
      return [{ json: { state, outcome: 'failed' } }];
    }
    return [{ json: { state, outcome: 'waiting' } }];
  }
}
const abc = extractAbc(r.buf, r.headers['content-type']);
if (abc) fs.writeFileSync(file.replace(/\.[^.]+$/, '.abc'), abc);
log(`audio scritto: ${file}`);
return [{ json: { state, outcome: 'audio', file, bytes } }];
