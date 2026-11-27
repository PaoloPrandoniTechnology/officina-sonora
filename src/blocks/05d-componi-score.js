// BLOCCO 5d - Componi score: il compositore scrive molti score per il brano in coda, il revisore tiene
// il migliore. Se qualcosa non va il brano resta senza score nostro e lo scrive il motore.
const inp = $input.first().json;
const state = inp.state;
const c = state.queue[state.queue.length - 1];
if (!c || c.abc !== undefined || c.vocale || c.attempts || CFG.comandi.pausa) return [{ json: inp }];

try {
  const cat = CFG.categories.find((x) => x.name === c.categoria);
  const seed = Math.floor(Math.random() * 2147483647);
  const r = Compositore.componi({ cat, bpm: c.bpm, tonalita: c.tonalita, durata_s: c.durata_s, sezioni: c.sezioni, seed });
  Object.assign(c, { abc: r.abc, lyrics: r.lyrics, durata_s: r.durata_s, score: { punteggio: r.punteggio, dettagli: r.dettagli, seed } });
  log(`score composto per "${c.titolo}": punteggio ${r.punteggio}, ${r.score.sezioni.length} sezioni, ${r.durata_s}s`);
} catch (e) {
  log(`composizione dello score non riuscita per "${c.titolo}": ${e.message} (lo scrivera' il motore)`);
}
return [{ json: inp }];
