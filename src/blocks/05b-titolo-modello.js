// BLOCCO 5b - Titolo e descrizione: chiede al modello di testo titolo, descrizione e durata.
// Il modello non sceglie lo stile: quello viene composto nel blocco 5c.
const inp = $input.first().json;
if (inp.skip) return [{ json: inp }];

const cat = inp.cat;
const [lo, hi] = cat.bpm;
const system = 'Sei un compositore di musica di sottofondo. Rispondi solo con JSON valido.';
// le prime parole dei titoli recenti: senza questo elenco il modello ripete sempre le stesse ("Eco di...")
const usate = [...new Set((inp.state.recent || []).map((r) => String(r.titolo).split(/[\s'’]+/)[0]).filter((p) => p.length > 2))];
const user = `Proponi titolo e descrizione per un brano STRUMENTALE (nessuna voce) di genere "${cat.genere || cat.name}".
Attivita': ${cat.attivita}. Atmosfera del genere: ${cat.stile}.
Variante: ${inp.variante ? inp.variante.nome : 'base'}.
Rispondi SOLO con un oggetto JSON con questi campi:
- "titolo": titolo breve in italiano, originale e diverso dai titoli comuni, coerente con il genere
- "descrizione": una frase in italiano che spiega a quale attivita' serve
- "bpm": intero tra ${lo} e ${hi}
- "durata_s": intero in secondi tra ${inp.dmin} e ${inp.dmax}
Niente nomi di artisti, marchi o citazioni.${usate.length ? `
Non iniziare il titolo con: ${usate.join(', ')}.` : ''}`;

try {
  const c = await llmJson(system, user, 800);
  return [{ json: { ...inp, c, modello_testo: llmJson.ultimo } }];
} catch (e) {
  // Il modello non e' caricato (il watchdog lo carica nel prossimo minuto): non e' un errore da segnalare
  if (/HTTP 400/.test(e.message)) log('in attesa del modello di testo: riprovo al prossimo giro');
  else log(`generazione concept non riuscita: ${e.message}`);
  return [{ json: { ...inp, skip: true, error: e.message } }];
}
