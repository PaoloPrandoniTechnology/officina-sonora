// BLOCCO 7 - Scrivi stato: salva state.json. Riceve da tutti i rami del workflow.
const inp = $input.first().json;
const lockToken = inp.state.lockToken;
delete inp.state.lockToken;
saveState(inp.state);
releaseLock('pipeline', lockToken);
return [{
  json: {
    done: inp.state.done,
    queue: inp.state.queue.length,
    job: inp.state.job ? inp.state.job.id : null,
    failed: inp.state.failed.length,
    outcome: inp.outcome || null,
    error: inp.error || null,
  },
}];
