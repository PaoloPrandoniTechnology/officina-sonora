// Test del generatore di sfondi (senza WebUI). Esecuzione: node --test tools/test/sfondi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mancanti, conPausa } = require(path.join(__dirname, '..', 'genera-sfondi.js'));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-'));
const leggi = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('mancanti: solo i file che non ci sono', () => {
  const c = tmp();
  fs.mkdirSync(path.join(c, 'Meditazione'));
  for (const n of ['01.jpg', '03.jpg', '_foglio.jpg']) fs.writeFileSync(path.join(c, 'Meditazione', n), 'x');
  const m = mancanti(['Meditazione', 'Synthwave'], c);
  assert.deepEqual(m.filter((x) => x.categoria === 'Meditazione').map((x) => path.basename(x.file)), ['02.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg']);
  assert.equal(m.filter((x) => x.categoria === 'Synthwave').length, 8);
  assert.ok(m.every((x) => Number.isInteger(x.seed) && x.seed >= 0));
});

test('conPausa: mette in pausa durante il lavoro e ripristina anche dopo un errore', async () => {
  const f = path.join(tmp(), 'comandi.json');
  await assert.rejects(() => conPausa(async (inPausa) => {
    assert.equal(leggi(f).pausa, true);
    assert.equal(inPausa(), true);
    throw new Error('guasto');
  }, f), /guasto/);
  assert.ok(!fs.existsSync(f), 'il file non esisteva e non deve restare');
});

test('conPausa: una pausa gia impostata resta e le altre chiavi si conservano', async () => {
  const f = path.join(tmp(), 'comandi.json');
  fs.writeFileSync(f, JSON.stringify({ pausa: true, svuotaCoda: true }));
  await conPausa(async () => {}, f);
  assert.deepEqual(leggi(f), { pausa: true, svuotaCoda: true });
  fs.writeFileSync(f, JSON.stringify({ svuotaCoda: true }));
  await conPausa(async () => {
    fs.writeFileSync(f, JSON.stringify({ ...leggi(f), produciGenere: 'Synthwave' }));
  }, f);
  assert.deepEqual(leggi(f), { svuotaCoda: true, produciGenere: 'Synthwave' });
});

test('conPausa: se la produzione viene ripresa dalla dashboard, inPausa lo segnala', async () => {
  const f = path.join(tmp(), 'comandi.json');
  await conPausa(async (inPausa) => {
    fs.writeFileSync(f, '{}');
    assert.equal(inPausa(), false);
  }, f);
});
