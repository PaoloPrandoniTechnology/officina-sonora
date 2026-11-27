// Divide il blocco di salvataggio in due nodi visibili: 3a scarica audio, 3b scrive i metadati.
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/build-workflow.mjs';
let s = fs.readFileSync(file, 'utf8');
function sost(da, a) {
  if (!s.includes(da)) throw new Error('non trovato: ' + da.slice(0, 70));
  s = s.replace(da, a);
}
sost(
  "  salva: { name: '3 Salva brano', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03-') }, position: pos(1250, 50) },",
  "  scarica: { name: '3a Scarica audio', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03-1-') }, position: pos(1250, 50) },\n" +
  "  metadati: { name: '3b Scrivi metadati', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03-2-') }, position: pos(1250, -50) },"
);
sost("name: '3a Controllo qualita'", "name: '3c Controllo qualita'");
sost("name: '3b Pubblica su iBroadcast'", "name: '3d Pubblica su iBroadcast'");
sost("  ['concluso', 0, 'salva'], // true: render finito", "  ['concluso', 0, 'scarica'], // true: render finito");
sost("  ['salva', 0, 'qualita'],", "  ['scarica', 0, 'metadati'],\n  ['metadati', 0, 'qualita'],");
fs.writeFileSync(file, s);
console.log('build aggiornato: 03 diviso in 3a e 3b');
