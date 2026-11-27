// Prova a secco del blocco 05 con una risposta finta del modello (il modello di testo non e' caricato ora).
// Il concept non viene salvato nello stato di produzione.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/officina-sonora/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/lib-apprendimento.js', 'utf8');
const blocco = fs.readFileSync('E:/n8n/officina-sonora/src/blocks/05-genera-concept.js', 'utf8');
const finta = 'async function llmJson(){ return { titolo: "Prova", descrizione: "prova", bpm: 60, durata_s: 200 }; }';
const AF = Object.getPrototypeOf(async function () {}).constructor;
const st = { cursor: 0, queue: [], job: null, done: 0, experiments: [], recent: [] };
const $input = { first: () => ({ json: { state: st } }) };
new AF('require', '$input', '$env', lib + '\n' + finta + '\n' + blocco)(require, $input, {}).then((r) => {
  const c = r[0].json.state.queue[0];
  if (!c) { console.log('nessun concept:', r[0].json.error || ''); return; }
  console.log('titolo:', c.titolo, '| genere:', c.genere, '| variante:', c.variante, '| bpm:', c.bpm, '| tonalita:', c.tonalita);
  console.log('strumenti:', c.strumenti.join(', '), '| influenza:', c.influenza);
  console.log('style:', c.style);
  console.log('avoid:', c.avoid);
}).catch((e) => console.error('ERR', e.message));
