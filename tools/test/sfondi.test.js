// Test del generatore di sfondi (senza WebUI). Esecuzione: node --test tools/test/sfondi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mancanti, conPausa, emergenza } = require(path.join(__dirname, '..', 'genera-sfondi.js'));

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

test('chiusura della finestra: la pausa torna com era anche senza attendere il lavoro', async () => {
  const f = path.join(tmp(), 'comandi.json');
  fs.writeFileSync(f, JSON.stringify({ svuotaCoda: true }));
  await conPausa(async () => {
    emergenza();
    assert.deepEqual(leggi(f), { svuotaCoda: true });
  }, f);
  assert.deepEqual(leggi(f), { svuotaCoda: true });
});

const { somiglianza, scenaPer, applica } = require(path.join(__dirname, '..', 'genera-sfondi.js'));

test('somiglianza: 1 per la stessa scena, 0 per scene senza parole in comune', () => {
  assert.equal(somiglianza('bronze bowl on stone', 'Bronze bowl on stone.'), 1);
  assert.equal(somiglianza('bronze bowl on stone', 'neon highway under rain'), 0);
});

test('scenaPer: scarta una scena già usata e chiede di nuovo; dopo tre ripetizioni rinuncia', async () => {
  const usata = 'single bronze singing bowl resting on a flat stone beside a misty lake';
  const nuova = 'paper lanterns drifting over a dark river between tall reeds at night';
  const registro = { 1: { categoria: 'Meditazione', scena: usata } };
  const risposte = [usata, nuova];
  const richieste = [];
  const r = await scenaPer({ titolo: 'Fiume', categoria: 'Meditazione' }, registro, async (x) => { richieste.push(x); return { scena: risposte.shift() }; });
  assert.equal(r.scena, nuova);
  assert.equal(richieste.length, 2);
  assert.ok(richieste[0].user.includes(usata) && richieste[0].user.includes('Fiume'));
  await assert.rejects(() => scenaPer({ titolo: 'x' }, registro, async () => ({ scena: usata })), /ripete/);
  await assert.rejects(() => scenaPer({ titolo: 'x' }, {}, async () => ({})), /non risponde/);
});

test('applica: scrive la copertina nell MP3 solo dei brani finiti e annota la scheda', async () => {
  const d = tmp();
  const scheda = path.join(d, 'b.json');
  const mp3 = path.join(d, 'b.mp3');
  const tag = Buffer.concat([Buffer.from('TIT2'), Buffer.from([0, 0, 0, 3, 0, 0, 0]), Buffer.from('ab')]);
  const audio = Buffer.from([0xff, 0xfb, 1, 2, 3]);
  fs.writeFileSync(mp3, Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, tag.length]), tag, audio]));
  const meta = { titolo: 'B', categoria: 'Meditazione', numero_traccia: 5 };
  fs.writeFileSync(scheda, JSON.stringify(meta));
  const componiFn = async () => ({ jpeg: Buffer.from([0xff, 0xd8, 9]) });
  assert.equal(await applica({ file: scheda, meta }, d, componiFn), false, 'brano ancora in lavorazione');
  fs.writeFileSync(scheda, JSON.stringify({ ...meta, voto: 4 }));
  assert.equal(await applica({ file: scheda, meta: { ...meta, ibroadcast: {}, id3_frames: 1 } }, d, componiFn), true);
  assert.equal(leggi(scheda).voto, 4, 'il voto arrivato nel frattempo resta');
  assert.ok(leggi(scheda).copertina_propria);
  assert.equal(leggi(scheda).copertina_online, false, 'da portare su iBroadcast');
  const dopo = fs.readFileSync(mp3);
  assert.ok(dopo.includes(Buffer.from('TIT2')) && dopo.includes(Buffer.from('APIC')));
  assert.deepEqual(dopo.subarray(-audio.length), audio);
  assert.deepEqual(require(path.join(__dirname, '..', '..', 'gateway', 'id3.js')).copertinaDi(mp3).dati, Buffer.from([0xff, 0xd8, 9]));
  // stessa immagine già nel file: online non cambia nulla
  fs.writeFileSync(scheda, JSON.stringify(meta));
  assert.equal(await applica({ file: scheda, meta: { ...meta, ibroadcast: {}, id3_frames: 1 } }, d, componiFn), true);
  assert.equal(leggi(scheda).copertina_online, undefined);
});
