// Porta la tassonomia nel caricatore del catalogo e aggiunge i tag ambito e famiglia ai brani caricati.
const fs = require('fs');
const base = 'E:/n8n/officina-sonora/src/';

let lib = fs.readFileSync(base + 'lib.js', 'utf8');
const a = "for (const k of ['artista', 'categories', 'strutture', 'tag_extra'])";
if (!lib.includes(a)) throw new Error('caricatore non trovato');
lib = lib.replace(a, "for (const k of ['artista', 'categories', 'strutture', 'tag_extra', 'tassonomia'])");
fs.writeFileSync(base + 'lib.js', lib);

let ib = fs.readFileSync(base + 'lib-ibroadcast.js', 'utf8');
const b = "  const names = [ambitoDi(meta) === 'musica' ? 'musica' : 'yoga', `categoria-${slug(meta.categoria)}`";
if (!ib.includes(b)) throw new Error('tag non trovati');
ib = ib.replace(b, "  const fam = ((CFG.categories || []).find((x) => x.name === meta.categoria) || {}).famiglia;\n  const names = [ambitoDi(meta), fam ? `famiglia-${slug(fam)}` : null, `categoria-${slug(meta.categoria)}`");
ib = ib.replace("...extra.map(slug)].filter((n) => !n.endsWith('-undefined'));", "...extra.map(slug)].filter((n) => n && !n.endsWith('-undefined'));");
fs.writeFileSync(base + 'lib-ibroadcast.js', ib);
console.log('tassonomia nel codice: caricatore e tag famiglia');
