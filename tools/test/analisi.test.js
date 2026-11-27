// Test del modulo di analisi per la dashboard (sola lettura). Esecuzione: node --test tools/test/analisi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { datiAnalisi } = require(path.join(__dirname, '..', '..', 'gateway', 'analisi.js'));

test('analisi: forma dei dati e coerenza dei totali', () => {
  const d = datiAnalisi();
  for (const k of ['libreria', 'generi', 'tipi', 'voti', 'qualita', 'render', 'errori', 'guida']) {
    assert.ok(k in d, `manca la sezione ${k}`);
  }
  const sommaFamiglie = Object.values(d.libreria.perFamiglia).reduce((a, b) => a + b, 0);
  assert.equal(sommaFamiglie, d.libreria.totale, 'la somma per famiglia deve coincidere con il totale');
  const sommaGeneri = d.generi.reduce((a, g) => a + g.brani, 0);
  assert.ok(sommaGeneri <= d.libreria.totale, 'i brani per genere non possono superare il totale');
  assert.equal(d.libreria.timeline.length, 14, 'la timeline copre 14 giorni');
});

test('analisi: ogni punto della timeline ha ore e voti numerici', () => {
  for (const p of datiAnalisi().libreria.timeline) {
    assert.ok(Number.isFinite(p.ore) && p.ore >= 0, `${p.giorno}: ore`);
    assert.ok(Number.isInteger(p.voti) && p.voti >= 0, `${p.giorno}: voti`);
  }
});

test('analisi: ogni genere ha le specifiche per la scheda', () => {
  const d = datiAnalisi();
  assert.equal(d.generi.length, 39, 'il catalogo ha 39 generi');
  for (const g of d.generi) {
    assert.ok(g.nome, 'nome mancante');
    assert.ok(Array.isArray(g.bpm) && g.bpm.length === 2, `${g.nome}: bpm`);
    assert.ok(g.energia >= 1 && g.energia <= 5, `${g.nome}: energia`);
    assert.ok(Array.isArray(g.strumenti), `${g.nome}: strumenti`);
  }
});

test('analisi: i voti sono nella scala 1-5', () => {
  const d = datiAnalisi();
  for (const k of Object.keys(d.voti.distribuzione)) {
    assert.ok(Number(k) >= 1 && Number(k) <= 5);
  }
  const somma = Object.values(d.voti.distribuzione).reduce((a, b) => a + b, 0);
  assert.equal(somma, d.voti.totale);
});

test('analisi: nessun dato sensibile', () => {
  const testo = JSON.stringify(datiAnalisi());
  assert.doesNotMatch(testo, /refresh_token|access_token|client_secret|chat_id/i);
});
