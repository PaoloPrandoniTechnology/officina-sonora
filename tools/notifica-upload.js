// Aggiunge al blocco 03b la notifica Telegram per ogni brano caricato (inviata tramite il gateway).
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/src/blocks/03b-pubblica-ibroadcast.js';
let s = fs.readFileSync(file, 'utf8');
const ancora = "    log(`iBroadcast: caricato ${path.basename(file)} (id ${trackId})`);";
if (!s.includes(ancora)) throw new Error('ancora non trovata');
const nuovo = ancora + `
    // Notifica Telegram: un messaggio per ogni brano caricato (un errore di notifica non blocca il caricamento)
    try {
      const chat = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
      if (chat) {
        const durata = meta.durata_s ? Math.floor(meta.durata_s / 60) + ':' + String(meta.durata_s % 60).padStart(2, '0') : 'n.d.';
        const numeroBrani = (state.done || 0);
        const testo = [
          '🎵 Nuovo brano caricato su iBroadcast',
          meta.titolo,
          '',
          'Categoria: ' + (meta.categoria || 'n.d.') + ' · Genere: ' + (meta.genere || 'n.d.'),
          'Tipo: ' + (meta.tipo || 'n.d.') + ' · Struttura: ' + (meta.struttura || 'n.d.'),
          'Energia: ' + (meta.energia || 'n.d.') + '/5 · Bpm: ' + (meta.bpm || 'n.d.') + ' · Tonalità: ' + (meta.tonalita || 'n.d.'),
          'Durata: ' + durata + ' · Numero traccia: ' + (meta.numero_traccia || 'n.d.'),
          'Render: ' + (meta.render_s || 'n.d.') + ' s · Id iBroadcast: ' + trackId,
          numeroBrani ? 'Brani prodotti finora: ' + numeroBrani : '',
        ].filter((r) => r !== '').join('\\n');
        await gw('/tg', { method: 'sendMessage', body: { chat_id: chat, text: testo } });
      }
    } catch (e) {
      log('notifica Telegram non inviata per ' + path.basename(file) + ': ' + e.message);
    }`;
s = s.replace(ancora, nuovo);
fs.writeFileSync(file, s);
console.log('notifica aggiunta');
