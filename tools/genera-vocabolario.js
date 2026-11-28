// Genera config\vocabolario.json dai termini del catalogo e dai tag del primo YuE (config\yue-v1).
// Uso: node tools/genera-vocabolario.js  (rigenera il file: le modifiche fatte a mano vanno perse)
const fs = require('fs');
const path = require('path');
const RADICE = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const { erroreBlocco } = new Function('CFG', 'path', leggi('src', 'lib-apprendimento.js') + '\nreturn { erroreBlocco };')({ dir: RADICE }, path);
const catalogo = JSON.parse(leggi('config', 'catalogo.json')).categories;
const tag = JSON.parse(leggi('config', 'yue-v1', 'top_200_tags.json'));

const famiglie = { genere: [], strumenti: [], ritmo: [], atmosfera: [], timbro: [], produzione: [], voce: [] };
const visti = new Set();
// il primo che arriva decide la famiglia: prima il catalogo, poi YuE; cio' che parla di voci va in "voce"
function aggiungi(famiglia, valori) {
  for (const testo of [].concat(valori).flatMap((v) => String(v || '').split(',')).map((v) => v.trim().toLowerCase())) {
    if (visti.has(testo) || erroreBlocco(testo)) continue;
    visti.add(testo);
    famiglie[erroreBlocco(testo, { strumentale: true }) ? 'voce' : famiglia].push(testo);
  }
}
const en = catalogo.map((c) => c.en || {});
aggiungi('genere', en.flatMap((e) => [e.genre, ...Object.values(e.influences || {})]));
aggiungi('strumenti', en.flatMap((e) => Object.values(e.instruments || {})));
aggiungi('ritmo', en.map((e) => e.rhythm));
aggiungi('atmosfera', en.map((e) => e.mood));
aggiungi('produzione', en.map((e) => e.space));
aggiungi('timbro', catalogo.flatMap((c) => (c.varianti || []).filter((v) => v.keywords !== c.stile).map((v) => v.keywords)));
// i tag "gender" di YuE descrivono la voce anche quando la parola da sola non lo dice
for (const testo of [...tag.gender, 'female', 'male'].map((v) => v.trim().toLowerCase())) {
  if (!visti.has(testo) && !erroreBlocco(testo) && !/unspecified|not specified/.test(testo)) { visti.add(testo); famiglie.voce.push(testo); }
}
aggiungi('genere', tag.genre);
aggiungi('strumenti', tag.instrument);
aggiungi('atmosfera', tag.mood);
aggiungi('timbro', tag.timbre);
for (const f of Object.values(famiglie)) f.sort();
fs.writeFileSync(path.join(RADICE, 'config', 'vocabolario.json'), JSON.stringify({ famiglie }, null, 1));
console.log(Object.entries(famiglie).map(([k, v]) => `${k} ${v.length}`).join(', '));
