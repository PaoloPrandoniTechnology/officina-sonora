// One-off: numerazione globale progressiva per tutti i brani della libreria; registra gli id iBroadcast attuali da cestinare dopo il ricaricamento.
const fs = require('fs'), path = require('path');
const brani = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (n.endsWith('.json') && n !== 'feedback.json') {
      const m = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (m.titolo) brani.push({ f, m });
    }
  }
})('E:/Yoga Music');
brani.sort((a, b) => String(a.m.generato_il).localeCompare(String(b.m.generato_il)));
const vecchiIds = [];
brani.forEach((b, i) => {
  if (b.m.ibroadcast && b.m.ibroadcast.track_id) vecchiIds.push(String(b.m.ibroadcast.track_id));
  b.m.numero_traccia = i + 1;
  fs.writeFileSync(b.f, JSON.stringify(b.m, null, 2));
});
fs.writeFileSync('E:/n8n/yoga/state/contatore.json', JSON.stringify({ prossimo: brani.length + 1, aggiornato: new Date().toISOString() }, null, 2));
fs.writeFileSync('E:/n8n/yoga/tools/da-cestinare-2.json', JSON.stringify([...new Set(vecchiIds)]));
console.log('numerati', brani.length, 'ids da sostituire', new Set(vecchiIds).size);
