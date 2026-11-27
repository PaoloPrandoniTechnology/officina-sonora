// Divide "5 Genera concept" in tre nodi visibili: 5a scelta ricetta, 5b titolo (modello), 5c composizione.
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/build-workflow.mjs';
let s = fs.readFileSync(file, 'utf8');
function sost(da, a) {
  if (!s.includes(da)) throw new Error('non trovato: ' + da.slice(0, 70));
  s = s.replace(da, a);
}
sost(
  "  genera: { name: '5 Genera concept', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05-') }, position: pos(750, 450) },",
  "  scegli: { name: '5a Scegli ricetta', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05a-') }, position: pos(750, 450) },\n" +
  "  titolo: { name: '5b Titolo (modello)', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05b-') }, position: pos(750, 600) },\n" +
  "  componi: { name: '5c Componi concept', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05c-') }, position: pos(750, 750) },"
);
sost("  ['haRender', 1, 'genera'],", "  ['haRender', 1, 'scegli'],");
sost("  ['genera', 0, 'invia'],", "  ['scegli', 0, 'titolo'],\n  ['titolo', 0, 'componi'],\n  ['componi', 0, 'invia'],");
fs.writeFileSync(file, s);
console.log('build aggiornato: 05 diviso in 5a, 5b, 5c');
