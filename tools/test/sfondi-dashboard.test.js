// Test del comando "genera sfondi" della dashboard: cartella temporanea, nessun processo vero.
// Esecuzione: node --test tools/test/sfondi-dashboard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sfondi = require(path.join(__dirname, '..', '..', 'gateway', 'sfondi.js'));

function base() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sfd-'));
  for (const c of ['config', 'state', path.join('assets', 'sfondi', 'A')]) fs.mkdirSync(path.join(d, c), { recursive: true });
  fs.writeFileSync(path.join(d, 'config', 'catalogo.json'), JSON.stringify({ categories: [{ name: 'A' }, { name: 'B' }] }));
  for (const n of ['01.jpg', '02.jpg', '_foglio.jpg']) fs.writeFileSync(path.join(d, 'assets', 'sfondi', 'A', n), 'x');
  return d;
}
const finto = (pid) => { const visto = {}; return { visto, spawn: (cmd, args, opz) => { Object.assign(visto, { cmd, args, opz }); return { pid, unref() {} }; } }; };

test('stato: conteggio degli sfondi, fermo, ultima riga del registro', () => {
  const d = base();
  const vuota = path.join(d, 'libreria');
  assert.deepEqual(sfondi.stato(d, vuota), { fatti: 2, totale: 16, brani: 0, conCopertina: 0, daFare: 0, inCorso: false, inChiusura: false, ultima: '' });
  fs.writeFileSync(path.join(d, 'state', 'sfondi.log'), 'prima\n3/14 A/05.jpg (40 s)\n\n');
  assert.equal(sfondi.stato(d).ultima, '3/14 A/05.jpg (40 s)');
});

test('avvia: un solo generatore alla volta, senza i segreti del gateway', () => {
  const d = base();
  fs.writeFileSync(path.join(d, 'state', 'sfondi.stop'), '');
  process.env.TELEGRAM_BOT_TOKEN = 'segreto';
  process.env.IBROADCAST_REFRESH = 'segreto';
  const f = finto(process.pid); // un pid sicuramente vivo
  sfondi.avvia(d, f.spawn);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.IBROADCAST_REFRESH;
  assert.ok(f.visto.args[0].endsWith(path.join('tools', 'genera-sfondi.js')));
  assert.ok(!JSON.stringify(f.visto.opz.env).includes('segreto'));
  assert.ok(!fs.existsSync(path.join(d, 'state', 'sfondi.stop')), 'una vecchia richiesta di stop non vale');
  assert.equal(sfondi.stato(d).inCorso, true);
  assert.throws(() => sfondi.avvia(d, f.spawn), /in corso/);
});

test('ferma: lascia la richiesta di stop; senza generatore in corso rifiuta', () => {
  const d = base();
  assert.throws(() => sfondi.ferma(d), /nessuna generazione/);
  sfondi.avvia(d, finto(process.pid).spawn);
  sfondi.ferma(d);
  assert.ok(fs.existsSync(path.join(d, 'state', 'sfondi.stop')));
  assert.equal(sfondi.stato(d).inChiusura, true);
});

test('un generatore morto non blocca il successivo', () => {
  const d = base();
  fs.writeFileSync(path.join(d, 'state', 'sfondi.pid'), '999999999');
  assert.equal(sfondi.stato(d).inCorso, false);
  sfondi.avvia(d, finto(process.pid).spawn);
});

test('il comando della dashboard rifiuta azioni sugli sfondi non previste', async () => {
  const controllo = require(path.join(__dirname, '..', '..', 'gateway', 'controllo.js'));
  const r = await controllo.gestisci('/api/controllo/comando', { azione: 'sfondi_cancella' });
  assert.equal(r.codice, 400);
  assert.equal(typeof controllo.lettura().sfondi.totale, 'number');
});

test('daFare: prima la coda, poi i brani senza copertina propria dal più recente', () => {
  const d = base();
  const lib = path.join(d, 'libreria');
  fs.mkdirSync(path.join(d, 'assets', 'copertine'));
  fs.mkdirSync(lib);
  const brano = (n, extra) => {
    fs.writeFileSync(path.join(lib, n + '.json'), JSON.stringify({ titolo: 'T' + n, categoria: 'A', numero_traccia: n, ...extra }));
    fs.writeFileSync(path.join(lib, n + '.mp3'), 'x');
  };
  brano(1, {});
  brano(2, { copertina_propria: 'ieri' });
  brano(3, { ibroadcast: {}, id3_frames: 1 });
  brano(4, {}); // in lavorazione, immagine già pronta
  fs.writeFileSync(path.join(d, 'assets', 'copertine', '4.jpg'), 'x');
  fs.writeFileSync(path.join(d, 'state', 'state.json'), JSON.stringify({ queue: [{ titolo: 'In coda', categoria: 'A' }] }));
  const r = sfondi.daFare(d, lib);
  assert.deepEqual(r.lavori.map((x) => x.meta.titolo), ['In coda', 'T3', 'T1']);
  assert.match(r.lavori[0].chiave, /^c-[0-9a-f]{16}$/);
  assert.deepEqual([r.brani, r.conCopertina], [4, 2]);
});
