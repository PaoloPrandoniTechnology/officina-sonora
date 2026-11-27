// Valori dei segnali per i nostri brani (solo conteggi): rating, ascolti, appartenenza a playlist e tag utente.
const http = require('http'), fs = require('fs'), path = require('path');
function decode(d) { if (!d || !d.map) return d; const out = {}; for (const [id, row] of Object.entries(d)) { if (id === 'map') continue; const o = {}; for (const [k, i] of Object.entries(d.map)) o[k] = row[i]; out[id] = o; } return out; }
const nostri = new Set();
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f === '_scartati') continue; if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json') && f !== 'feedback.json') { const m = JSON.parse(fs.readFileSync(p, 'utf8')); if (m.ibroadcast && m.ibroadcast.track_id) nostri.add(String(m.ibroadcast.track_id)); } } })('E:/libreria-storica');
const r = http.request({ hostname: '127.0.0.1', port: 5790, path: '/ib/library', method: 'POST', headers: { 'Content-Length': 0 } }, (res) => {
  let s = ''; res.on('data', (c) => (s += c));
  res.on('end', () => {
    const lib = JSON.parse(s).json.library;
    const tracks = decode(lib.tracks);
    const playlists = decode(lib.playlists);
    const tags = decode(lib.tags);
    const ratings = {}; let plays = 0, n = 0, trashed = 0;
    for (const [id, t] of Object.entries(tracks)) {
      if (!nostri.has(String(id))) continue;
      n++;
      ratings[t.rating] = (ratings[t.rating] || 0) + 1;
      plays += Number(t.plays) || 0;
      if (t.trashed) trashed++;
    }
    console.log('nostri brani trovati in libreria:', n, 'di', nostri.size);
    console.log('valutazioni (rating):', JSON.stringify(ratings));
    console.log('ascolti totali:', plays, '| nel cestino:', trashed);
    const yogaPl = Object.values(playlists).filter((p) => /^Yoga - /.test(p.name || ''));
    const pl = Object.values(playlists).filter((p) => !/^Yoga - /.test(p.name || '') && !/Recently|Most Recent/.test(p.name || ''));
    console.log('playlist utente (non nostre):', pl.map((p) => p.name + '(' + (p.tracks || []).length + ')').join(' | ') || 'nessuna');
    const tagUtente = Object.values(tags).filter((t) => !/^(yoga|categoria-|energia-|struttura-|tipo-)/.test(t.name || ''));
    console.log('tag utente:', tagUtente.map((t) => t.name + '(' + (t.tracks || []).length + ')').join(' | ') || 'nessuno');
  });
});
r.end();
