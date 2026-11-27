// BLOCCO 5d - Componi score: il compositore scrive molti score per il brano in coda, il revisore tiene
// il migliore. Se qualcosa non va il brano resta senza score nostro e lo scrive il motore.
const inp = $input.first().json;
const state = inp.state;
const c = state.queue[state.queue.length - 1];
if (!c || c.abc !== undefined || c.vocale || c.attempts || CFG.comandi.pausa) return [{ json: inp }];

try {
  const cat = CFG.categories.find((x) => x.name === c.categoria);
  const seed = Math.floor(Math.random() * 2147483647);
  // la memoria del genere: stessa identita', temi sempre nuovi, pesi corretti dai voti
  const memoria = leggiMemoria();
  const g = gruppoMemoria(memoria, cat.name);
  const preferenze = Compositore.preferenze(g.brani, votiPerSeed(cat.name));
  g.identita = Compositore.identita(cat, g.identita, preferenze, seed);
  const r = Compositore.componi({ cat, bpm: c.bpm, tonalita: c.tonalita, durata_s: c.durata_s, sezioni: c.sezioni, seed, identita: g.identita, preferenze, precedenti: g.brani.map((b) => b.firma) });
  g.brani = [...g.brani, { seed, titolo: c.titolo, il: new Date().toISOString(), bpm: c.bpm, tonalita: c.tonalita, strumenti: c.strumenti, punteggio: r.punteggio, parametri: r.parametri, firma: r.firma }].slice(-200);
  salvaMemoria(memoria);
  Object.assign(c, { abc: r.abc, lyrics: r.lyrics, durata_s: r.durata_s, score: { punteggio: r.punteggio, dettagli: r.dettagli, seed, parametri: r.parametri } });
  log(`score composto per "${c.titolo}": punteggio ${r.punteggio}, novita' ${r.dettagli.novita}, brano ${g.brani.length} del genere, ${r.durata_s}s`);
} catch (e) {
  log(`composizione dello score non riuscita per "${c.titolo}": ${e.message} (lo scrivera' il motore)`);
}
return [{ json: inp }];
