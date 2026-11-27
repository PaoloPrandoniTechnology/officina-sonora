// BLOCCO 3b - Scrivi metadati: scrive il .json del brano (numero progressivo, genere, ricetta...)
// e chiude il job nello stato. Riceve il file audio dal blocco 3a.
const inp = $input.first().json;
const state = inp.state;
if (inp.outcome !== 'audio' || !inp.file) return [{ json: { state, outcome: inp.outcome } }];

const job = state.job;
const c = job.concept;
const file = inp.file;
const renderS = Math.round((Date.now() - job.submittedAt) / 1000);
const meta = {
  titolo: c.titolo,
  descrizione: c.descrizione,
  categoria: c.categoria,
  tipo: c.tipo,
  energia: c.energia,
  struttura: c.struttura,
  ricetta: c.ricetta,
  esperimento: c.esperimento,
  genere: c.genere,
  variante: c.variante,
  strumenti: c.strumenti,
  influenza: c.influenza,
  tentativi_render: c.tentativi_render || 0,
  // numero progressivo globale: non si ripete mai
  numero_traccia: numeroProgressivo(),
  attivita: c.attivita,
  bpm: c.bpm,
  tonalita: c.tonalita,
  durata_s: c.durata_s,
  style: c.style,
  avoid: c.avoid,
  sezioni: c.sezioni,
  lyrics: c.lyrics,
  lora: job.adapters || [],
  score: job.abcNostro ? c.score : undefined, // assente = score scritto dal motore
  score_fonte: job.scoreFonte || (job.abcNostro ? 'compositore' : 'motore'),
  seed: job.seed,
  job_id: job.id,
  bytes_audio: inp.bytes,
  render_s: renderS,
  guida_versione: c.guida_versione,
  generato_il: new Date().toISOString(),
  voto: null,
};
fs.writeFileSync(file.replace(/\.[^.]+$/, '.json'), JSON.stringify(meta, null, 2));

state.job = null;
state.done++;
state.recent = [...state.recent, { titolo: c.titolo, categoria: c.categoria, tipo: c.tipo, energia: c.energia, struttura: c.struttura, durata_s: c.durata_s, render_s: renderS, bpm: c.bpm, bytes_audio: inp.bytes, file: path.basename(file) }].slice(-10);
log(`salvato ${file} (render ${renderS}s, durata richiesta ${c.durata_s}s)`);
return [{ json: { state, outcome: 'saved', file } }];
