// BLOCCO 3d1 - Prepara caricamento: raccoglie i brani da caricare (nuovi, mancanti, da ritaggare),
// scarta i duplicati per impronta audio e scrive i tag ID3 completi nel file. Non chiama iBroadcast.
const inp = $input.first().json;
const state = inp.state;
state.uploadQueue = state.uploadQueue || [];
if (inp.outcome === 'saved' && inp.file) state.uploadQueue.push(inp.file);

// Ogni ora si ripescano i brani senza il campo ibroadcast (caricamento fallito); una volta sola quelli senza tag completi
const accoda = (full) => { if (!state.uploadQueue.includes(full)) state.uploadQueue.push(full); };
if (!(Date.now() - state.ibroadcastScanned < 3600000)) {
  const walkLib = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === '_scartati') continue;
      if (fs.statSync(full).isDirectory()) walkLib(full);
      else if (/\.(mp3|flac|wav|ogg)$/.test(name)) {
        const meta = readJsonSafe(full.replace(/\.[^.]+$/, '.json'), null);
        if (meta && !meta.ibroadcast && !meta.duplicato_di) {
          if (state.uploadTries) delete state.uploadTries[full]; // altri tre tentativi
          accoda(full);
        }
      }
    }
  };
  if (fs.existsSync(CFG.root)) walkLib(CFG.root);
  state.ibroadcastScanned = Date.now();
}
if (!state.retagScanned) {
  const walkRetag = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === '_scartati') continue;
      if (fs.statSync(full).isDirectory()) walkRetag(full);
      else if (/\.(mp3|flac|wav|ogg)$/.test(name)) {
        const meta = readJsonSafe(full.replace(/\.[^.]+$/, '.json'), null);
        if (meta && meta.ibroadcast && !meta.id3_frames) accoda(full);
      }
    }
  };
  if (fs.existsSync(CFG.root)) walkRetag(CFG.root);
  state.retagScanned = true;
}

// Ai brani della coda: duplicati scartati, gli altri ricevono i tag ID3 pronti per il caricamento
const pending = state.uploadQueue.splice(0);
const daCaricare = [];
for (const file of pending) {
  if (!fs.existsSync(file)) continue;
  try {
    const jsonPath = file.replace(/\.[^.]+$/, '.json');
    const meta = readJsonSafe(jsonPath, {});
    const hashAudio = fnvAudio(fs.readFileSync(file));
    const gia = libraryTracks().find((t) => t.meta.hash_audio === hashAudio && t.meta.ibroadcast && t.meta.ibroadcast.track_id && t.jsonPath !== jsonPath);
    if (gia) {
      aggiornaScheda(jsonPath, { hash_audio: hashAudio, duplicato_di: gia.meta.titolo });
      log(`iBroadcast: ${meta.titolo} identico a ${gia.meta.titolo}, non ricaricato`);
      continue;
    }
    meta.hash_audio = hashAudio;
    const cop = await copertinaPer(meta);
    const nTags = tagFile(file, meta, cop);
    // solo i campi di questo blocco: un voto arrivato durante l'attesa della copertina resta
    aggiornaScheda(jsonPath, { hash_audio: hashAudio, id3_versione: 2, copertina: cop.definitiva ? 'ai' : 'provvisoria' });
    daCaricare.push({ file, jsonPath, nTags, titolo: meta.titolo, tentativi: state.uploadTries ? (state.uploadTries[file] || 0) : 0 });
  } catch (e) {
    log(`iBroadcast: preparazione di ${path.basename(file)} non riuscita: ${e.message}`);
  }
}
return [{ json: { state, outcome: inp.outcome, daCaricare } }];
