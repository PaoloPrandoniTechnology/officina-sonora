// BLOCCO 3d4 - Notifica e registrazione: salva l'id iBroadcast nel .json di ogni brano caricato
// e manda un messaggio Telegram per ciascuno. Un errore di notifica non blocca nulla.
const inp = $input.first().json;
const state = inp.state;

for (const c of inp.caricati || []) {
  const meta = readJsonSafe(c.jsonPath, {});
  meta.id3_frames = c.nTags;
  if (meta.ibroadcast && meta.ibroadcast.track_id !== c.trackId) meta.ibroadcast_precedente = meta.ibroadcast;
  meta.ibroadcast = { track_id: c.trackId, caricato_il: new Date().toISOString(), organizzato: false };
  fs.writeFileSync(c.jsonPath, JSON.stringify(meta, null, 2));

  try {
    const chat = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
    if (chat) {
      const durata = meta.durata_s ? Math.floor(meta.durata_s / 60) + ':' + String(meta.durata_s % 60).padStart(2, '0') : 'n.d.';
      const testo = [
        '🎵 Nuovo brano caricato su iBroadcast',
        meta.titolo,
        '',
        'Categoria: ' + (meta.categoria || 'n.d.') + ' · Genere: ' + (meta.genere || 'n.d.'),
        'Tipo: ' + (meta.tipo || 'n.d.') + ' · Struttura: ' + (meta.struttura || 'n.d.'),
        'Energia: ' + (meta.energia || 'n.d.') + '/5 · Bpm: ' + (meta.bpm || 'n.d.') + ' · Tonalità: ' + (meta.tonalita || 'n.d.'),
        'Durata: ' + durata + ' · Numero traccia: ' + (meta.numero_traccia || 'n.d.'),
        'Render: ' + (meta.render_s || 'n.d.') + ' s · Id iBroadcast: ' + c.trackId,
        state.done ? 'Brani prodotti finora: ' + state.done : '',
      ].filter((r) => r !== '').join('\n');
      await gw('/tg', { method: 'sendMessage', body: { chat_id: chat, text: testo } });
    }
  } catch (e) {
    log('notifica Telegram non inviata per ' + path.basename(c.file) + ': ' + e.message);
  }
}
return [{ json: { state, outcome: inp.outcome } }];
