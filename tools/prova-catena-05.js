// Prova a secco della catena 5a -> 5b -> 5c con un modello finto. Non salva lo stato di produzione.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/officina-sonora/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/lib-apprendimento.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const finta = 'async function llmJson(){ return { titolo: "Prova catena", descrizione: "prova", bpm: 60, durata_s: 200 }; }';
const blocchi = ['05a-scegli-ricetta.js', '05b-titolo-modello.js', '05c-componi-concept.js'];
(async () => {
  let input = { state: { cursor: 0, queue: [], job: null, done: 0, experiments: [], recent: [] } };
  for (const b of blocchi) {
    const $input = { first: () => ({ json: input }) };
    const r = await new AF('require', '$input', '$env', lib + '\n' + finta + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/blocks/' + b, 'utf8'))(require, $input, {});
    input = r[0].json;
    console.log(b, 'ok');
  }
  const c = input.state.queue[0];
  if (!c) { console.log('nessun concept:', input.error || ''); return; }
  console.log('titolo:', c.titolo, '| genere:', c.genere, '| variante:', c.variante, '| bpm:', c.bpm, '| tonalita:', c.tonalita);
  console.log('strumenti:', c.strumenti.join(', '), '| influenza:', c.influenza);
  console.log('style:', c.style.slice(0, 200));
})().catch((e) => console.error('ERR', e.message));
