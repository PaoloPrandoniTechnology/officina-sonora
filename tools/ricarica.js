// One-off: ricarica su iBroadcast tutti i brani della libreria con tag, genere e numero nuovi.
// Usa lo stesso blocco 03b (token nel gateway). Unisce lo stato al momento della scrittura.
const fs = require('fs');
const path = require('path');
const http = require('http');

const lib = fs.readFileSync('E:/n8n/officina-sonora/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/officina-sonora/src/lib-apprendimento.js', 'utf8');
const blocco = fs.readFileSync('E:/n8n/officina-sonora/src/blocks/03b-pubblica-ibroadcast.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;

const tutti = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (/\.(mp3|flac|wav|ogg)$/.test(n)) {
      const j = f.replace(/\.[^.]+$/, '.json');
      if (fs.existsSync(j)) tutti.push(f);
    }
  }
})('E:/libreria-storica');

const statoIniziale = JSON.parse(fs.readFileSync('E:/n8n/officina-sonora/state/state.json', 'utf8'));
statoIniziale.uploadQueue = tutti.slice();
statoIniziale.ibroadcastScanned = true;
statoIniziale.retagScanned = true;
statoIniziale.organizeScanned = true;

(async () => {
  const $input = { first: () => ({ json: { state: statoIniziale, outcome: 'nessuno' } }) };
  const r = await new AF('require', '$input', '$env', lib + '\n' + blocco)(require, $input, {});
  const nuovo = r[0].json.state;
  // Unione con lo stato reale: si riprendono solo tag, playlist e la coda vuota
  const attuale = JSON.parse(fs.readFileSync('E:/n8n/officina-sonora/state/state.json', 'utf8'));
  attuale.tags = nuovo.tags;
  attuale.playlists = nuovo.playlists;
  attuale.uploadQueue = [];
  attuale.ibroadcastScanned = true;
  attuale.retagScanned = true;
  attuale.organizeScanned = true;
  fs.writeFileSync('E:/n8n/officina-sonora/state/state.json', JSON.stringify(attuale, null, 2));
  console.log('ricaricamento completato su', tutti.length, 'brani');
})().catch((e) => console.error('ERR', e.message));
