// Diagnosi: un solo tagtracks sul gateway, stampa il messaggio di iBroadcast (nessun token letto qui).
const fs = require('fs'), http = require('http');
const st = JSON.parse(fs.readFileSync('E:/n8n/officina-sonora/state/state.json', 'utf8'));
const tagId = Object.values(st.tags || {})[0];
const brano = JSON.parse(fs.readFileSync('E:/libreria-storica/Meditazione/ambient-pad/eco-della-consapevolezza.json', 'utf8'));
const trackId = Number(brano.ibroadcast.track_id);
const body = { mode: 'tagtracks', args: { tagid: tagId, tracks: [trackId], untag: false } };
const data = Buffer.from(JSON.stringify(body));
const r = http.request({ hostname: '127.0.0.1', port: 5790, path: '/ib/api', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
  let d = ''; res.on('data', (c) => (d += c));
  res.on('end', () => { const o = JSON.parse(d); console.log('tagid', tagId, 'track', trackId, 'gateway', res.statusCode, 'ib', o.status, JSON.stringify(o.json).slice(0, 400)); });
});
r.write(data); r.end();
