// Prova a secco del blocco 05: genera un concept senza salvarlo nello stato di produzione.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const blocco = fs.readFileSync('E:/n8n/yoga/src/blocks/05-genera-concept.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const fingi = process.argv.includes('--finto');
const st = { cursor: 0, queue: [], job: null, done: 0, experiments: [], recent: [] };
const $input = { first: () => ({ json: { state: st } }) };
new AF('require', '$input', '$env', lib + '\n' + blocco)(require, $input, {}).then((r) => {
  const c = r[0].json.state.queue[0];
  if (!c) { console.log('nessun concept:', r[0].json.error || ''); return; }
  console.log('titolo:', c.titolo, '| genere:', c.genere, '| variante:', c.variante, '| bpm:', c.bpm, '| tonalita:', c.tonalita);
  console.log('strumenti:', c.strumenti.join(', '), '| influenza:', c.influenza);
  console.log('style:', c.style);
  console.log('avoid:', c.avoid);
}).catch((e) => console.error('ERR', e.message));
