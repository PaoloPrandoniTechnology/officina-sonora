// BLOCCO 5d - Componi score: il compositore scrive molti score per il brano in coda, il revisore tiene
// il migliore. Se qualcosa non va il brano resta senza score nostro e lo scrive il motore.
const inp = $input.first().json;
const state = inp.state;
const c = state.queue[state.queue.length - 1];
if (!c || c.abc !== undefined || c.vocale || c.attempts || CFG.comandi.pausa) return [{ json: inp }];

const cat = CFG.categories.find((x) => x.name === c.categoria);
const imp = ScoreAbc.risolvi(ScoreAbc.impostazioni(confScore(), c.categoria), cat);
if (imp.fonte === 'motore') return [{ json: inp }];

try {
  const seed = Math.floor(Math.random() * 2147483647);
  // la memoria del genere: stessa identita', temi sempre nuovi, pesi corretti dai voti
  const memoria = leggiMemoria();
  const g = gruppoMemoria(memoria, cat.name);
  const preferenze = Compositore.preferenze(g.brani, votiPerSeed(cat.name));
  const richiesta = { cat, bpm: c.bpm, tonalita: c.tonalita, durata_s: c.durata_s, seed, preferenze, precedenti: g.brani.map((b) => b.firma), candidati: imp.candidati, metri: imp.metri };
  let r;
  if (imp.livello) {
    // generi creativi: forma, assoli e richiami li decide il compositore estro, brano per brano
    r = Estro.componi({ ...richiesta, estro: imp.livello });
    // un brano rigenerato ha già i suoi suoni nello stile
    if (!c.tentativi_render) c.style = inserisciTocchi(c.style, r.tocchi, cat, readGuidance(), imp.livello);
    if (r.cameo) c.descrizione = `${String(c.descrizione || '').replace(/ Richiamo nascosto: .*$/, '')} Richiamo nascosto: ${r.cameo.nome}.`.trim();
    c.sezioni = r.lyrics.split('\n\n');
  } else {
    g.identita = Compositore.identita(cat, g.identita, preferenze, seed);
    r = Compositore.componi({ ...richiesta, sezioni: c.sezioni, identita: g.identita });
  }
  g.brani = [...g.brani, { seed, titolo: c.titolo, il: new Date().toISOString(), bpm: c.bpm, tonalita: c.tonalita, strumenti: c.strumenti, punteggio: r.punteggio, parametri: r.parametri, firma: r.firma }].slice(-200);
  salvaMemoria(memoria);
  Object.assign(c, { abc: r.abc, lyrics: r.lyrics, durata_s: r.durata_s, score: { punteggio: r.punteggio, dettagli: r.dettagli, seed, parametri: r.parametri } });
  const trovate = imp.livello ? `, forma ${r.parametri.forma}, ${r.trovate.join(' ')}${r.cameo ? ` (${r.cameo.nome})` : ''}` : '';
  log(`score composto per "${c.titolo}": punteggio ${r.punteggio}, novita' ${r.dettagli.novita}, brano ${g.brani.length} del genere, ${r.durata_s}s${trovate}`);
} catch (e) {
  log(`composizione dello score non riuscita per "${c.titolo}": ${e.message} (lo scrivera' il motore)`);
}
return [{ json: inp }];
