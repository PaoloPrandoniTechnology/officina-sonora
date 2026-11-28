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
  const prova = async (corpo) => (await controllo.gestisci('/api/controllo/guida', { campo: 'blocchi', ambito: 'Meditazione', aggiunti: [], esclusi: [], ...corpo })).codice;
  for (const corpo of [{ ambito: 'Inventato' }, { aggiunti: ['<script>x</script>'] }, { aggiunti: ['female vocals'] }, { ambito: 'generale', aggiunti: ['choir'] },
    { aggiunti: ['no drums'] }, { aggiunti: ['warm', 'Warm'] }, { aggiunti: ['warm'], esclusi: ['warm'] }, { esclusi: ['no vocals'] }, { aggiunti: 'warm' },
    { aggiunti: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'] }]) assert.equal(await prova(corpo), 400, JSON.stringify(corpo));
  assert.equal((await controllo.gestisci('/api/controllo/percorso-inesistente', {})).codice, 404);
});

test('controllo: le note per genere vengono validate', async () => {
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Genere inventato', testo: 'piu assoli' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Meditazione', testo: 'ab' })).codice, 400);
  assert.equal((await controllo.gestisci('/api/controllo/nota', { nome: 'Meditazione', testo: '<b>x</b>' })).codice, 400);
});

test('controllo: le linee guida arrivano alla pagina con le note in elenco e le parole per genere', () => {
  const g = controllo.lettura().guida;
  assert.ok(Array.isArray(g.note), 'la pagina scorre le note come elenco, anche se il file le ha come testo');
  assert.equal(typeof g.stile_generi, 'object');
});

test('controllo: anteprima dello stile di un genere', () => {
  const s = controllo.stile('Blues-shuffle-strumentale', 1);
  assert.equal(s.varianti.length > 1, true);
  assert.equal(s.variante, s.varianti[1]);
  assert.equal(s.blocchi[0].testo, 'Instrumental');
  assert.ok(s.blocchi.length > s.conteggio, 'la pagina mostra anche strumenti e influenze non usati nell\'esempio');
  assert.match(s.esempio, /^Instrumental, .*BPM.*no vocals$/);
  assert.throws(() => controllo.stile('Inventato'), /sconosciuto/);
});

test('controllo: fasce e strutture di ogni genere, con i rifiuti', async () => {
  const d = controllo.lettura();
  for (const g of d.generi) assert.ok(g.bpm.length === 2 && g.strutture.length, g.nome);
  assert.equal(typeof d.guida.durata_hint, 'object');
  assert.equal(typeof d.guida.struttura_pref, 'object');
  for (const corpo of [{ campo: 'durata_hint', categoria: 'Meditazione', valore: '30-900' }, { campo: 'durata_hint', categoria: 'Inventato', valore: '' },
    { campo: 'bpm_range', categoria: 'Meditazione', valore: 'veloce' }, { campo: 'struttura_pref', categoria: 'Meditazione', valori: ['loop'] },
    { campo: 'struttura_pref', categoria: 'Meditazione', valori: 'onda' }]) {
    assert.equal((await controllo.gestisci('/api/controllo/guida', corpo)).codice, 400, JSON.stringify(corpo));
  }
  assert.ok(controllo.stile('Blues-shuffle-strumentale').blocchi.every((b) => b.argomento));
});
