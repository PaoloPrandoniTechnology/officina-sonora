// Cestina su iBroadcast gli id di un elenco, escludendo quelli dei brani attualmente in libreria.
const fs = require('fs'), path = require('path'), http = require('http');
const elenco = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nuovi = new Set();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (f === '_scartati') continue;
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json') && f !== 'feedback.json') {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (m.ibroadcast && m.ibroadcast.track_id) nuovi.add(String(m.ibroadcast.track_id));
    }
  }
})('E:/libreria-storica');
const ids = elenco.filter((x) => !nuovi.has(String(x))).map(Number);
const data = Buffer.from(JSON.stringify({ mode: 'trash', args: { tracks: ids } }));
const r = http.request({ hostname: '127.0.0.1', port: 5790, path: '/ib/api', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    const j = (JSON.parse(d).json) || {};
    console.log((j.result === true ? 'OK ' : 'NO ') + ids.length + ' ' + (j.message || ''));
  });
});
r.write(data);
r.end();
