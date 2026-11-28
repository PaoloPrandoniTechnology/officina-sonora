// BLOCCO 3d3 - Recupero tag e playlist: iBroadcast accetta i tag solo dopo l'elaborazione del brano.
// Ad ogni giro applica i tag ai brani ancora in sospeso (al massimo 3, dopo 3 minuti dal caricamento,
// ogni 5 minuti per brano, fino a 30 tentativi).
const inp = $input.first().json;
const state = inp.state;

const coda = [];
const walkOrg = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === '_scartati') continue;
    if (fs.statSync(full).isDirectory()) walkOrg(full);
    else if (name.endsWith('.json') && name !== 'feedback.json') {
      const meta = readJsonSafe(full, null);
      const ib = meta && meta.ibroadcast;
      if (!ib || !ib.track_id || ib.organizzato || ib.rimosso) continue;
      const ultimo = ib.tag_ultimo_tentativo ? Date.parse(ib.tag_ultimo_tentativo) : 0;
      if ((ib.tag_tentativi || 0) >= 30 || Date.now() - ultimo < 5 * 60000) continue;
      if (Date.now() - Date.parse(ib.caricato_il || 0) < 3 * 60000) continue;
      coda.push({ full, meta });
    }
  }
};
if (fs.existsSync(CFG.root)) walkOrg(CFG.root);

for (const { full, meta } of coda.slice(0, 3)) {
  const ib = meta.ibroadcast;
  ib.tag_tentativi = (ib.tag_tentativi || 0) + 1;
  ib.tag_ultimo_tentativo = new Date().toISOString();
  try {
    await organizza(null, meta, ib.track_id, state);
    ib.organizzato = true;
    log(`iBroadcast: tag e playlist applicati a ${meta.titolo}`);
  } catch (e) {
    log(`iBroadcast: tag di ${meta.titolo} in attesa di elaborazione, nuovo tentativo al prossimo giro (n. ${ib.tag_tentativi}, ${e.message})`);
  }
  // Durante l'attesa puo' essere arrivato un voto: si riscrive solo il blocco ibroadcast
  try {
    aggiornaScheda(full, { ibroadcast: ib });
  } catch (e) {
    log(`iBroadcast: scheda di ${meta.titolo} non aggiornata: ${e.message}`);
  }
}
return [{ json: { state, outcome: inp.outcome, caricati: inp.caricati || [] } }];
