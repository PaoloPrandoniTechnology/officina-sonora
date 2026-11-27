// Ricarica su iBroadcast tutti i brani con copertina, in ordine di numerazione (numero_traccia crescente).
// Esegue la catena di nodi di caricamento 3d1 -> 3d2 -> 3d3 -> 3d4. Unisce lo stato al momento della scrittura.
const fs = require('fs');
const path = require('path');

const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const libIb = fs.readFileSync('E:/n8n/yoga/src/lib-ibroadcast.js', 'utf8');
const cover = fs.readFileSync('E:/n8n/yoga/src/cover.js', 'utf8');
const blocchi = [
  ['03d1-prepara-caricamento.js', true],
  ['03d2-carica-ibroadcast.js', false],
  ['03d3-recupero-tag.js', true],
  ['03d4-notifica-caricamento.js', false],
];
const AF = Object.getPrototypeOf(async function () {}).constructor;

// Tutti i brani con il loro numero, ordinati per numerazione
const brani = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (/\.mp3$/.test(n)) {
      const j = f.replace(/\.mp3$/, '.json');
      if (fs.existsSync(j)) {
        const m = JSON.parse(fs.readFileSync(j, 'utf8'));
        if (m.titolo) brani.push({ mp3: f, numero: Number(m.numero_traccia) || 0 });
      }
    }
  }
})('E:/Yoga Music');
brani.sort((a, b) => a.numero - b.numero);

// Copie vecchie da cestinare: gli id attuali prima del ricaricamento
const vecchi = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (n.endsWith('.json') && n !== 'feedback.json') {
      const m = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (m.ibroadcast && m.ibroadcast.track_id) vecchi.push(String(m.ibroadcast.track_id));
    }
  }
})('E:/Yoga Music');
fs.writeFileSync('E:/n8n/yoga/tools/da-cestinare-copertine.json', JSON.stringify([...new Set(vecchi)]));
console.log('brani da ricaricare:', brani.length, '| copie vecchie registrate:', new Set(vecchi).size);

const statoFile = 'E:/n8n/yoga/state/state.json';
const statoIniziale = JSON.parse(fs.readFileSync(statoFile, 'utf8'));
statoIniziale.uploadQueue = brani.map((b) => b.mp3);
statoIniziale.ibroadcastScanned = true;
statoIniziale.retagScanned = true;

(async () => {
  let input = { state: statoIniziale, outcome: 'nessuno' };
  for (const [b, ib] of blocchi) {
    const $input = { first: () => ({ json: input }) };
    const extra = ib ? libIb + '\n' + cover : '';
    const r = await new AF('require', '$input', '$env', lib + '\n' + extra + '\n' + fs.readFileSync('E:/n8n/yoga/src/blocks/' + b, 'utf8'))(require, $input, {});
    input = r[0].json;
    console.log(b, 'ok');
  }
  // Unione con lo stato reale: tag, playlist e coda vuota
  const attuale = JSON.parse(fs.readFileSync(statoFile, 'utf8'));
  attuale.tags = input.state.tags;
  attuale.playlists = input.state.playlists;
  attuale.uploadQueue = [];
  attuale.ibroadcastScanned = true;
  attuale.retagScanned = true;
  fs.writeFileSync(statoFile, JSON.stringify(attuale, null, 2));
  console.log('ricaricamento completato');
})().catch((e) => console.error('ERR', e.message));
