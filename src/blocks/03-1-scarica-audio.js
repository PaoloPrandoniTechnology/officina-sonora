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
const file = uniquePath(dir, slugify(c.titolo), '.' + ext);
fs.writeFileSync(file, data);
log(`audio scritto: ${file}`);
return [{ json: { state, outcome: 'audio', file, bytes: data.length } }];
