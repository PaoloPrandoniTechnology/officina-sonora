// Prova a secco del blocco 10 (voti da iBroadcast): stampa l'esito senza toccare lo stato di produzione.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const blocco = fs.readFileSync('E:/n8n/yoga/src/blocks/10-voti-ibroadcast.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
new AF('require', '$input', '$env', lib + '\n' + blocco)(require, {}, {}).then((r) => console.log('esito:', JSON.stringify(r))).catch((e) => console.error('ERR', e.message));
