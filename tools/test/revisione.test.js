// Difetti corretti nella revisione completa: caricamento, scrittura, copertina, indice della libreria, arresto.
//   node --test tools/test/revisione.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const { scriviAtomico } = require(path.join(RADICE, 'gateway', 'disco.js'));
const { copertinaDi } = require(path.join(RADICE, 'gateway', 'id3.js'));
const libreria = require(path.join(RADICE, 'gateway', 'libreria.js'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rev-'));

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
async function carica(risposta) {
  const blocco = new AsyncFunction('$input', 'gwUpload', 'fs', 'path', 'log', leggi('src', 'blocks', '03d2-carica-ibroadcast.js'));
  const state = { uploadQueue: [] };
  const [out] = await blocco(
    { first: () => ({ json: { state, daCaricare: [{ file: 'a.mp3', jsonPath: 'a.json', nTags: 1 }] } }) },
    async () => risposta, { readFileSync: () => Buffer.alloc(1) }, path, () => {});
  return { caricati: out.json.caricati, coda: state.uploadQueue };
}

test('caricamento: un errore del gateway non vale come brano caricato', async () => {
  for (const r of [{ status: 500, ok: false, error: 'refresh non valido' }, { status: 401, json: null }, { status: 200, json: { result: false } }]) {
    assert.deepEqual(await carica(r), { caricati: [], coda: ['a.mp3'] });
  }
  const ok = await carica({ status: 200, json: { result: true, message: 'a.mp3 (123) uploaded successfully' } });
  assert.equal(ok.caricati[0].trackId, '123');
  assert.deepEqual(ok.coda, []);
});

test('scrittura atomica: sostituisce il file senza lasciare temporanei', () => {
  const d = tmp();
  const f = path.join(d, 'x.json');
  scriviAtomico(f, 'uno');
  scriviAtomico(f, 'due', '.voto.tmp');
  assert.equal(fs.readFileSync(f, 'utf8'), 'due');
  assert.deepEqual(fs.readdirSync(d), ['x.json']);
});

test('copertina: si legge il frame APIC scritto dal blocco di caricamento', () => {
  const img = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const corpo = Buffer.concat([Buffer.from([0]), Buffer.from('image/jpeg\0', 'latin1'), Buffer.from([3, 0]), img]);
  const testa = Buffer.alloc(10);
  testa.write('APIC');
  testa.writeUInt32BE(corpo.length, 4);
  const n = 10 + corpo.length;
  const f = path.join(tmp(), 'a.mp3');
  fs.writeFileSync(f, Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, 0, 0, n >> 7, n & 0x7f]), testa, corpo, Buffer.from('audio')]));
  assert.deepEqual(copertinaDi(f), { mime: 'image/jpeg', dati: img });
  fs.writeFileSync(f, 'senza tag');
  assert.equal(copertinaDi(f), null);
});

test('libreria: rilegge solo le schede cambiate e segna gli scartati', () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, '_scartati'));
  fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ titolo: 'A' }));
  fs.writeFileSync(path.join(d, '_scartati', 'b.json'), JSON.stringify({ titolo: 'B' }));
  const prima = libreria.schede(d);
  assert.deepEqual(prima.map((s) => [s.meta.titolo, s.scartato]).sort(), [['A', false], ['B', true]]);
  assert.equal(libreria.schede(d).find((s) => s.meta.titolo === 'A').meta, prima.find((s) => s.meta.titolo === 'A').meta);
  fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ titolo: 'A2' }));
  assert.ok(libreria.schede(d).some((s) => s.meta.titolo === 'A2'));
});

test('arresto: il file STOP resta, altrimenti il supervisore riavvia', () => {
  assert.doesNotMatch(leggi('stop.ps1'), /Remove-Item[^\n]*STOP/);
});

test('rigenerazione: il segno "vocale" resta', () => {
  assert.match(leggi('src', 'blocks', '03a-controllo-qualita.js'), /vocale: voceDi/);
});
