// Aggiorna il codice alla nuova struttura: radice della libreria, cartella per ambito e famiglia.
const fs = require('fs');
const base = 'E:/n8n/yoga/src/';

let lib = fs.readFileSync(base + 'lib.js', 'utf8');
const r1 = "  root: 'E:\\\\Yoga Music',";
if (!lib.includes(r1)) throw new Error('radice non trovata in lib.js');
lib = lib.replace(r1, "  root: 'E:\\\\Musica di sottofondo',");
// Funzione unica per la cartella di un brano: Ambito / Famiglia / Categoria / Tipo
const ancora = "// Slot deterministico";
if (!lib.includes(ancora)) throw new Error('ancora slotFor non trovata');
lib = lib.replace(ancora,
"// Cartella di un brano: radice / Yoga o Sottofondo / famiglia / categoria / tipo\n" +
"function cartellaBrano(categoria, tipo) {\n" +
"  const c = (CFG.categories || []).find((x) => x.name === categoria) || {};\n" +
"  const ambito = c.ambito === 'yoga' ? 'Yoga' : 'Sottofondo';\n" +
"  return path.join(CFG.root, ambito, c.famiglia || 'generale', categoria || 'senza-categoria', tipo || 'senza-tipo');\n" +
"}\n\n" + ancora);
fs.writeFileSync(base + 'lib.js', lib);

let blocco = fs.readFileSync(base + 'blocks/03-1-scarica-audio.js', 'utf8');
const r2 = 'const dir = path.join(CFG.root, c.categoria, c.tipo);';
if (!blocco.includes(r2)) throw new Error('cartella di salvataggio non trovata');
blocco = blocco.replace(r2, 'const dir = cartellaBrano(c.categoria, c.tipo);');
fs.writeFileSync(base + 'blocks/03-1-scarica-audio.js', blocco);
console.log('codice aggiornato: radice, cartellaBrano, salvataggio');
