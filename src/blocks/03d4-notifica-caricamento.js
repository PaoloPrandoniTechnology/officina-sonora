// BLOCCO 3d4 - Registrazione: salva l'id iBroadcast nel .json di ogni brano caricato.
// Il messaggio Telegram non parte qui: lo invia il blocco 11 (riepilogo).
const inp = $input.first().json;
const state = inp.state;

for (const c of inp.caricati || []) {
  const meta = readJsonSafe(c.jsonPath, {});
  meta.id3_frames = c.nTags;
  if (meta.ibroadcast && meta.ibroadcast.track_id !== c.trackId) meta.ibroadcast_precedente = meta.ibroadcast;
  meta.ibroadcast = { track_id: c.trackId, caricato_il: new Date().toISOString(), organizzato: false };
  fs.writeFileSync(c.jsonPath, JSON.stringify(meta, null, 2));
}
return [{ json: { state, outcome: inp.outcome } }];
