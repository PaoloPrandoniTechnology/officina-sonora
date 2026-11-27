// Test del riepilogo Telegram. Esecuzione: node --test tools/test/messaggi.test.js
// Non scrive mai sui file reali: il gateway viene provato solo con valori che deve rifiutare.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const M = new Function(fs.readFileSync(path.join(RADICE, 'src', 'lib-messaggi.js'), 'utf8')
  + '\nreturn { MESSAGGI_DEF, impostazioniMessaggi, inFascia, slotRiepilogo, testoRiepilogo, testoAvviso };')();
const controllo = require(path.join(RADICE, 'gateway', 'controllo.js'));

const alle = (h, m = 0) => new Date(2026, 10, 27, h, m);
const slot = (imp, h, m) => { const s = M.slotRiepilogo(imp, alle(h, m)); return s === null ? null : new Date(s).getHours() + ':' + new Date(s).getMinutes(); };

test('predefiniti: ogni ora dalle 8 alle 22, tutti i dati', () => {
  const i = M.impostazioniMessaggi(undefined);
  assert.deepEqual([i.frequenzaMin, i.inizio, i.fine], [60, 8, 22]);
  for (const [k, d] of Object.entries(M.MESSAGGI_DEF)) {
    assert.equal(i.tipi[k].attivo, true);
    assert.deepEqual(i.tipi[k].dati, Object.keys(d.dati));
  }
});

test('valori salvati non validi tornano ai predefiniti', () => {
  const i = M.impostazioniMessaggi({ frequenzaMin: 7, inizio: 23, fine: 5, tipi: { riepilogo: { attivo: false, dati: ['titoli', 'xx'] } } });
  assert.deepEqual([i.frequenzaMin, i.inizio, i.fine], [60, 8, 22]);
  assert.deepEqual(i.tipi.riepilogo, { attivo: false, dati: ['titoli'] });
});

test('fascia oraria: silenzio dalle 22 alle 8', () => {
  const i = M.impostazioniMessaggi({});
  assert.equal(M.inFascia(i, alle(7, 59)), false);
  assert.equal(M.inFascia(i, alle(8)), true);
  assert.equal(M.inFascia(i, alle(21, 59)), true);
  assert.equal(M.inFascia(i, alle(22)), false);
  assert.equal(slot(i, 7, 59), null);
  assert.equal(slot(i, 8, 0), '8:0');
  assert.equal(slot(i, 12, 40), '12:0');
  assert.equal(slot(i, 22, 0), '22:0');
  assert.equal(slot(i, 22, 20), null);
  assert.equal(slot(i, 3, 0), null);
});

test('lo stop e\' sempre un invio, anche se non allineato alla frequenza', () => {
  const i = M.impostazioniMessaggi({ frequenzaMin: 180 });
  assert.equal(slot(i, 21, 59), '20:0');
  assert.equal(slot(i, 22, 5), '22:0');
});

const brano = (n) => ({ titolo: 'Brano ' + n, genere: 'Meditazione', tipo: 'drone', struttura: 'onda', energia: 2, bpm: 60, tonalita: 'Re', durata_s: 200, render_s: 90, ibroadcast: { track_id: 1000 + n } });

test('riepilogo: solo i dati scelti', () => {
  const t = M.testoRiepilogo([brano(1)], ['titoli', 'durata'], 12);
  assert.match(t, /Brano 1/);
  assert.match(t, /3:20/);
  assert.doesNotMatch(t, /Meditazione|1001|12/);
  const solo = M.testoRiepilogo([brano(1), brano(2)], ['conteggio', 'totale'], 12);
  assert.match(solo, /2/);
  assert.match(solo, /12/);
  assert.doesNotMatch(solo, /Brano 1/);
});

test('riepilogo lungo: un solo messaggio con il conto dei brani omessi', () => {
  const tanti = Array.from({ length: 200 }, (_, n) => brano(n));
  const t = M.testoRiepilogo(tanti, Object.keys(M.MESSAGGI_DEF.riepilogo.dati), 200);
  assert.ok(t.length <= 3900);
  assert.match(t, /e altri \d+ brani/);
  assert.match(t, /Brani prodotti finora: 200/);
});

test('avviso: solo i dati scelti', () => {
  const info = { n: 4, ultimo: alle(3, 5).getTime() };
  assert.match(M.testoAvviso('disco pieno', info, ['testo']), /disco pieno/);
  assert.doesNotMatch(M.testoAvviso('disco pieno', info, ['testo']), /4/);
  assert.match(M.testoAvviso('disco pieno', info, ['ripetizioni', 'ora']), /4 volte[\s\S]*03:05/);
});

test('gateway: impostazioni non valide rifiutate', async () => {
  const base = M.impostazioniMessaggi({});
  const prova = async (patch) => (await controllo.gestisci('/api/controllo/messaggi', { ...base, ...patch })).codice;
  assert.equal(await prova({ frequenzaMin: 7 }), 400);
  assert.equal(await prova({ inizio: 22, fine: 8 }), 400);
  assert.equal(await prova({ fine: 25 }), 400);
  assert.equal(await prova({ inizio: '8' }), 400);
  assert.equal(await prova({ tipi: { ...base.tipi, riepilogo: { attivo: true, dati: [] } } }), 400);
  assert.equal(await prova({ tipi: { ...base.tipi, riepilogo: { attivo: true, dati: ['xx'] } } }), 400);
  assert.equal((await controllo.gestisci('/api/controllo/messaggi', {})).codice, 400);
});

test('gateway: la lettura espone le impostazioni dei messaggi', () => {
  const m = controllo.lettura().messaggi;
  assert.ok(m.definizioni.riepilogo && m.frequenze.includes(60) && m.impostazioni.tipi.avvisi);
});
