// Generi vocali senza parole: stile senza "senza voce", flag nel concept, niente LoRA strumentale.
const fs = require('fs');
const base = 'E:/n8n/officina-sonora/src/';
function sost(file, da, a) {
  let s = fs.readFileSync(base + file, 'utf8');
  if (!s.includes(da)) throw new Error(file + ': non trovato: ' + da.slice(0, 60));
  s = s.replace(da, a);
  fs.writeFileSync(base + file, s);
}
// 1) Stile: per i generi vocali la chiusa e' "wordless vocals" invece di "instrumental, no vocals"
sost('lib-apprendimento.js', "    'instrumental, no vocals',\n  ].filter(Boolean);",
  "    cat.vocale_senza_parole ? 'wordless vocals, no lyrics' : 'instrumental, no vocals',\n  ].filter(Boolean);");
// 2) Concept: flag vocale
sost('blocks/05c-componi-concept.js', "  punteggio: slot.punteggio,\n  attempts: 0,",
  "  punteggio: slot.punteggio,\n  vocale: !!cat.vocale_senza_parole,\n  attempts: 0,");
// 3) Invio: il LoRA strumentale non si usa per i generi vocali
sost('blocks/06-invia-render.js', "  adapters: [{ name: 'yue2-instrumental-kto', scale: 1.0, ar_scale: 1.0, nar_scale: 0.0 }],",
  "  ...(concept.vocale ? {} : { adapters: [{ name: 'yue2-instrumental-kto', scale: 1.0, ar_scale: 1.0, nar_scale: 0.0 }] }),");
console.log('codice vocali aggiornato');
