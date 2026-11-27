// Test dei tag ID3 e della copertina nel file. Esecuzione: node --test tools/test/id3.test.js
// Usa solo file temporanei; il gateway e' sostituito da una funzione di prova.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'src');
const leggi = (f) => fs.readFileSync(path.join(src, f), 'utf8');

const AF = Object.getPrototypeOf(async function () {}).constructor;
const carica = () => new AF('require', 'console', ['lib.js', 'lib-apprendimento.js', 'lib-ibroadcast.js', 'cover.js'].map(leggi).join('\n')
  + '\nreturn { tagFile, copertinaPer, chiaveId3, fnvAudio, audioIntegro: typeof audioIntegro === "function" ? audioIntegro : undefined, CFG, setGw: (f) => { gw = f; } };')(require, console);

function frames(buf) {
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const testo = (b) => b.toString('utf16le').replace(/^﻿/, '');
  const out = { TXXX: {} };
  for (let p = 10; p < 10 + size;) {
    const id = buf.toString('ascii', p, p + 4);
    const len = buf.readUInt32BE(p + 4);
    const d = buf.subarray(p + 10, p + 10 + len);
    if (id === 'TXXX') {
      const [k, v] = d.subarray(1).toString('utf16le').split('\u0000');
      out.TXXX[testo(Buffer.from(k, 'utf16le'))] = v.replace(/^﻿/, '');
    } else if (id === 'APIC') out.APIC = { mime: d.toString('latin1', 1, d.indexOf(0, 1)), dati: d.subarray(d.indexOf(0, 1) + 3) };
    else out[id] = id === 'COMM' ? d.toString('utf16le', 10) : testo(d.subarray(1));
    p += 10 + len;
  }
  out._fine = 10 + size;
  return out;
}

const audio = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(2000, 7)]);
const file = () => {
  // la libreria blocca le scritture fuori dalle cartelle del progetto
  const base = path.join(src, '..', 'state', 'tagtest');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'id3-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = path.join(dir, 't.mp3');
  fs.writeFileSync(f, audio);
  return f;
};
const meta = {
  titolo: 'Resonanza & Pietra', categoria: 'Yin-Savasana', tipo: 'ambient-pad', genere: 'Dark ambient dolce', numero_traccia: 161,
  bpm: 62, tonalita: 'Do minore', durata_s: 200, qualita: { durata_reale_s: 210 }, generato_il: '2026-11-27T09:01:03.634Z',
  descrizione: 'Musica per il raccoglimento', attivita: 'posizioni passive', struttura: 'piatto', energia: 1,
  strumenti: ['sub bass', 'drone scuro'], variante: 'profondo', seed: 606516731,
};
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

test('chiaveId3: tonalita italiane nel formato ID3', async () => {
  const { chiaveId3 } = await carica();
  assert.equal(chiaveId3('Do minore'), 'Cm');
  assert.equal(chiaveId3('Fa maggiore'), 'F');
  assert.equal(chiaveId3('Si bemolle maggiore'), 'Bb');
  assert.equal(chiaveId3('Fa# minore'), 'F#m');
  assert.equal(chiaveId3('modale libero'), '');
  assert.equal(chiaveId3(undefined), '');
});

