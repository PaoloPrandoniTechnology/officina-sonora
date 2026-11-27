// Test del gateway: protezione, voto, coda e audio. Libreria in una cartella temporanea, mai quella vera.
//   node --test tools/test/gateway.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const LIB = fs.mkdtempSync(path.join(os.tmpdir(), 'ymf-lib-'));
process.env.YMF_LIBRERIA = LIB;
const GATEWAY = path.join(__dirname, '..', '..', 'gateway');
const { ammessa } = require(path.join(GATEWAY, 'protezione.js'));
const voti = require(path.join(GATEWAY, 'voti.js'));
test.after(() => fs.rmSync(LIB, { recursive: true, force: true }));

const ORA = Date.parse('2026-11-27T12:00:00.000Z');
const fa = (minuti) => new Date(ORA - minuti * 60000).toISOString();
function scheda(numero, campi, dir = 'Sottofondo') {
  const f = path.join(LIB, dir, `brano-${numero}.json`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ numero_traccia: numero, titolo: `Brano ${numero}`, categoria: 'A', durata_s: 180, generato_il: fa(1440), voto: null, ...campi }));
  return f;
}
const leggi = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const votato = scheda(1, { voto: 4, voto_il: fa(60), nota_utente: 'bella', voto_ib: 4 });
const due = scheda(2, {});
scheda(3, { categoria: 'B', generato_il: fa(2880) });
scheda(4, { categoria: 'B', generato_il: fa(5) });
scheda(5, {}, '_scartati');
scheda(6, { generato_il: fa(100) }); // senza file audio
const AUDIO = Buffer.from(Array.from({ length: 100 }, (_, i) => i));
fs.writeFileSync(due.replace(/json$/, 'mp3'), AUDIO);

test('ammessa: Host e Origin', () => {
  const h = (host, origin) => (origin === undefined ? { host } : { host, origin });
  assert.equal(ammessa('GET', h('evil.test')), false);
  assert.equal(ammessa('GET', {}), false);
  assert.equal(ammessa('GET', h('127.0.0.1:5790')), true);
  assert.equal(ammessa('GET', h('localhost:5790')), true);
  assert.equal(ammessa('POST', h('127.0.0.1:5790', 'https://evil.test')), false);
  assert.equal(ammessa('POST', h('127.0.0.1:5790', 'null')), false);
  assert.equal(ammessa('POST', h('127.0.0.1:5790', '')), false);
  assert.equal(ammessa('POST', h('localhost:5790', 'http://localhost:5790')), true);
  assert.equal(ammessa('POST', h('127.0.0.1:5790')), true);
});

test('elenco: coda e votati', () => {
  const e = voti.elenco(ORA);
  assert.deepEqual(e.coda.map((b) => b.numero), [3, 6, 2]);
  assert.deepEqual(e.votati, [{ numero: 1, titolo: 'Brano 1', categoria: 'A', durata_s: 180, generato_il: fa(1440), voto: 4, nota: 'bella', voto_il: fa(60) }]);
});

test('vota: rifiuta valori non validi senza scrivere', () => {
  const prima = fs.readFileSync(votato, 'utf8');
  for (const voto of [0, 6, 2.5, '3', undefined]) assert.throws(() => voti.vota({ numero: 1, voto }), /voto/);
  for (const numero of [99, NaN, '1', 5]) assert.throws(() => voti.vota({ numero, voto: 3 }), /brano/);
  for (const nota of ['x'.repeat(301), 'a<b', 'a>b', 7]) assert.throws(() => voti.vota({ numero: 1, voto: 3, nota }), /nota/);
  assert.equal(fs.readFileSync(votato, 'utf8'), prima);
});

test('vota: scrive i campi, conserva nota e voto_ib', () => {
  const inizio = Date.now();
  const r = voti.vota({ numero: 1, voto: 2, fonte: 'telegram' });
  assert.deepEqual(r, { ok: true, numero: 1, titolo: 'Brano 1', prima: { voto: 4, nota: 'bella' }, dopo: { voto: 2, nota: 'bella' } });
  const m = leggi(votato);
  assert.equal(m.voto, 2);
  assert.equal(m.voto_fonte, 'telegram');
  assert.equal(m.nota_utente, 'bella');
  assert.equal(m.voto_ib, 4);
  assert.ok(Date.parse(m.voto_il) >= inizio);
  voti.vota({ numero: 1, voto: 5, nota: 'x'.repeat(300), fonte: 'altro' });
  assert.equal(leggi(votato).voto_fonte, 'dashboard');
  assert.equal(leggi(votato).nota_utente.length, 300);
  assert.equal(fs.readdirSync(path.dirname(votato)).some((n) => n.endsWith('.tmp')), false);
});

test('vota: solo la nota tiene voto, fonte e data; serve un voto gia dato', () => {
  const prima = leggi(votato);
  const r = voti.vota({ numero: 1, nota: ' solo nota ', fonte: 'telegram' });
  assert.deepEqual(r.dopo, { voto: prima.voto, nota: 'solo nota' });
  assert.deepEqual(leggi(votato), { ...prima, nota_utente: 'solo nota' });
  const senza = fs.readFileSync(due, 'utf8');
  assert.throws(() => voti.vota({ numero: 2, nota: 'x', fonte: 'telegram' }), /ancora un voto/);
  assert.throws(() => voti.vota({ numero: 1, voto: null }), /voto/);
  assert.equal(fs.readFileSync(due, 'utf8'), senza);
});

