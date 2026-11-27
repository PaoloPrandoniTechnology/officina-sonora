// Test della plancia di controllo. Esecuzione: node --test tools/test/controllo.test.js
// Non scrive mai sui file reali: i test verificano letture e rifiuti di valori non validi.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const controllo = require(path.join(__dirname, '..', '..', 'gateway', 'controllo.js'));

test('controllo: la lettura contiene parametri, generi, guida e storico', () => {
  const d = controllo.lettura();
  assert.ok(Array.isArray(d.parametri) && d.parametri.length >= 10);
  assert.ok(Array.isArray(d.generi) && d.generi.length === 39);
  assert.ok(Array.isArray(d.storico));
  for (const p of d.parametri) {
    assert.ok(p.valore >= p.min && p.valore <= p.max, `${p.chiave} fuori dai limiti`);
  }
});

test('controllo: parametri fuori scala vengono rifiutati', async () => {
  assert.equal((await controllo.gestisci('/api/controllo/parametro', { chiave: 'durMin', valore: 9999 })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/parametro', { chiave: 'nonEsiste', valore: 1 })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/parametro', { chiave: 'durMin', valore: 'abc' })).codice, 400);
});

test('controllo: generi sconosciuti e pesi fuori scala vengono rifiutati', async () => {
  assert.equal((await controllo.gestisci('/api/controllo/genere', { nome: 'Genere inventato', peso: 1 })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/genere', { nome: 'Meditazione', peso: 9 })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/genere', { nome: 'Meditazione', attivo: 'si' })).codice, 400);
});

test('controllo: comandi e linee guida non validi vengono rifiutati', async () => {
  assert.equal((await controllo.gestisci('/api/controllo/comando', { azione: 'cancella_tutto' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/comando', { azione: 'produci', genere: 'Inventato' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/guida', { campo: 'bpm_range', categoria: 'Meditazione', valore: '90-40' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/guida', { campo: 'style_extra', valori: ['<script>x</script>'] })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/percorso-inesistente', {})).codice, 404);
});

test('controllo: le note per genere vengono validate', async () => {
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Genere inventato', testo: 'piu assoli' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Meditazione', testo: 'ab' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Meditazione', testo: '<b>x</b>' })).codice, 400);
});
