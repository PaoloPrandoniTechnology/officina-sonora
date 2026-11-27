// Prova a secco della catena 3d1 -> 3d2 -> 3d3 -> 3d4 con coda vuota (nessun caricamento reale).
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/officina-sonora/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/lib-apprendimento.js', 'utf8');
const libIb = fs.readFileSync('E:/n8n/officina-sonora/src/lib-ibroadcast.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const blocchi = [['03d1-prepara-caricamento.js', true], ['03d2-carica-ibroadcast.js', false], ['03d3-recupero-tag.js', true], ['03d4-notifica-caricamento.js', false]];
(async () => {
  let input = { state: { cursor: 0, queue: [], job: null, done: 0, uploadQueue: [], ibroadcastScanned: true, retagScanned: true }, outcome: 'nessuno' };
  for (const [b, ib] of blocchi) {
    const $input = { first: () => ({ json: input }) };
    const r = await new AF('require', '$input', '$env', lib + '\n' + (ib ? libIb : '') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/blocks/' + b, 'utf8'))(require, $input, {});
    input = r[0].json;
    console.log(b, 'ok', 'caricati:', (input.caricati || []).length, 'daCaricare:', (input.daCaricare || []).length);
  }
})().catch((e) => console.error('ERR', e.message));
