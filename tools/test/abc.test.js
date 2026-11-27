// Score ABC per YuE2: scrittura, validazione, durata e lyrics
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../src/compositore/abc.js');

const n = (midi, durata, lega) => ({ midi, durata, ...(lega ? { lega } : {}) });
const base = (ins, extra = {}) => ({ bpm: 120, metro: '4/4', tonalita: 'G', sezioni: [{ nome: 'verse', battute: [{ accordi: [{ pos: 0, sigla: 'Gmaj7' }, { pos: 16, sigla: 'Am7' }], vocal: null, ins }] }], ...extra });
const battuta = (ins, accordi = []) => ({ accordi, vocal: null, ins });

test('intestazione e voci', () => {
  const t = A.scriviAbc(base([n(67, 32)]));
  for (const r of ['X:1', 'M:4/4', 'L:1/32', 'Q:1/4=120', 'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"', 'V: Ins clef=treble name="Ins Melody" snm="Inst."', 'K:G', '% verse']) assert.ok(t.split('\n').includes(r), r);
  assert.ok(t.includes('"Gmaj7"z16"Am7"z16|'), t);
});

test('armatura e alterazioni per lettera', () => {
  // in Sol: Fa# senza segno, Fa naturale col segno, e vale anche all'ottava sopra
  const t = A.scriviAbc(base([n(66, 8), n(65, 8), n(77, 8), n(78, 8)]));
  assert.ok(t.includes('F8=F8f8^f8|'), t);
});

test('durata 10 spezzata e legata', () => {
  assert.ok(A.scriviAbc(base([n(60, 10), n(null, 22)])).includes('C8-C2'));
});

test('andata e ritorno', () => {
  const s = base([n(66, 16), n(69, 16)]);
  const r = A.leggiAbc(A.scriviAbc(s));
  assert.deepEqual(r.errori, []);
  assert.deepEqual(r.score.sezioni[0].battute[0].ins, s.sezioni[0].battute[0].ins);
  assert.deepEqual(r.score.sezioni[0].battute[0].accordi, s.sezioni[0].battute[0].accordi);
});

test('accordo in mezzo a una nota: nota spezzata e legata', () => {
  const s = base([n(null, 32)]);
  s.sezioni[0].battute[0].vocal = [n(60, 32)];
  const t = A.scriviAbc(s);
  assert.ok(t.includes('"Gmaj7"C16-"Am7"C16|'), t);
  assert.deepEqual(A.leggiAbc(t).errori, []);
});

test('errori', () => {
  assert.throws(() => A.scriviAbc(base([n(60, 31)])), /battuta/);
  assert.throws(() => A.scriviAbc(base([n(60, 32, true)])), /legatura/);
  const buono = A.scriviAbc(base([n(60, 32)]));
  for (const rotto of [buono.replace('Gmaj7', 'Gmaj9'), buono.replace('C32', '[CE]32'), buono.replace('C32', '(3CCC'), buono + 'V: Basso\n', buono.replace('C32', 'C16C10C6'), ''])
    assert.notDeepEqual(A.leggiAbc(rotto).errori, [], rotto);
});

test('voci con numero di battute diverso: errore', () => {
  const buono = A.scriviAbc(base([n(60, 32)]));
  assert.notDeepEqual(A.leggiAbc(buono.replace('C32|', 'C32|C32|')).errori, []);
});

test('metri dispari, cambio di tonalità e ritorno', () => {
  const s = { bpm: 92, metro: '4/4', tonalita: 'Dm', sezioni: [
    { nome: 'intro', metro: '3/4', battute: [battuta([n(62, 24)])] },
    { nome: 'verse', battute: [battuta([n(70, 32)])] },
    { nome: 'interlude', metro: '7/8', tonalita: 'F', battute: [battuta([n(70, 24), n(65, 4)])] },
    { nome: 'outro', battute: [battuta([n(62, 32)])] },
  ] };
  const t = A.scriviAbc(s);
  const righe = t.split('\n');
  assert.ok(righe.includes('M:3/4') && righe.includes('M:7/8') && righe.includes('K:F'), t);
  const r = A.leggiAbc(t);
  assert.deepEqual(r.errori, []);
  assert.deepEqual(r.score.sezioni.map((x) => [x.nome, x.metro || r.score.metro, x.tonalita || r.score.tonalita]),
    [['intro', '3/4', 'Dm'], ['verse', '4/4', 'Dm'], ['interlude', '7/8', 'F'], ['outro', '4/4', 'Dm']]);
  assert.deepEqual(r.score.sezioni.map((x) => x.battute[0].ins), s.sezioni.map((x) => x.battute[0].ins));
});

test('legatura oltre la stanghetta mantiene l\'altezza', () => {
  const s = base([n(66, 32)]);
  s.sezioni[0].battute = [battuta([n(null, 24), n(65, 8, true)]), battuta([n(65, 16), n(65, 16)])];
  const t = A.scriviAbc(s);
  const r = A.leggiAbc(t);
  assert.deepEqual(r.errori, [], t);
  assert.deepEqual(r.score.sezioni[0].battute.map((b) => b.ins.map((x) => x.midi)), [[null, 65], [65, 65]]);
});

test('blocchi di al massimo 4 battute e pause intere', () => {
  const s = base([n(60, 32)]);
  s.sezioni[0].battute = [...Array(6)].map(() => battuta(null));
  const t = A.scriviAbc(s);
  assert.ok(t.includes('Z4|') && t.includes('Z2|'), t);
  assert.equal(A.leggiAbc(t).score.sezioni[0].battute.length, 6);
});

test('legge l\'esempio ufficiale', () => {
  const t = ['X:1', 'T:', 'M:4/4', 'L:1/32', 'Q:1/4=88', 'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"', 'V: Ins clef=treble name="Ins Melody" snm="Inst."', 'K:G', '% verse', 'V: Vocal', '"Gmaj7"B8d8"Am7"c8A8|"D7"F16"G"G16|', 'V: Ins', 'Z2|', ''].join('\n');
  const r = A.leggiAbc(t);
  assert.deepEqual(r.errori, []);
  assert.equal(r.score.sezioni[0].battute.length, 2);
  assert.deepEqual(r.score.sezioni[0].battute[1].accordi, [{ pos: 0, sigla: 'D7' }, { pos: 16, sigla: 'G' }]);
});

test('durata e lyrics', () => {
  const s = base([n(60, 32)]);
  assert.equal(A.durataSecondi(s), 2);
  assert.equal(A.lyricsDaScore(s, { forma: 'semplice' }), '[verse]');
  assert.equal(A.lyricsDaScore(s, { forma: 'tempi' }), '[verse 0:00-0:02]');
  assert.equal(A.lyricsDaScore(s, { forma: 'indicazioni', note: ['guitar theme'] }), '[verse - guitar theme]');
  s.sezioni.push({ nome: 'interlude', battute: [battuta(null)] });
  assert.equal(A.lyricsDaScore(s, { forma: 'tempi' }), '[verse 0:00-0:02]\n\n[bridge 0:02-0:04]');
});
