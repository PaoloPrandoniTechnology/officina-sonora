// Test dei voti: l'unica fonte e' il .json del brano. Solo funzioni pure, nessuna scrittura.
//   node --test tools/test/voti.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');
const codice = ['lib.js', 'lib-apprendimento.js']
  .map((f) => fs.readFileSync(path.join(RADICE, 'src', f), 'utf8'))
  .join('\n');
const ctx = vm.createContext({ require, console, process, Buffer, setTimeout, clearTimeout, URL, Promise });
vm.runInContext(codice, ctx);
const L = vm.runInContext('({ votoUtente, applicaSegnale, firmaVoti })', ctx);

test('omonimi: il voto resta su un solo brano', () => {
  const a = { audio: 'eco', meta: { voto: 5 } };
  const b = { audio: 'eco', meta: { voto: null } };
  assert.equal(L.votoUtente(a), 5);
  assert.equal(L.votoUtente(b), null);
});

test('vince l\'ultimo', () => {
  const meta = { voto: null };
  const segnale = (voto) => ({ voto, fonte: 'valutazione iBroadcast' });
  assert.equal(L.applicaSegnale(meta, segnale(4), 't1'), true);
  assert.deepEqual(meta, { voto: 4, voto_ib: 4, voto_fonte: 'valutazione iBroadcast', voto_il: 't1' });

  meta.voto = 2;
  meta.voto_fonte = 'dashboard';
  assert.equal(L.applicaSegnale(meta, segnale(4), 't2'), false);
  assert.equal(meta.voto, 2);

  assert.equal(L.applicaSegnale(meta, segnale(5), 't3'), true);
  assert.equal(meta.voto, 5);

  assert.equal(L.applicaSegnale(meta, null, 't4'), false);
  assert.equal(meta.voto, 5);
  assert.equal(meta.voto_ib, null);

  assert.equal(L.applicaSegnale(meta, segnale(5), 't5'), false);
  assert.equal(meta.voto_ib, 5);
  assert.equal(meta.voto_il, 't3');
});

test('firma: cambia correggendo un voto', () => {
  const tracce = [
    { meta: { voto: 4, voto_il: '2026-11-01T10:00:00.000Z' } },
    { meta: { voto: 3 } },
    { meta: { voto: null } },
  ];
  assert.equal(L.firmaVoti(tracce), '2|2026-11-01T10:00:00.000Z');
  tracce[1].meta = { voto: 1, voto_il: '2026-11-02T10:00:00.000Z' };
  assert.equal(L.firmaVoti(tracce), '2|2026-11-02T10:00:00.000Z');
  assert.equal(L.firmaVoti([]), '0|');
});
