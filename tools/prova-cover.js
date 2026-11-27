// Prova: genera una copertina PNG per una categoria e la salva in una cartella di prova.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/officina-sonora/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/lib-apprendimento.js', 'utf8');
const libIb = fs.readFileSync('E:/n8n/officina-sonora/src/lib-ibroadcast.js', 'utf8');
const cover = fs.readFileSync('E:/n8n/officina-sonora/src/cover.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const out = process.argv[2] || 'E:/n8n/officina-sonora/state/copertine-prova';
fs.mkdirSync(out, { recursive: true });
new AF('require', 'console', lib + '\n' + libIb + '\n' + cover + '\n' + `
for (const c of CFG.categories) {
  const png = coverPng(c.name, 7);
  fs.writeFileSync(${JSON.stringify(out)} + '/' + c.name + '.png', png);
  console.log(c.name, png.length, 'byte');
}`)(require, console).catch((e) => console.error('ERR', e.message));
