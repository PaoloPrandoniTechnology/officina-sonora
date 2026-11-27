// BLOCCO 2 - Controlla render: interroga il motore YuE2 sul job in corso.
// Esito (outcome): running | waiting | done | failed
const state = $input.first().json.state;
const job = state.job;
const PIANI_MAX = 3;
const SECONDI_SCORE_MAX = 330; // oltre, il render non sta nei 360 s del motore

// Lo score non va bene: se ne chiede un altro; finiti i tentativi, il brano torna in coda e il blocco 6
// lo rende con lo score del compositore o del motore (non conta come render fallito).
async function altroPiano(motivo) {
  const c = job.concept;
  if (job.pianoN < PIANI_MAX) {
    const seed = nuovoSeed();
    const id = await inviaSynth(corpoPiano(c, job.adapters, seed));
    if (!id) return 'waiting';
    state.job = { ...job, id, seed, pianoN: job.pianoN + 1, submittedAt: Date.now() };
    log(`score di "${c.titolo}" non usato (${motivo}): ne chiedo un altro`);
    return 'running';
  }
  state.job = null;
  c.pianoFallito = true;
  state.queue.unshift(c);
  log(`score del modello non riuscito per "${c.titolo}" (${motivo}): uso il ripiego`);
  return 'failed';
}

// Score pronto: la melodia passa agli strumenti, la durata deriva dallo score e parte il render
async function rendiScore() {
  const c = job.concept;
  let s;
  try {
    const r = await req('GET', `${CFG.yue}/job?id=${job.id}&result=1`, { ms: 60000 });
    if (!r.ok) throw new Error(`result HTTP ${r.status}`);
    const abc = extractAbc(r.buf, r.headers['content-type']);
    if (!abc) throw new Error('risposta senza score');
    s = ScoreAbc.strumentale(abc);
  } catch (e) {
    return altroPiano(e.message);
  }
  const minimo = Math.max(CFG.durMin, c.durata_s * 0.75);
  if (s.secondi < minimo || s.secondi > SECONDI_SCORE_MAX) return altroPiano(`score di ${s.secondi}s, richiesti circa ${c.durata_s}s`);
  const concept = { ...c, abc: s.abc, lyrics: s.lyrics, durata_s: s.secondi };
  delete concept.score; // lo score del compositore non e' quello usato: i voti non devono contarlo
  const seed = nuovoSeed();
  const id = await inviaSynth(corpoRender(concept, job.adapters, seed, s.abc, s.secondi));
  if (!id) return 'waiting';
  state.job = { id, seed, submittedAt: Date.now(), concept, adapters: job.adapters, scoreFonte: 'modello' };
  log(`score del modello per "${c.titolo}": ${s.secondi}s; render ${id} inviato`);
  return 'running';
}

if (Date.now() - job.submittedAt > CFG.jobTimeoutMs) {
  requeue(state, 'timeout');
  return [{ json: { state, outcome: 'failed' } }];
}

let status;
try {
  status = (await getJson(`${CFG.yue}/job?id=${job.id}`)).status;
} catch (e) {
  if (e.status === 404) {
    requeue(state, 'job non trovato sul motore (riavvio?)');
    return [{ json: { state, outcome: 'failed' } }];
  }
  log(`motore non raggiungibile, attendo: ${e.message}`);
  return [{ json: { state, outcome: 'waiting' } }];
}

if (['succeeded', 'done', 'ok'].includes(status)) {
  return [{ json: { state, outcome: job.fase === 'piano' ? await rendiScore() : 'done' } }];
}
if (['failed', 'error', 'cancelled'].includes(status)) {
  if (job.fase === 'piano') return [{ json: { state, outcome: await altroPiano(status) } }];
  requeue(state, status);
  return [{ json: { state, outcome: 'failed' } }];
}

// Log del rendering ogni ~10 minuti, per non riempire il file.
const now = Date.now();
if (!state.lastRunLog || now - state.lastRunLog > 600000) {
  log(`job ${job.id} "${job.concept.titolo}": ${status}`);
  state.lastRunLog = now;
}
return [{ json: { state, outcome: 'running' } }];
