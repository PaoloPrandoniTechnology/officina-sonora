// Catena dei modelli di testo: servizi finti su 127.0.0.1, nessuna chiamata in rete
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { crea } = require('../../gateway/testi');

async function banco(risposte, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testi-'));
  const chiamate = [];
  const server = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      const nome = req.url.split('/')[1];
      chiamate.push({ nome, auth: req.headers.authorization, corpo: JSON.parse(corpo) });
      const r = risposte[nome] || { codice: 500 };
      res.writeHead(r.codice || 200, r.intestazioni || {});
      res.end(JSON.stringify({ choices: [{ finish_reason: r.fine || 'stop', message: { content: r.testo || '' } }] }));
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const url = (n) => `http://127.0.0.1:${server.address().port}/${n}`;
  const config = path.join(dir, 'servizi.json');
  fs.writeFileSync(config, JSON.stringify({ testi: ['primo', 'secondo', 'senzachiave'].map((n) => ({ nome: n, url: url(n), modello: 'm-' + n, chiave: n, margine: 100 })) }));
  for (const n of ['primo', 'secondo']) fs.writeFileSync(path.join(dir, `${n}.dpapi`), 'cifrato');
  let caricata = 0;
  let ora = Date.parse('2026-11-28T10:00:00Z');
  const t = crea({
    config, segreti: dir, stato: path.join(dir, 'testi.json'), locale: { url: url('locale'), modello: 'gemma' },
    decifra: async (f) => 'chiave-' + path.basename(f, '.dpapi'),
    carica: async () => { caricata++; }, renderInCorso: () => false, adesso: () => ora, ...extra,
  });
  return { t, dir, chiamate, caricata: () => caricata, avanti: (ms) => { ora += ms; }, fine: () => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const domanda = { system: 's', user: 'u', maxTokens: 200 };

test('risponde il primo servizio con chiave; il locale non si carica', async () => {
  const b = await banco({ primo: { testo: 'ecco {"titolo":"Alba"} fine' } });
  try {
    const r = await b.t.chiedi(domanda);
    assert.equal(r.servizio, 'primo');
    assert.deepEqual(r.dati, { titolo: 'Alba' });
    assert.equal(b.chiamate[0].auth, 'Bearer chiave-primo');
    assert.equal(b.chiamate[0].corpo.max_tokens, 300);
    assert.equal(b.caricata(), 0);
  } finally { b.fine(); }
});

test('quota finita: passa al successivo e sospende per il tempo indicato', async () => {
  const b = await banco({ primo: { codice: 429, intestazioni: { 'retry-after': '120' } }, secondo: { testo: '{"a":1}' } });
  try {
    assert.equal((await b.t.chiedi(domanda)).servizio, 'secondo');
    await b.t.chiedi(domanda);
    assert.deepEqual(b.chiamate.map((c) => c.nome), ['primo', 'secondo', 'secondo']);
    assert.ok(b.t.riepilogo()[0].sospesoFino);
    b.avanti(121000);
    await b.t.chiedi(domanda);
    assert.equal(b.chiamate[3].nome, 'primo');
  } finally { b.fine(); }
});

test('risposta senza JSON o troncata: si prova il successivo; finiti quelli cloud, gemma', async () => {
  const b = await banco({ primo: { testo: 'niente' }, secondo: { testo: '{"a":1}', fine: 'length' }, locale: { testo: '{"b":2}' } });
  try {
    const r = await b.t.chiedi(domanda);
    assert.equal(r.servizio, 'locale');
    assert.deepEqual(r.dati, { b: 2 });
    assert.equal(b.caricata(), 1);
    assert.equal(b.chiamate[2].auth, undefined, 'al locale non si manda alcuna chiave');
    assert.equal(b.chiamate[2].corpo.max_tokens, 6200);
  } finally { b.fine(); }
});

test('durante un render gemma non si carica; il suo errore resta riconoscibile', async () => {
  const b = await banco({ locale: { codice: 400 } }, { renderInCorso: () => true });
  try {
    await assert.rejects(b.t.chiedi(domanda), /LLM HTTP 400/);
    assert.equal(b.caricata(), 0);
  } finally { b.fine(); }
});

test('prova di un solo servizio: nessun ripiego; testo libero senza JSON', async () => {
  const b = await banco({ secondo: { testo: ' ciao ' }, locale: { testo: '{}' } });
  try {
    assert.equal((await b.t.chiedi({ ...domanda, json: false, solo: 'secondo' })).testo, 'ciao');
    await assert.rejects(b.t.chiedi({ ...domanda, solo: 'primo' }), /primo: HTTP 500/);
    await assert.rejects(b.t.chiedi({ ...domanda, solo: 'senzachiave' }), /chiave/);
    assert.equal(b.chiamate.length, 2);
  } finally { b.fine(); }
});

test('il riepilogo non contiene chiavi e dice chi è configurato', async () => {
  const b = await banco({ primo: { testo: '{}' } });
  try {
    await b.t.chiedi(domanda);
    const r = b.t.riepilogo();
    assert.deepEqual(r.map((x) => [x.nome, x.configurato, x.oggi]), [['primo', true, 1], ['secondo', true, 0], ['senzachiave', false, 0]]);
    assert.doesNotMatch(JSON.stringify(r), /chiave-|127\.0\.0\.1/);
  } finally { b.fine(); }
});

test('chiavi dalla dashboard: salvata cifrata, provata subito, mai restituita; togliere la cancella', async () => {
  const risposte = { primo: { codice: 401 } };
  const b = await banco(risposte, { cifra: async (v) => 'CIFRATO:' + v.length });
  try {
    await assert.rejects(b.t.chiedi({ ...domanda, solo: 'primo' }));
    assert.ok(b.t.riepilogo()[0].sospesoFino);
    risposte.primo = { testo: '{"ok":true}' };
    const r = await b.t.gestisci('chiave', { chiave: 'primo', valore: '  nuova-chiave-123  ' });
    assert.deepEqual(r, { ok: true, prove: [{ nome: 'primo', ok: true }] });
    assert.equal(fs.readFileSync(path.join(b.dir, 'primo.dpapi'), 'utf8'), 'CIFRATO:16');
    assert.equal(b.t.riepilogo()[0].sospesoFino, null);
    assert.doesNotMatch(JSON.stringify([r, b.t.riepilogo()]), /nuova-chiave/);
    await b.t.gestisci('togli', { chiave: 'primo' });
    assert.equal(b.t.riepilogo()[0].configurato, false);
    await assert.rejects(b.t.gestisci('prova', { chiave: 'primo' }), /non inserita/);
  } finally { b.fine(); }
});

test('chiavi dalla dashboard: nomi non previsti e valori strani si rifiutano', async () => {
  const b = await banco({}, { cifra: async () => 'x' });
  try {
    for (const chiave of ['../fuori', 'telegram', undefined]) await assert.rejects(b.t.gestisci('chiave', { chiave, valore: 'abcdefghijkl' }), /non previsto/);
    for (const valore of ['', 'corta', 'con spazio dentro 123', 'a'.repeat(400), 'à'.repeat(20)]) await assert.rejects(b.t.gestisci('chiave', { chiave: 'primo', valore }), /non valida/);
    await assert.rejects(b.t.gestisci('altro', { chiave: 'primo' }), /non previst/);
    assert.equal(fs.readFileSync(path.join(b.dir, 'primo.dpapi'), 'utf8'), 'cifrato', 'la chiave precedente resta');
  } finally { b.fine(); }
});
