// Test delle copertine. Esecuzione: node --test tools/test/copertina.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const base = path.join(__dirname, '..', '..');
const { stileCopertina, svgCopertina, componi } = require(path.join(base, 'gateway', 'copertina.js'));
const cat = require(path.join(base, 'config', 'catalogo.json')).categories;
const FFMPEG = 'E:/MusicAI/ffmpeg/bin/ffmpeg.exe';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cop-'));
const png = () => {
  const f = path.join(tmp(), 's.png');
  execFileSync(FFMPEG, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=teal:s=8x8', '-frames:v', '1', f]);
  return fs.readFileSync(f);
};
const misureJpeg = (b) => {
  for (let i = 2; i < b.length;) {
    if (b[i + 1] === 0xc0 || b[i + 1] === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
};

test('stile: i generi del catalogo hanno etichetta unica, prompt e font', () => {
  for (const c of cat) {
    assert.ok(c.copertina && c.copertina.etichetta && c.copertina.prompt, c.name);
    assert.match(c.copertina.font, /^(Georgia|Impact|Bahnschrift|Segoe UI)$/, c.name);
  }
  assert.equal(new Set(cat.map((c) => c.copertina.etichetta)).size, cat.length);
});

test('stile: un genere senza descrizione usa il ripiego', () => {
  const s = stileCopertina('Genere-Nuovo');
  assert.equal(s.etichetta, 'Genere Nuovo');
  assert.equal(s.font, 'Georgia');
  assert.equal(s.colore, '#ffffff');
  assert.ok(s.prompt);
});

test('svg: caratteri speciali e parole lunghissime restano nel riquadro', () => {
  const titolo = 'A & B <C> "D" ' + 'Supercalifragilistichespiralidoso'.repeat(2);
  const svg = svgCopertina({ titolo, stile: stileCopertina('Meditazione'), sfondo: png() });
  assert.ok(svg.includes('A &amp; B &lt;C&gt;'));
  const righe = [...svg.matchAll(/font-size="(\d+)" fill="#fff">([^<]*)</g)];
  assert.ok(righe.length >= 1 && righe.length <= 4);
  for (const [, size, testo] of righe) assert.ok(testo.replace(/&\w+;/g, 'x').length * size * 0.6 <= 880, testo);
});

test('componi: null senza sfondi, JPEG 1000x1000 con rotazione per numero', async () => {
  const dati = { categoria: 'Meditazione', titolo: 'Prova di copertina', numero: 9 };
  assert.equal(await componi(dati, tmp()), null);
  const cartella = tmp();
  const dir = path.join(cartella, 'Meditazione');
  fs.mkdirSync(dir);
  const b = png();
  for (const n of ['01.jpg', '02.jpg', '_foglio.jpg']) fs.writeFileSync(path.join(dir, n), b);
  const r = await componi(dati, cartella);
  assert.equal(r.sfondo, '02.jpg');
  assert.equal(r.jpeg.readUInt16BE(0), 0xffd8);
  assert.deepEqual(misureJpeg(r.jpeg), [1000, 1000]);
});

test('componi: una categoria con percorso malevolo viene rifiutata', async () => {
  await assert.rejects(() => componi({ categoria: '../../secrets', titolo: 'x', numero: 1 }, tmp()), /categoria/);
});
