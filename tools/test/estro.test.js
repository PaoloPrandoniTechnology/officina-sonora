// Compositore estro: score validi e vari, richiami fedeli, forme che ruotano, stile con i suoni del brano
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../src/compositore/abc.js');
const E = require('../../src/compositore/estro.js');

const RADICE = path.join(__dirname, '..', '..');
const CAT = JSON.parse(fs.readFileSync(path.join(RADICE, 'config', 'catalogo.json'), 'utf8'));
const CREATIVI = CAT.categories.filter((c) => c.estro && !c.vocale_senza_parole);
const genere = (n) => CAT.categories.find((c) => c.name === n);
const brano = (nome, extra = {}) => {
  const cat = genere(nome);
  return E.componi({ cat, bpm: cat.bpm[0], tonalita: cat.tonalita[0], durata_s: 210, estro: cat.estro, seed: 7, ...extra });
};
const L = new Function('CFG', 'path', fs.readFileSync(path.join(RADICE, 'src', 'lib-apprendimento.js'), 'utf8') + '\nreturn { componiStile, strumentiDelGruppo };')({ dir: RADICE, generiOverride: {} }, path);

test('ogni genere ha il livello di estro; yoga e meditazione restano di quiete', () => {
  assert.ok(CAT.categories.every((c) => [0, 1, 2].includes(c.estro)));
  assert.equal(genere('Meditazione').estro, 0);
  assert.equal(genere('Metal-strumentale').estro, 2);
});

test('ogni genere creativo, per molti semi: valido, in durata, in estensione, né ciclico né caotico', () => {
  for (const cat of CREATIVI) {
    for (let seed = 1; seed <= 6; seed++) {
      const durata = 120 + seed * 25;
      const r = E.componi({ cat, bpm: cat.bpm[seed % 2], tonalita: cat.tonalita[seed % cat.tonalita.length], durata_s: durata, estro: cat.estro, seed, candidati: 8 });
      const chi = `${cat.name}/${seed}`;
      const a = A.analizza(r.abc);
      assert.deepEqual(a.errori, [], chi);
      assert.ok(Math.abs(r.durata_s - durata) / durata <= 0.08, `${chi}: ${r.durata_s} invece di ${durata}`);
      assert.ok(a.estensione[0] >= 52 && a.estensione[1] <= 91, `${chi}: ${a.estensione}`);
      assert.ok(a.ripetizione >= 0.05 && a.ripetizione <= 0.65, `${chi}: ripetizione ${a.ripetizione}`);
      assert.ok(a.accordi >= 8, `${chi}: ${a.accordi} cambi di accordo`);
      assert.ok(a.score.sezioni.every((s) => s.battute.every((b) => b.accordi.length)), `${chi}: battuta senza accordo`);
      assert.ok(a.score.sezioni.some((s) => ['interlude', 'bridge'].includes(s.nome)), `${chi}: nessuno stacco`);
      assert.ok(r.lyrics.split('\n\n').every((t) => A.TAG.includes(t.slice(1, -1))), chi);
      assert.ok(a.score.sezioni.every((s) => !s.metro), chi);
    }
  }
});

test('deterministico col seme', () => {
  assert.equal(brano('Metal-strumentale').abc, brano('Metal-strumentale').abc);
  assert.notEqual(brano('Metal-strumentale').abc, brano('Metal-strumentale', { seed: 8 }).abc);
});

test('di brano in brano forma e richiamo cambiano; le sorprese restano poche', () => {
  const precedenti = [];
  const fatti = [];
  for (let seed = 1; seed <= 40; seed++) {
    const r = brano('Hard-rock-strumentale', { seed: seed * 101, precedenti, candidati: 8 });
    if (precedenti.length) assert.notEqual(r.parametri.forma, precedenti.at(-1).forma);
    if (r.cameo) assert.ok(!precedenti.slice(-4).some((p) => p.cameo === r.cameo.id), r.cameo.id);
    assert.ok(r.score.sezioni.filter((s) => s.nome === 'bridge').length <= 1);
    precedenti.push(r.firma);
    fatti.push(r);
  }
  const tutte = new Set(fatti.flatMap((r) => r.trovate));
  for (const t of ['solo', 'ponte', 'modulazione', 'cameo', 'fill']) assert.ok(tutte.has(t), t);
  const conCameo = fatti.filter((r) => r.cameo).length;
  assert.ok(conCameo >= 4 && conCameo <= 24, `${conCameo}`);
});

test('il richiamo è nello score, intero e trasportato nella tonalità', () => {
  let visti = 0;
  for (let seed = 1; seed <= 90; seed++) {
    const r = brano('Folk-balcanico', { seed, candidati: 3 });
    if (!r.cameo) continue;
    const c = E.CAMEI[r.cameo.id];
    const battute = r.score.sezioni[r.cameo.sezione].battute.slice(...r.cameo.battute);
    const suonate = battute.map((b) => b.ins.map((n) => [n.midi, n.durata]));
    const base = suonate.flat().find((n) => n[0] !== null)[0] - c.note.flat().find((n) => n[0] !== null)[0];
    assert.deepEqual(suonate, c.note.map((b) => b.map(([x, d]) => [x === null ? null : base + x, d])), r.cameo.id);
    visti++;
  }
  assert.ok(visti > 10, `${visti}`);
  for (const [id, c] of Object.entries(E.CAMEI)) {
    for (const b of c.note) assert.equal(b.reduce((s, n) => s + n[1], 0), 32, id);
  }
});

test('forma scelta a mano (editor): si rispettano le sezioni richieste', () => {
  const sezioni = ['intro', 'verse', 'chorus', 'bridge', 'outro'];
  assert.deepEqual(brano('Surf-rock-strumentale', { sezioni }).score.sezioni.map((s) => s.nome), sezioni);
});

test('organico: fissi sempre, uno a scelta che cambia; niente varianti né doppioni nello stile', () => {
  for (const cat of CAT.categories) {
    const { fissi, scelta } = cat.organico;
    assert.ok(fissi.length >= 1 && scelta.length >= 1, cat.name);
    assert.deepEqual([...fissi, ...scelta], cat.strumenti, cat.name);
    const g = {};
    let prima = null;
    for (let i = 0; i < 6; i++) {
      const s = L.strumentiDelGruppo(cat, g);
      assert.deepEqual(s.slice(0, -1), fissi, cat.name);
      assert.ok(scelta.includes(s.at(-1)) && (scelta.length === 1 || s.at(-1) !== prima), cat.name);
      prima = s.at(-1);
    }
    const stile = L.componiStile(cat, cat.varianti[0], L.strumentiDelGruppo(cat, g), '', {});
    assert.ok(stile.includes(cat.en.instruments[fissi[0]]) && stile.includes(cat.en.space), stile);
    if (cat.varianti[0].keywords !== cat.stile) assert.ok(!stile.includes(cat.varianti[0].keywords), stile);
  }
});
