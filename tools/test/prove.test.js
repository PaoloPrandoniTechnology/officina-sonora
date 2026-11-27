// Runner delle prove sul motore: griglia A/B ed esecuzione contro un motore finto
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const A = require('../../src/compositore/abc.js');
const SCORE = require('../prove/score-prova.js');
const { griglia, esegui, pagina } = require('../prove/prove-motore.js');

test('griglia: 14 prove, score validi, durata e lyrics', () => {
  const g = griglia();
  assert.equal(g.length, 14);
  assert.equal(new Set(g.map((p) => p.id)).size, 14);
  for (const s of [SCORE.surf, SCORE.cinematico]) {
    const d = A.durataSecondi(s);
    assert.ok(d >= 105 && d <= 135, `durata ${d}`);
  }
  for (const p of g) {
    if (p.body.abc) assert.deepEqual(A.leggiAbc(p.body.abc).errori, [], p.id);
    if ('CDEFGH'.includes(p.variante)) {
      assert.ok(p.body.abc, p.id);
      for (const [, tag] of p.body.lyrics.matchAll(/\[([a-z-]+)/gi)) assert.ok(A.TAG.includes(tag), `${p.id}: ${tag}`);
    }
    assert.ok(p.body.semantic_sampling.max_tokens <= 9000);
    assert.equal(p.body.seed, 424242);
  }
  assert.equal(g.find((p) => p.id === 'cinematico-A').body.abc, undefined);
  assert.deepEqual(g.find((p) => p.id === 'cinematico-G').body.adapters[1], { name: 'yue2-epic-trailer', scale: 1, ar_scale: 0.5, nar_scale: 0.375 });
});

// Motore finto: risponde come yue-server
async function motoreFinto({ adapters, rifiuta = [], secondi = 130, replica = '{"abc":"X:1"}', errore = 'no' }) {
  let invii = 0;
  const srv = http.createServer((req, res) => {
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    req.resume();
    req.on('end', () => {
      if (req.url === '/props') return json(200, adapters ? { adapters: adapters.map((name) => ({ name, ok: true })) } : {});
      if (req.url === '/synth') return rifiuta.includes(++invii) ? json(400, { error: errore }) : json(200, { id: 'j' + invii });
      if (req.url.includes('result=1')) {
        res.writeHead(200, { 'Content-Type': 'multipart/mixed; boundary=XX' });
        return res.end(Buffer.concat([
          Buffer.from('--XX\r\nContent-Type: application/json\r\n\r\n' + replica + '\r\n--XX\r\nContent-Type: audio/mpeg\r\nContent-Disposition: attachment; filename="a.mp3"\r\n\r\n'),
          Buffer.alloc(secondi * 16000), Buffer.from('\r\n--XX--\r\n'),
        ]));
      }
      return json(200, { status: 'done' });
    });
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}`, invii: () => invii, chiudi: () => srv.close() };
}
const TUTTI = ['yue2-instrumental', 'yue2-instrumental-kto', 'yue2-epic-trailer', 'yue2-slider-indie-rock'];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prove-'));

test('una prova rifiutata non ferma le altre; al rilancio si ripete solo quella', async () => {
  const m = await motoreFinto({ adapters: TUTTI, rifiuta: [2] });
  const cartella = tmp();
  try {
    const prove = griglia().slice(0, 3);
    const esiti = await esegui({ prove, motore: m.url, cartella, attesaMs: 1 });
    assert.deepEqual(esiti.map((e) => e.stato), ['ok', 'fallita', 'ok']);
    assert.match(esiti[1].motivo, /400/);
    for (const f of ['richiesta.json', 'audio.mp3', 'risposta-1.json']) assert.ok(fs.existsSync(path.join(cartella, prove[0].id, f)), f);
    assert.ok(fs.readFileSync(path.join(cartella, 'index.html'), 'utf8').includes(`${prove[0].id}/audio.mp3`));
    const ancora = await esegui({ prove, motore: m.url, cartella, attesaMs: 1 });
    assert.deepEqual(ancora.map((e) => e.stato), ['ok', 'ok', 'ok']);
    assert.equal(m.invii(), 4);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('adapter assente: prova saltata col nome', async () => {
  const m = await motoreFinto({ adapters: ['yue2-instrumental-kto'] });
  const cartella = tmp();
  try {
    const prove = griglia().filter((p) => ['surf-A', 'surf-C'].includes(p.id));
    const esiti = await esegui({ prove, motore: m.url, cartella, attesaMs: 1 });
    assert.deepEqual(esiti.map((e) => e.stato), ['ok', 'saltata']);
    assert.match(esiti[1].motivo, /yue2-instrumental/);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('audio molto più corto dello score: segnalato come troncato', async () => {
  const m = await motoreFinto({ adapters: TUTTI, secondi: 60 });
  const cartella = tmp();
  try {
    const [e] = await esegui({ prove: griglia().slice(0, 1), motore: m.url, cartella, attesaMs: 1 });
    assert.equal(e.troncato, true);
    assert.match(fs.readFileSync(path.join(cartella, 'index.html'), 'utf8'), /TRONCATO/);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('motore spento: tutte fallite, pagina scritta lo stesso', async () => {
  const cartella = tmp();
  try {
    const esiti = await esegui({ prove: griglia().slice(0, 2), motore: 'http://127.0.0.1:1', cartella, attesaMs: 1 });
    assert.deepEqual(esiti.map((e) => e.stato), ['fallita', 'fallita']);
    assert.ok(fs.existsSync(path.join(cartella, 'index.html')));
  } finally { fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('pagina: il testo delle richieste non diventa HTML', () => {
  const html = pagina([{ id: 'x', brano: 'surf', variante: 'A', body: { style: '<script>alert(1)</script>', lyrics: '' } }], [{ id: 'x', stato: 'fallita', motivo: '<img>' }]);
  assert.ok(!html.includes('<script>alert') && !html.includes('<img>'));
});

test('cinematico: sensibile scritta Do diesis; sull\'accordo di La7 l\'ostinato non suona il Si bemolle', () => {
  const abc = A.scriviAbc(SCORE.cinematico);
  assert.ok(abc.includes('^c') && !abc.includes('_d'), abc);
  for (const b of SCORE.cinematico.sezioni.find((s) => s.nome === 'interlude').battute) {
    if (b.accordi[0].sigla === 'A7') assert.ok(b.ins.every((x) => x.midi % 12 !== 10));
  }
});

test('audio arrivato al limite richiesto: segnalato', async () => {
  const m = await motoreFinto({ adapters: TUTTI, secondi: 138 });
  const cartella = tmp();
  try {
    const [e] = await esegui({ prove: griglia().slice(0, 1), motore: m.url, cartella, attesaMs: 1 });
    assert.equal(e.alLimite, true);
    assert.match(fs.readFileSync(path.join(cartella, 'index.html'), 'utf8'), /LIMITE/);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('score restituito dal motore: durata ed errori in pagina', async () => {
  const abc = A.scriviAbc({ bpm: 120, metro: '4/4', tonalita: 'C', sezioni: [{ nome: 'verse', battute: [{ accordi: [], vocal: null, ins: null }] }] });
  const m = await motoreFinto({ adapters: TUTTI, replica: JSON.stringify({ abc }) });
  const cartella = tmp();
  try {
    const [e] = await esegui({ prove: griglia().slice(1, 2), motore: m.url, cartella, attesaMs: 1 });
    assert.deepEqual(e.score, { secondi: 2, errori: 0, file: 'risposta-1.json' });
    assert.equal(e.troncato, true);
    assert.match(fs.readFileSync(path.join(cartella, 'index.html'), 'utf8'), /score restituito: 2 s/);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('richiesta cambiata: la prova riuscita si ripete', async () => {
  const m = await motoreFinto({ adapters: TUTTI });
  const cartella = tmp();
  try {
    const prove = griglia().slice(0, 1);
    await esegui({ prove, motore: m.url, cartella, attesaMs: 1 });
    prove[0].body.style += ', changed';
    await esegui({ prove, motore: m.url, cartella, attesaMs: 1 });
    assert.equal(m.invii(), 2);
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('adapter rifiutato da /synth o /props senza elenco: saltata, non fallita', async () => {
  const m = await motoreFinto({ adapters: null, rifiuta: [1], errore: 'unknown adapter: yue2-instrumental' });
  const cartella = tmp();
  try {
    const [e] = await esegui({ prove: griglia().slice(0, 1), motore: m.url, cartella, attesaMs: 1 });
    assert.equal(e.stato, 'saltata');
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});

test('/props senza elenco di adapter: la prova parte', async () => {
  const m = await motoreFinto({ adapters: null });
  const cartella = tmp();
  try {
    const [e] = await esegui({ prove: griglia().slice(0, 1), motore: m.url, cartella, attesaMs: 1 });
    assert.equal(e.stato, 'ok');
  } finally { m.chiudi(); fs.rmSync(cartella, { recursive: true, force: true }); }
});
