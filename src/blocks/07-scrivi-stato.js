// BLOCCO 7 - Scrivi stato: salva state.json. Riceve da tutti i rami del workflow.
const inp = $input.first().json;
saveState(inp.state);
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