test('tag completi, album leggibile, copertina JPEG e audio intatto', async () => {
  const lib = await carica();
  const f = file();
  const cop = { mime: 'image/jpeg', dati: jpeg, definitiva: true };
  lib.tagFile(f, meta, cop);
  const n = lib.tagFile(f, meta, cop); // ritaggare non accumula
  const buf = fs.readFileSync(f);
  const t = frames(buf);
  assert.equal(t.TALB, 'Yin & Savasana');
  assert.equal(t.TKEY, 'Cm');
  assert.equal(t.TLEN, '210000');
  assert.equal(t.TLAN, 'zxx');
  assert.equal(t.TDAT, '2711');
  assert.equal(t.TYER, '2026');
  assert.equal(t.TRCK, '161');
  for (const k of ['TIT2', 'TPE1', 'TPE2', 'TCON', 'TIT1', 'TIT3', 'TBPM', 'TCOM', 'TPUB', 'TCOP', 'TENC', 'COMM', 'APIC']) assert.ok(k in t, k);
  assert.equal(t.TIT2, 'Resonanza & Pietra');
  assert.equal(t.TCOP, '2026 Yoga Music Factory');
  assert.deepEqual(Object.keys(t.TXXX).sort(), ['ATTIVITA', 'ENERGIA', 'MOOD', 'SEED', 'STRUMENTI', 'STRUTTURA', 'VARIANTE']);
  assert.equal(t.TXXX.MOOD, 'Chill');
  assert.equal(t.TXXX.STRUMENTI, 'sub bass, drone scuro');
  assert.equal(t.APIC.mime, 'image/jpeg');
  assert.deepEqual(t.APIC.dati, jpeg);
  assert.deepEqual(buf.subarray(t._fine), audio);
  assert.equal(lib.fnvAudio(buf), lib.fnvAudio(audio));
  assert.ok(n >= 20);
});

test('brano vecchio con pochi dati: niente "undefined", niente frame vuoti', async () => {
  const lib = await carica();
  const f = file();
  lib.tagFile(f, { titolo: 'Antico', categoria: 'Genere-Nuovo' });
  const t = frames(fs.readFileSync(f));
  assert.equal(t.TALB, 'Genere Nuovo');
  for (const k of ['TBPM', 'TKEY', 'TLEN']) assert.ok(!(k in t), k);
  assert.ok(!('SEED' in t.TXXX));
  const tutto = JSON.stringify({ ...t, APIC: undefined });
  assert.ok(!/undefined|NaN/.test(tutto), tutto);
  assert.equal(t.APIC.mime, 'image/png');
});

test('copertina: JPEG dal gateway, ripiego se il gateway non risponde o non ha sfondi', async () => {
  const lib = await carica();
  let chiesto;
  lib.setGw(async (rotta, corpo) => { chiesto = { rotta, corpo }; return { status: 200, ok: true, jpeg: jpeg.toString('base64') }; });
  const ai = await lib.copertinaPer(meta);
  assert.deepEqual(chiesto, { rotta: '/copertina', corpo: { categoria: 'Yin-Savasana', titolo: meta.titolo, numero: 161 } });
  assert.deepEqual(ai, { mime: 'image/jpeg', dati: jpeg, definitiva: true });
  for (const gw of [async () => { throw new Error('spento'); }, async () => ({ status: 200, ok: false, error: 'nessuno sfondo' }), async () => ({ status: 500, ok: false })]) {
    lib.setGw(gw);
    const r = await lib.copertinaPer(meta);
    assert.equal(r.definitiva, false);
    assert.equal(r.mime, 'image/png');
    assert.equal(r.dati.readUInt32BE(0), 0x89504e47);
  }
});

test('scrittura interrotta: il file originale resta intatto', async () => {
  const lib = await carica();
  const f = file();
  const vera = fs.renameSync;
  fs.renameSync = () => { throw new Error('interrotto'); };
  try { assert.throws(() => lib.tagFile(f, meta), /interrotto/); } finally { fs.renameSync = vera; }
  assert.deepEqual(fs.readFileSync(f), audio);
});

test('audioIntegro: riconosce un file troncato rispetto all impronta salvata', async () => {
  const lib = await carica();
  const f = file();
  const impronta = lib.fnvAudio(audio);
  lib.tagFile(f, meta);
  assert.equal(lib.audioIntegro(fs.readFileSync(f), impronta), true);
  assert.equal(lib.audioIntegro(fs.readFileSync(f), impronta.split('-')[0] + '-999'), true, 'formato vecchio dell impronta');
  assert.equal(lib.audioIntegro(fs.readFileSync(f).subarray(0, 900), impronta), false);
  assert.equal(lib.audioIntegro(audio, undefined), true, 'senza impronta non si puo giudicare');
});
