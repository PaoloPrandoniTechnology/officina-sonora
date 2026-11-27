// Divide il vecchio nodo "3d Pubblica su iBroadcast" in quattro nodi visibili e aggiorna i collegamenti.
const fs = require('fs');
const file = 'E:/n8n/yoga/build-workflow.mjs';
let s = fs.readFileSync(file, 'utf8');
function sost(da, a) {
  if (!s.includes(da)) throw new Error('non trovato: ' + da.slice(0, 80));
  s = s.replace(da, a);
}

// Funzione di composizione: i nodi iBroadcast ricevono anche la libreria iBroadcast
sost("const code = (prefix) => lib + '\\n' + blockFile(prefix);",
  "const libIb = readFileSync(join(here, 'src', 'lib-ibroadcast.js'), 'utf8');\n" +
  "const code = (prefix) => lib + '\\n' + blockFile(prefix);\n" +
  "const codeIb = (prefix) => lib + '\\n' + libIb + '\\n' + blockFile(prefix);");

const vecchio = /  pubblica: \{ name: '3d Pubblica su iBroadcast'[^\n]*\n/;
if (!vecchio.test(s)) throw new Error('nodo pubblica non trovato');
s = s.replace(vecchio,
  "  prep: { name: '3d1 Prepara caricamento', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: codeIb('03d1-') }, position: pos(1500, 250) },\n" +
  "  carica: { name: '3d2 Carica su iBroadcast', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03d2-') }, position: pos(1500, 330) },\n" +
  "  recupero: { name: '3d3 Recupero tag e playlist', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: codeIb('03d3-') }, position: pos(1500, 410) },\n" +
  "  notifica: { name: '3d4 Notifica e registrazione', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03d4-') }, position: pos(1500, 490) },\n");

sost("  ['qualita', 0, 'pubblica'],", "  ['qualita', 0, 'prep'],\n  ['prep', 0, 'carica'],\n  ['carica', 0, 'recupero'],\n  ['recupero', 0, 'notifica'],\n  ['notifica', 0, 'feedback'],");
sost("  ['pubblica', 0, 'feedback'],", "");
sost("  ['invia', 0, 'pubblica'],", "  ['invia', 0, 'prep'],");
fs.writeFileSync(file, s);
console.log('build aggiornato: pubblicazione divisa in 3d1, 3d2, 3d3, 3d4');
