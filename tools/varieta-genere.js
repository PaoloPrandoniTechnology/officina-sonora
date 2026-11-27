// Aggiunge a pickSlot un vincolo di varieta': la categoria dei due brani precedenti non torna subito,
// a meno che non sia l'unica possibile. Cosi' il genere cambia di brano in brano.
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/src/lib-apprendimento.js';
let s = fs.readFileSync(file, 'utf8');
const ancora = "  // Prima le ricette affidabili con punteggio migliore; le non affidabili solo se c'e' posto negli esperimenti";
if (!s.includes(ancora)) throw new Error('ancora non trovata');
s = s.replace(ancora,
"  // Varieta': le categorie degli ultimi due brani non tornano subito, se esistono alternative\n" +
"  const ultime = (state.recent || []).slice(-2).map((r) => r.categoria);\n" +
"  const altre = candidati.filter((c) => !ultime.includes(c.cat.name));\n" +
"  if (altre.length) candidati.splice(0, candidati.length, ...altre);\n\n" +
ancora);
fs.writeFileSync(file, s);
console.log('varieta: vincolo aggiunto');
