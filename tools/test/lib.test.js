// Test automatici delle funzioni critiche. Esecuzione (dalla cartella del progetto):
//   node --test tools/test/lib.test.js
// Usa file temporanei dentro state\ (l'unica cartella di scrittura consentita dalle guardie di lib.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');
const codice = ['lib.js', 'lib-apprendimento.js']
  .map((f) => fs.readFileSync(path.join(RADICE, 'src', f), 'utf8'))
  .join('\n');
// Le funzioni di lib.js sono scritte per la sandbox di n8n: le carichiamo in un contesto isolato
const ctx = vm.createContext({ require, console, process, Buffer, setTimeout, clearTimeout, URL, Promise });
vm.runInContext(codice, ctx);
const L = vm.runInContext('({ CFG, acquireLock, releaseLock, lockOccupato, slugify, clampDur, componiStile, numeroProgressivo, pickSlot, readGuidance, libraryTracks })', ctx);

const nomeLock = () => 'test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
const fileLock = (n) => path.join(L.CFG.dir, 'state', n + '.lock');

test('lock: un solo titolare alla volta', () => {
  const n = nomeLock();
  try {
    const t1 = L.acquireLock(n);
    assert.ok(t1, 'il primo deve ottenere il lock');
    assert.equal(L.acquireLock(n), null, 'il secondo deve trovarlo occupato');
    assert.equal(L.lockOccupato(n), true);
    L.releaseLock(n, 'token-sbagliato');
    assert.equal(L.acquireLock(n), null, 'un token errato non libera il lock');
    L.releaseLock(n, t1);
    assert.equal(L.lockOccupato(n), false);
    const t2 = L.acquireLock(n);
    assert.ok(t2, 'dopo il rilascio si puo\' riprendere');
    L.releaseLock(n, t2);
  } finally {
    fs.rmSync(fileLock(n), { force: true });
  }
});

test('lock: scade dopo il limite e non blocca per sempre', () => {
  const n = nomeLock();
  try {
    const t1 = L.acquireLock(n);
    assert.ok(t1);
    const vecchio = (Date.now() - 3600 * 1000) / 1000; // un'ora fa
    fs.utimesSync(fileLock(n), vecchio, vecchio);
    const t2 = L.acquireLock(n);
    assert.ok(t2, 'un lock scaduto deve essere ripreso');
    assert.notEqual(t2, t1);
    L.releaseLock(n, t2);
  } finally {
    fs.rmSync(fileLock(n), { force: true });
  }
});

test('slugify produce un nome file senza spazi', () => {
  assert.doesNotMatch(L.slugify('Eco della Lentezza!'), /\s/);
  assert.ok(L.slugify('Eco della Lentezza!').length > 0);
});

test('durata: il valore resta entro i limiti', () => {
  assert.ok(L.clampDur(9999) <= L.CFG.durMax);
  assert.ok(Number.isFinite(L.clampDur(undefined)));
});

test('stile: la chiusura dipende dal genere (strumentale o vocale senza parole)', () => {
  const base = { stile: 'ambient pad', enfasi: 'costruzione', melodia: 'tema', accordi: 'ciclico', ritmica: 'lenta' };
  const strumentale = L.componiStile({ ...base }, null, ['pad'], '', { style_extra: ['calm'] });
  assert.match(strumentale, /^Instrumental, .*no vocals$/);
  const vocale = L.componiStile({ ...base, vocale_senza_parole: true }, null, ['voce'], '', { style_extra: [] });
  assert.match(vocale, /^Wordless vocals, .*no lyrics$/);
  assert.doesNotMatch(vocale, /no vocals/);
});

