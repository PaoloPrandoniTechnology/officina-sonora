// Compositore e revisore degli score: validità, durata, forma musicale, differenze tra generi
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../src/compositore/abc.js');
const C = require('../../src/compositore/compositore.js');

const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'catalogo.json'), 'utf8'));
const STRUMENTALI = CAT.categories.filter((c) => c.voce === 'strumentale');
const genere = (n) => CAT.categories.find((c) => c.name === n);
const brano = (nome, extra = {}) => {
  const cat = genere(nome);
  return C.componi({ cat, bpm: Math.round((cat.bpm[0] + cat.bpm[1]) / 2), tonalita: cat.tonalita[0], durata_s: 210, sezioni: CAT.strutture.arco, seed: 7, ...extra });
};
const suonate = (s) => s.battute.flatMap((b) => (b.ins || []).filter((n) => n.midi !== null));
const media = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1);

test('ogni genere strumentale: score valido, durata e lyrics coerenti, estensione suonabile', () => {
  for (const cat of STRUMENTALI) {
    for (const [i, sezioni] of Object.values(CAT.strutture).entries()) {
      const r = C.componi({ cat, bpm: cat.bpm[i % 2], tonalita: cat.tonalita[i % cat.tonalita.length], durata_s: 180 + i * 20, sezioni, seed: i + 1 });
      const chi = `${cat.name}/${i}`;
      assert.deepEqual(A.leggiAbc(r.abc).errori, [], chi);
      assert.ok(Math.abs(r.durata_s - (180 + i * 20)) / (180 + i * 20) <= 0.08, `${chi}: ${r.durata_s}`);
      assert.deepEqual(r.lyrics.split('\n\n'), sezioni, chi);
      const altezze = r.score.sezioni.flatMap(suonate).map((n) => n.midi);
      assert.ok(Math.min(...altezze) >= 52 && Math.max(...altezze) <= 91, `${chi}: ${Math.min(...altezze)}-${Math.max(...altezze)}`);
      assert.ok(r.score.sezioni.every((s) => s.battute.every((b) => b.accordi.length)), `${chi}: battuta senza accordo`);
    }
  }
});

test('deterministico col seed, diverso cambiando seed', () => {
  assert.equal(brano('Surf-rock-strumentale').abc, brano('Surf-rock-strumentale').abc);
  assert.notEqual(brano('Surf-rock-strumentale').abc, brano('Surf-rock-strumentale', { seed: 8 }).abc);
});

test('forma musicale: ritornello più alto della strofa, finale sulla tonica, note dell\'accordo sul primo tempo, tema che ritorna', () => {
  for (const nome of ['Surf-rock-strumentale', 'Score-cinematico', 'Jazz-lounge']) {
    const r = brano(nome);
    const per = (n) => media(r.score.sezioni.filter((s) => s.nome === n).flatMap(suonate).map((x) => x.midi));
    assert.ok(per('chorus') > per('verse') + 1, `${nome}: ${per('verse')} ${per('chorus')}`);
    const ultima = r.score.sezioni.flatMap(suonate).pop();
    assert.equal(ultima.midi % 12, C.tonica(genere(nome).tonalita[0]).pc, nome);
    assert.ok(r.dettagli.accordo >= 0.8, `${nome}: ${r.dettagli.accordo}`);
    assert.ok(r.dettagli.ritorno >= 0.2 && r.dettagli.ritorno <= 0.8, `${nome}: ${r.dettagli.ritorno}`);
    const strofe = r.score.sezioni.filter((s) => s.nome === 'verse');
    assert.notDeepEqual(strofe[0].battute.map((b) => b.ins), strofe[1].battute.map((b) => b.ins), `${nome}: strofe identiche`);
  }
});

test('revisore: sceglie il migliore tra i candidati', () => {
  const uno = brano('Surf-rock-strumentale', { candidati: 1 });
  const molti = brano('Surf-rock-strumentale', { candidati: 30 });
  assert.ok(molti.punteggio >= uno.punteggio && molti.punteggio <= 100, `${uno.punteggio} ${molti.punteggio}`);
});

test('generi distinti: densità e armonia diverse', () => {
  const densita = (r) => r.score.sezioni.flatMap(suonate).length / r.durata_s;
  assert.ok(densita(brano('Surf-rock-strumentale')) > densita(brano('Meditazione')) * 2);
  assert.match(brano('Jazz-lounge').abc, /maj7|m7/);
  assert.doesNotMatch(brano('Metal-strumentale').abc, /maj7/);
});

test('tonalità italiane del catalogo', () => {
  assert.deepEqual(C.tonica('La minore'), { sigla: 'Am', pc: 9, minore: true });
  assert.deepEqual(C.tonica('Si bemolle maggiore'), { sigla: 'Bb', pc: 10, minore: false });
  assert.deepEqual(C.tonica('Fa diesis minore'), { sigla: 'F#m', pc: 6, minore: true });
  assert.deepEqual(C.tonica(''), { sigla: 'Am', pc: 9, minore: true });
});
