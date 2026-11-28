// BLOCCO 3d2 - Carica su iBroadcast: invia i brani preparati al gateway (che tiene il token).
// I brani che falliscono tornano in coda, fino a 3 tentativi.
const inp = $input.first().json;
const state = inp.state;
const caricati = [];

for (const item of inp.daCaricare || []) {
  try {
    const r = await gwUpload(path.basename(item.file), fs.readFileSync(item.file));
    const j = r.json;
    // senza risposta di iBroadcast (token scaduto, gateway in errore) il brano non è caricato
    if (r.status !== 200 || !j || j.result === false) throw new Error('upload non accettato (HTTP ' + r.status + '): ' + (r.error || (j && j.message) || ''));
    const match = /\((.*)\) uploaded successfully/.exec(j.message || '');
    const trackId = match ? match[1] : 'ok';
    caricati.push({ file: item.file, jsonPath: item.jsonPath, nTags: item.nTags, trackId });
    log(`iBroadcast: caricato ${path.basename(item.file)} (id ${trackId})`);
  } catch (e) {
    state.uploadTries = state.uploadTries || {};
    state.uploadTries[item.file] = (state.uploadTries[item.file] || 0) + 1;
    if (state.uploadTries[item.file] < 3) state.uploadQueue.push(item.file);
    log(`iBroadcast: errore su ${path.basename(item.file)} (tentativo ${state.uploadTries[item.file]}): ${e.message}`);
  }
}
return [{ json: { state, outcome: inp.outcome, caricati } }];