test('numerazione: il progressivo cresce e non si ripete', () => {
  const file = path.join(L.CFG.dir, 'state', 'test-contatore.json');
  L.CFG.contatoreFile = file;
  try {
    const a = L.numeroProgressivo();
    const b = L.numeroProgressivo();
    const c = L.numeroProgressivo();
    assert.equal(b, a + 1);
    assert.equal(c, b + 1);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('rotazione: i generi senza brani vengono scelti', () => {
  L.CFG.generiOverride = {}; // pesi e generi sospesi della produzione non contano
  L.CFG.comandi = {}; // né un genere richiesto dalla dashboard
  const guidance = L.readGuidance();
  const nomi = L.CFG.categories.map((c) => c.name);
  const senza = nomi.slice(0, 3);
  // libreria finta: un brano per ogni genere tranne tre
  const radice = L.CFG.root;
  const dir = fs.mkdtempSync(path.join(RADICE, 'state', 'prova-libreria-'));
  try {
    nomi.slice(3).forEach((categoria, i) => fs.writeFileSync(path.join(dir, `${i}.json`), JSON.stringify({ titolo: 't', categoria })));
    L.CFG.root = dir;
    const scelte = {};
    for (let i = 0; i < 200; i++) {
      const slot = L.pickSlot({ recent: [], experiments: [], queue: [] }, guidance);
      scelte[slot.category.name] = (scelte[slot.category.name] || 0) + 1;
    }
    for (const n of senza) assert.ok(scelte[n] > 0, `genere senza brani mai scelto: ${n}`);
  } finally {
    L.CFG.root = radice;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('note: le direttive del produttore entrano nello stile del genere', () => {
  const oldOv = L.CFG.generiOverride;
  try {
    L.CFG.generiOverride = { 'Rock-test': { peso: 1, attivo: true, direttive: ['more guitar solos', 'use pan flute'] } };
    const cat = { name: 'Rock-test', stile: 'rock base', enfasi: 'x', melodia: 'y', accordi: 'z', ritmica: 'w' };
    const stile = L.componiStile(cat, null, ['chitarra'], '', { style_extra: [] });
    assert.match(stile, /more guitar solos, use pan flute/);
    assert.match(stile, /^Instrumental, .*no vocals$/);
    const senza = L.componiStile({ ...cat, name: 'Altro' }, null, ['chitarra'], '', { style_extra: [] });
    assert.doesNotMatch(senza, /producer notes/);
  } finally {
    L.CFG.generiOverride = oldOv;
  }
});

test('controllo: un genere sospeso non esce, "produci ora" forza il genere', () => {
  const guidance = L.readGuidance();
  const tuttiNomi = L.CFG.categories.map((c) => c.name);
  const oldOv = L.CFG.generiOverride, oldCmd = L.CFG.comandi;
  try {
    L.CFG.generiOverride = Object.fromEntries(tuttiNomi.map((n) => [n, { peso: 1, attivo: n !== 'Synthwave' }]));
    L.CFG.comandi = {};
    for (let i = 0; i < 150; i++) {
      const s = L.pickSlot({ recent: [], experiments: [], queue: [] }, guidance);
      assert.notEqual(s.category.name, 'Synthwave', 'un genere sospeso e\' stato scelto');
    }
    L.CFG.generiOverride = {};
    L.CFG.comandi = { produciGenere: 'Gamelan-ambient' };
    for (let i = 0; i < 10; i++) {
      const s = L.pickSlot({ recent: [], experiments: [], queue: [] }, guidance);
      assert.equal(s.category.name, 'Gamelan-ambient');
    }
  } finally {
    L.CFG.generiOverride = oldOv;
    L.CFG.comandi = oldCmd;
  }
});

test('catalogo: ogni genere e\' completo e coerente', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(RADICE, 'config', 'catalogo.json'), 'utf8'));
  const nomi = new Set();
  for (const c of cat.categories) {
    assert.ok(!nomi.has(c.name), `nome duplicato: ${c.name}`);
    nomi.add(c.name);
    assert.ok(c.genere, `${c.name}: manca genere`);
    assert.ok(c.stile, `${c.name}: manca stile`);
    assert.ok(Array.isArray(c.bpm) && c.bpm.length === 2 && c.bpm[0] < c.bpm[1], `${c.name}: bpm non validi`);
    assert.ok(c.energia >= 1 && c.energia <= 5, `${c.name}: energia fuori scala`);
    assert.ok(c.strumenti && c.strumenti.length > 0, `${c.name}: strumenti mancanti`);
    assert.ok(c.varianti && c.varianti.length > 0, `${c.name}: varianti mancanti`);
    assert.equal(c.colori.length, 3, `${c.name}: servono 3 colori`);
    if (c.vocale_senza_parole) {
      assert.doesNotMatch(c.stile, /instrumental/i, `${c.name}: genere vocale con stile strumentale`);
    }
  }
});
