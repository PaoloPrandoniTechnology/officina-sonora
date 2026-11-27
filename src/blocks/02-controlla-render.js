// BLOCCO 2 - Controlla render: interroga il motore YuE2 sul job in corso.
// Esito (outcome): running | waiting | done | failed
const state = $input.first().json.state;
const job = state.job;

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

if (['succeeded', 'done', 'ok'].includes(status)) return [{ json: { state, outcome: 'done' } }];
if (['failed', 'error', 'cancelled'].includes(status)) {
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
