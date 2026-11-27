// BLOCCO 5c - Componi concept: unisce scelta e titolo, compone lo stile dal genere e accoda il brano.
const inp = $input.first().json;
const state = inp.state;
if (inp.skip || !inp.c) return [{ json: { state, error: inp.error } }];

const { c, cat, slot, variante, strumenti, influenza, tonalita, guidance } = inp;
const bpm = Math.min(cat.bpm[1], Math.max(cat.bpm[0], Math.round(Number(c.bpm)) || Math.round((cat.bpm[0] + cat.bpm[1]) / 2)));
if (!c.titolo) {
  log(`concept non valido (titolo mancante): ${JSON.stringify(c).slice(0, 200)}`);
  return [{ json: { state, error: 'concept non valido' } }];
}
const durata = Math.min(inp.dmax, Math.max(inp.dmin, clampDur(c.durata_s)));

const concept = {
  titolo: String(c.titolo).trim(),
  descrizione: String(c.descrizione || '').trim(),
  bpm,
  tonalita,
  durata_s: durata,
  energia: cat.energia,
  attivita: cat.attivita,
  struttura: slot.struttura,
  genere: cat.genere || cat.name,
  variante: variante ? variante.nome : '',
  strumenti,
  influenza: influenza || '',
  style: componiStile(cat, variante, strumenti, influenza, guidance),
  avoid: divietiDi(cat, guidance),
  sezioni: slot.sezioni,
  lyrics: slot.sezioni.join('\n\n'),
  categoria: cat.name,
  tipo: slot.tipo,
  guida_versione: guidance.versione,
  ricetta: slot.ricetta,
  esperimento: slot.esperimento,
  punteggio: slot.punteggio,
  vocale: !!cat.vocale_senza_parole,
  attempts: 0,
};
state.cursor++;
state.queue.push(concept);
log(`concept pronto: "${concept.titolo}" (${concept.genere}, variante ${concept.variante}, strumenti ${strumenti.join('/')}, ${concept.bpm} bpm, ${concept.tonalita}, ${concept.durata_s}s)`);
return [{ json: { state } }];
