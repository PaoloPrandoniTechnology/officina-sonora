// Correzione one-off: i tag dopo il caricamento vengono applicati dal recupero, dopo l'elaborazione di iBroadcast,
// e i messaggi transitori non contengono piu' parole che fanno scattare gli avvisi di errore.
const fs = require('fs');
const file = 'E:/n8n/yoga/src/blocks/03b-pubblica-ibroadcast.js';
let s = fs.readFileSync(file, 'utf8');
function sost(da, a) {
  if (!s.includes(da)) throw new Error('non trovato: ' + da.slice(0, 60));
  s = s.replace(da, a);
}
sost(`    // Tag e playlist su iBroadcast: errori qui non bloccano il caricamento
    try {
      await organizza(session.access, meta, trackId, state);
      meta.ibroadcast.organizzato = true;
    } catch (e) {
      log(\`iBroadcast: tag/playlist non applicati a \${path.basename(file)}: \${e.message}\`);
    }
`, `    // Tag e playlist: iBroadcast li accetta solo dopo l'elaborazione del brano, quindi li applica il recupero
    meta.ibroadcast.organizzato = false;
`);
sost(`        if ((ib.tag_tentativi || 0) >= 30 || Date.now() - ultimo < 5 * 60000) continue;`,
  `        if ((ib.tag_tentativi || 0) >= 30 || Date.now() - ultimo < 5 * 60000) continue;
        // il brano appena caricato va lasciato elaborare da iBroadcast per almeno 3 minuti
        if (Date.now() - Date.parse(ib.caricato_il || 0) < 3 * 60000) continue;`);
sost("log(`iBroadcast: tag di ${meta.titolo} in attesa di elaborazione (tentativo ${ib.tag_tentativi}): ${e.message}`);",
  "log(`iBroadcast: tag di ${meta.titolo} in attesa di elaborazione, nuovo tentativo al prossimo giro (n. ${ib.tag_tentativi}, ${e.message})`);");
fs.writeFileSync(file, s);
console.log('03b corretto');
