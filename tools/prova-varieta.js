// Prova: simula 12 scelte di categoria con la memoria dei brani precedenti e stampa la sequenza.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
new AF('require', 'console', lib + `
const g = readGuidance();
const st = { experiments: [], recent: [] };
const seq = [];
for (let i = 0; i < 12; i++) {
  const s = pickSlot(st, g);
  seq.push(s.category.name);
  st.recent.push({ categoria: s.category.name });
}
console.log(seq.join(' > '));
console.log('categorie diverse:', new Set(seq).size, 'di 8');
`)(require, console).catch((e) => console.error('ERR', e.message));
