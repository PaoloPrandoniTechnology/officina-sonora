// Esplorazione della libreria iBroadcast via gateway: stampa solo struttura e conteggi, nessun dato personale.
const http = require('http');
function decode(d) {
  if (!d || !d.map) return d;
  const out = {};
  for (const [id, row] of Object.entries(d)) {
    if (id === 'map') continue;
    const o = {};
    for (const [k, idx] of Object.entries(d.map)) o[k] = row[idx];
    out[id] = o;
  }
  return out;
}
const r = http.request({ hostname: '127.0.0.1', port: 5790, path: '/ib/library', method: 'POST', headers: { 'Content-Length': 0 } }, (res) => {
  let s = ''; res.on('data', (c) => (s += c));
  res.on('end', () => {
    const j = JSON.parse(s).json || {};
    const lib = j.library || {};
    console.log('chiavi risposta:', Object.keys(j).join(', '));
    console.log('chiavi library:', Object.keys(lib).join(', '));
    const tracks = decode(lib.tracks || {});
    const playlists = decode(lib.playlists || {});
    const tags = decode(lib.tags || {});
    const t1 = Object.values(tracks)[0] || {};
    console.log('campi brano:', Object.keys(t1).join(', '));
    console.log('brani:', Object.keys(tracks).length, '| playlist:', Object.keys(playlists).length, '| tag:', Object.keys(tags).length);
    console.log('playlist:', Object.values(playlists).map((p) => (p.name || '?') + '(' + (p.tracks || []).length + ')').join(' | '));
    console.log('tag:', Object.values(tags).map((t) => (t.name || '?') + '(' + (t.tracks || []).length + ')').join(' | '));
  });
});
r.end();
