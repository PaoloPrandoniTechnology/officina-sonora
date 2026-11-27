// Test del modulo di stato della dashboard (sola lettura). Esecuzione: node --test tools/test/stato.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leggiStato } = require(path.join(__dirname, '..', '..', 'gateway', 'stato.js'));

test('stato: contiene tutte le sezioni della dashboard', async () => {
  const s = await leggiStato();
  for (const k of ['ora', 'servizi', 'pipeline', 'watchdog', 'supervisore', 'sistema', 'esecuzioni', 'logProduzione']) {
    assert.ok(k in s, `manca la sezione ${k}`);
  }
  for (const k of ['n8n', 'motoreYue', 'lmStudio', 'gemmaCaricato']) {
    assert.equal(typeof s.servizi[k], 'boolean', `servizi.${k} deve essere booleano`);
  }
  assert.ok(Array.isArray(s.logProduzione));
});

test('stato: non espone token o segreti', async () => {
  const testo = JSON.stringify(await leggiStato());
  assert.doesNotMatch(testo, /refresh|bot[0-9]{6,}|access_token|client_secret/i);
});
