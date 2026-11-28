// Linee guida a blocchi: vocabolario, composizione e controlli sui termini
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const CAT = JSON.parse(leggi('config', 'catalogo.json'));
const L = new Function('CFG', 'path', leggi('src', 'lib-apprendimento.js') + '\nreturn { componiStile, blocchiStile, divietiDi, erroreBlocco };')({ dir: RADICE, generiOverride: {} }, path);
const blues = CAT.categories.find((c) => c.name === 'Blues-shuffle-strumentale');
const stile = (guida) => L.componiStile(blues, null, blues.strumenti.slice(0, 3), '', guida, { bpm: 108, tonalita: 'Mi minore' });

test('blocchi: senza campi nuovi lo stile resta quello del catalogo', () => {
  assert.match(stile({}), /^Instrumental, blues shuffle, .*108 BPM, E minor, no vocals$/);
});

test('blocchi: aggiunte generali, tue e della revisione, in quest\'ordine', () => {
  const b = L.blocchiStile(blues, null, [], '', {
    style_extra: ['calm'], blocchi_generi: { [blues.name]: { aggiunti: ['gritty'] } }, stile_generi: { [blues.name]: ['raw'] },
  });
  assert.deepEqual(b.filter((x) => ['generale', 'tuo', 'revisione'].includes(x.origine)).map((x) => [x.testo, x.origine]),
    [['calm', 'generale'], ['gritty', 'tuo'], ['raw', 'revisione']]);
});

test('blocchi: le esclusioni tolgono catalogo e revisione, mai i blocchi fissi', () => {
  const g = { style_avoid: ['Blues Shuffle', 'no vocals', 'instrumental'], stile_generi: { [blues.name]: ['raw'] }, blocchi_generi: { [blues.name]: { esclusi: ['raw'] } } };
  const s = stile(g);
  assert.doesNotMatch(s, /blues shuffle|raw/);
  assert.match(s, /^Instrumental, .*no vocals$/);
  assert.match(L.divietiDi(blues, g), /raw/);
});

test('blocchi: controlli sui termini', () => {
  for (const t of ['a', 'x'.repeat(61), 'a, b', '<b>', 'no drums', '120 BPM', 'C# minor', 'Instrumental']) assert.ok(L.erroreBlocco(t), t);
  assert.ok(L.erroreBlocco('female vocals', { strumentale: true }));
  assert.equal(L.erroreBlocco('female vocals'), '');
  assert.equal(L.erroreBlocco('tibetan singing bowls', { strumentale: true }), '');
  assert.equal(L.erroreBlocco('warm tube amps', { strumentale: true }), '');
});

test('vocabolario: termini validi, una sola famiglia, catalogo e tag di YuE', () => {
  const { famiglie } = JSON.parse(leggi('config', 'vocabolario.json'));
  assert.deepEqual(Object.keys(famiglie), ['genere', 'strumenti', 'ritmo', 'atmosfera', 'timbro', 'produzione', 'voce']);
  const tutti = Object.values(famiglie).flat();
  assert.equal(new Set(tutti).size, tutti.length);
  assert.ok(famiglie.strumenti.includes('walking bass'));
  assert.ok(famiglie.voce.includes('female'));
  for (const [f, termini] of Object.entries(famiglie)) {
    for (const t of termini) assert.equal(L.erroreBlocco(t, { strumentale: f !== 'voce' }), '', `${f}: ${t}`);
  }
});

test('spiegazioni: ogni termine del vocabolario ha il suo testo per il tooltip', () => {
  const { famiglie } = JSON.parse(leggi('config', 'vocabolario.json'));
  const dir = path.join(RADICE, 'config', 'spiegazioni');
  const spiegati = new Set(fs.readdirSync(dir).flatMap((f) => leggi('config', 'spiegazioni', f).split(/\r?\n/))
    .filter((r) => r.includes('|') && r.split('|')[1].trim()).map((r) => r.split('|')[0].trim().toLowerCase()));
  assert.deepEqual(Object.values(famiglie).flat().filter((t) => !spiegati.has(t)), []);
});
