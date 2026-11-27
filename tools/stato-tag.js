// Stato dei tag: quanti brani risultano organizzati e quanti tentativi restano.
const fs = require('fs'), path = require('path');
let tot = 0, ok = 0, pend = 0, esauriti = 0; const esempi = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (f === '_scartati') continue;
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json') && f !== 'feedback.json') {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!m.ibroadcast) continue;
      tot++;
      if (m.ibroadcast.organizzato) ok++;
      else if ((m.ibroadcast.tag_tentativi || 0) >= 30) esauriti++;
      else { pend++; if (esempi.length < 3) esempi.push(m.titolo + ' tentativi=' + (m.ibroadcast.tag_tentativi || 0)); }
    }
  }
})('E:/libreria-storica');
console.log({ tot, organizzati: ok, in_attesa: pend, esauriti });
console.log(esempi.join('\n'));
