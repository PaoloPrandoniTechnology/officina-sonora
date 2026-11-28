// Score nel gateway: bozze, richieste di produzione, impostazioni. Cartella di prova, nessun file reale.
//   node --test tools/test/score-gateway.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const A = require(path.join(RADICE, 'src', 'compositore', 'abc.js'));
const C = require(path.join(RADICE, 'src', 'compositore', 'compositore.js'));
const catalogo = JSON.parse(fs.readFileSync(path.join(RADICE, 'config', 'catalogo.json'), 'utf8')).categories;
const composto = C.componi({ cat: catalogo.find((c) => c.name === 'Surf-rock-strumentale'), bpm: 120, tonalita: 'Mi minore', durata_s: 200, sezioni: ['[intro]', '[verse]', '[chorus]', '[outro]'], seed: 7 });

test('gateway: bozze, richieste e impostazioni; i dati sbagliati si rifiutano', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'score-'));
  fs.mkdirSync(path.join(base, 'config'));
  fs.copyFileSync(path.join(RADICE, 'config', 'catalogo.json'), path.join(base, 'config', 'catalogo.json'));
  const S = require(path.join(RADICE, 'gateway', 'score.js'));
  fs.mkdirSync(path.join(base, 'state'));
  const g = (azione, r) => S.gestisci(azione, r, base);
  try {
    const { id } = g('salva', { nome: 'a', abc: composto.abc });
    assert.equal(g('salva', { id, nome: 'b', abc: 'bozza incompleta' }).id, id);
    assert.equal(S.lettura(base).bozze[0].nome, 'b');
    g('elimina', { id });
    assert.throws(() => g('produci', { categoria: 'Surf-rock-strumentale', abc: 'rotto' }), /non valido/);
    assert.throws(() => g('produci', { categoria: 'Inventato', abc: composto.abc }), /sconosciuto/);
    const primo = g('produci', { categoria: 'Surf-rock-strumentale', titolo: 'T', abc: composto.abc });
    const secondo = g('produci', { categoria: 'Surf-rock-strumentale', titolo: 'T', abc: composto.abc });
    assert.deepEqual(S.lettura(base).richieste.map((r) => r.id), [secondo.id]);
    assert.throws(() => g('annulla', { id: primo.id }), /non trovata/);
    g('annulla', { id: secondo.id });
    g('impostazioni', { ambito: 'generale', valori: { tentativi: 2 } });
    g('impostazioni', { ambito: 'Meditazione', valori: { fonte: 'compositore' } });
    g('impostazioni', { ambito: 'Meditazione', valori: { fonte: null } });
    assert.deepEqual(S.lettura(base).impostazioni, { generale: { tentativi: 2 }, generi: {} });
    assert.throws(() => g('impostazioni', { ambito: 'generale', valori: { tentativi: 99 } }), /non ammesso/);
    assert.ok(A.analizza(g('componi', { categoria: 'Meditazione', bpm: 55, durata_s: 150 }).abc).score);
    assert.throws(() => g('componi', { categoria: 'Meditazione', bpm: 5, durata_s: 150 }), /velocità/);
    fs.writeFileSync(path.join(base, 'state', 'score.json'), '{ rotto');
    assert.throws(() => g('salva', { abc: composto.abc }), /illeggibile/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