const richiesta = (porta, percorso, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: porta, path: percorso, method, headers }, (res) => {
    const ch = [];
    res.on('data', (c) => ch.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(ch) }));
  });
  r.on('error', reject);
  r.end(body);
});

test('inviaAudio: intero, parziale, fuori intervallo', async (t) => {
  const s = http.createServer((req, res) => voti.inviaAudio(req, res, Number(req.url.slice(1))));
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  t.after(() => s.close());
  const chiedi = (n, range) => richiesta(s.address().port, `/${n}`, { headers: range ? { Range: range } : {} });

  let r = await chiedi(2);
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'audio/mpeg');
  assert.equal(r.headers['accept-ranges'], 'bytes');
  assert.deepEqual(r.buf, AUDIO);

  for (const [range, da, a] of [['bytes=0-9', 0, 9], ['bytes=90-', 90, 99], ['bytes=-5', 95, 99], ['bytes=95-5000', 95, 99], ['bytes=-5000', 0, 99]]) {
    r = await chiedi(2, range);
    assert.equal(r.status, 206, range);
    assert.equal(r.headers['content-range'], `bytes ${da}-${a}/100`, range);
    assert.equal(r.headers['content-length'], String(a - da + 1), range);
    assert.deepEqual(r.buf, AUDIO.subarray(da, a + 1), range);
  }
  for (const range of ['bytes=999999-', 'bytes=100-', 'bytes=-0', `bytes=${'9'.repeat(400)}-`]) {
    r = await chiedi(2, range);
    assert.equal(r.status, 416, range);
    assert.equal(r.headers['content-range'], 'bytes */100', range);
  }
  for (const range of ['bytes=abc', 'bytes=-', 'bytes=9-2', 'bytes=0-1,3-4', 'items=0-1']) {
    r = await chiedi(2, range);
    assert.equal(r.status, 200, range);
    assert.equal(r.buf.length, 100, range);
  }
  for (const n of [99, 5, 6, 2.5, 'x']) assert.equal((await chiedi(n)).status, 404, String(n));
});

// Il server vero, su una porta libera invece della 5790: l'Host resta quello di produzione.
test('server: protezione prima di ogni rotta, rotte voto e audio', async (t) => {
  const originale = http.Server.prototype.listen;
  let server;
  const pronto = new Promise((resolve) => {
    http.Server.prototype.listen = function () { server = this; return originale.call(this, 0, '127.0.0.1', resolve); };
  });
  t.mock.method(console, 'log', () => {});
  const storico = t.mock.method(fs, 'appendFileSync', () => {});
  try { require(path.join(GATEWAY, 'server.js')); } finally { http.Server.prototype.listen = originale; }
  await pronto;
  t.after(() => server.close());
  const chiedi = (percorso, { headers = {}, ...o } = {}) => richiesta(server.address().port, percorso, { ...o, headers: { Host: '127.0.0.1:5790', ...headers } });
  const posta = (percorso, dati, headers) => chiedi(percorso, { method: 'POST', headers, body: JSON.stringify(dati) });

  for (const p of ['/dashboard', '/api/stato', '/api/dati', '/api/controllo', '/api/voti', '/audio/brano?n=2']) {
    assert.equal((await chiedi(p, { headers: { Host: 'evil.test' } })).status, 403, p);
  }
  const evil = { Origin: 'https://evil.test', 'X-Controllo': '1' };
  for (const p of ['/voto', '/api/controllo/voto', '/tg', '/ib/api', '/audio/analizza']) {
    assert.equal((await posta(p, { numero: 2, voto: 1 }, evil)).status, 403, p);
  }
  assert.equal((await posta('/api/controllo/voto', { numero: 2, voto: 1 })).status, 403); // manca X-Controllo
  assert.equal(leggi(due).voto, null);

  assert.ok(JSON.parse((await chiedi('/api/voti')).buf).coda.some((b) => b.numero === 2));
  assert.deepEqual((await chiedi('/audio/brano?n=2')).buf, AUDIO);
  for (const n of ['', '..%2F..%2Fx', 'C:%5Cx', '2.5', '-2', '1e1', '2abc']) {
    assert.equal((await chiedi(`/audio/brano?n=${n}`)).status, 400, n);
  }
  assert.equal((await chiedi('/audio/brano?n=99')).status, 404);

  assert.equal((await posta('/voto', { numero: 2, voto: 9 })).status, 400);
  assert.equal((await posta('/voto', null)).status, 400);
  assert.equal(storico.mock.callCount(), 0);
  const ok = await posta('/voto', { numero: 2, voto: 3, nota: 'ok', fonte: 'telegram' });
  assert.equal(JSON.parse(ok.buf).ok, true);
  assert.equal(leggi(due).voto_fonte, 'telegram');
  const dash = await posta('/api/controllo/voto', { numero: 2, voto: 4 }, { 'X-Controllo': '1', Origin: 'http://127.0.0.1:5790' });
  assert.equal(dash.status, 200);
  assert.equal(leggi(due).voto, 4);
  assert.equal(storico.mock.callCount(), 2);
  assert.equal(JSON.parse(storico.mock.calls[0].arguments[1]).sezione, 'voti');
});
