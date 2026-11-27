// BLOCCO 3d4 - Registrazione: salva l'id iBroadcast nel .json di ogni brano caricato.
// Il messaggio Telegram non parte qui: lo invia il blocco 11 (riepilogo).
const inp = $input.first().json;
const state = inp.state;

for (const c of inp.caricati || []) {
  // solo i campi di questo blocco; una scheda illeggibile non si ricrea
  try {
    const meta = JSON.parse(fs.readFileSync(c.jsonPath, 'utf8'));
    const campi = { id3_frames: c.nTags, ibroadcast: { track_id: c.trackId, caricato_il: new Date().toISOString(), organizzato: false } };
    if (meta.ibroadcast && meta.ibroadcast.track_id !== c.trackId) campi.ibroadcast_precedente = meta.ibroadcast;
    aggiornaScheda(c.jsonPath, campi);
  } catch (e) {
    log(`iBroadcast: scheda ${path.basename(c.jsonPath)} illeggibile (${e.message}), id ${c.trackId} non registrato`);
  }
}
return [{ json: { state, outcome: inp.outcome } }];
