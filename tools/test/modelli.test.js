// Ricostruzione del modello dei brani già fatti, dal log di produzione
const test = require('node:test');
const assert = require('node:assert/strict');
const { scrittori, modelloDi } = require('../modelli-brani');

test('modello ricostruito: servizio in rete solo se scritto subito prima del concept, altrimenti gemma', () => {
  const log = [
    '2026-11-28T10:00:00.000Z testo scritto da gemini-lite',
    '2026-11-28T10:00:00.040Z concept pronto: "Alba "chiara"" (Bossa, variante base)',
    '2026-11-28T11:00:00.000Z testo scritto da groq',
    '2026-11-28T11:05:00.000Z concept pronto: "Sera" (Jazz, variante base)',
  ].join('\r\n');
  const daRete = scrittori(log);
  const di = (titolo, generato_il) => modelloDi({ titolo, generato_il }, daRete, { 'gemini-lite': 'gemini-3.5-flash-lite' });
  assert.deepEqual(di('Alba "chiara"', '2026-11-28T10:09:00.000Z'), { servizio: 'gemini-lite', modello: 'gemini-3.5-flash-lite', ricostruito: true });
  assert.equal(di('Sera', '2026-11-28T11:20:00.000Z').servizio, 'locale', 'una riga di testo di un altro blocco non conta');
  assert.equal(di('Alba "chiara"', '2026-11-27T10:09:00.000Z').servizio, 'locale', 'stesso titolo, brano precedente');
});
