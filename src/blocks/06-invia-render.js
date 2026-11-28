// BLOCCO 6 - Invia render: se non c'e' un job e la coda ha un brano, lo invia a YuE2.
const state = $input.first().json.state;
if (state.job || state.queue.length === 0) return [{ json: { state } }];
if (CFG.comandi.pausa) return [{ json: { state } }]; // in pausa non si avviano nuovi render

if (!(await engineUp())) {
  log('motore YuE2 non attivo: attendo il watchdog');
  return [{ json: { state } }];
}

let concept = state.queue.shift();
concept.durata_s = concept.durata_s || CFG.durDefault;
// uno score scelto a mano dalla dashboard ha la precedenza su tutto
const consumato = (id, esito) => { state.scoreUsati = Object.fromEntries([...Object.entries(state.scoreUsati || {}).filter(([k]) => k !== id), [id, { ...esito, at: new Date().toISOString() }]].slice(-100)); };
const scelto = concept.scoreManuale ? null : ScoreAbc.richiestaPer(archivioScore().richieste, state.scoreUsati, concept);
if (scelto) {
  try { concept = ScoreAbc.applica(concept, scelto); log(`score scelto a mano per "${concept.titolo}" (${concept.durata_s}s)`); }
  // una richiesta inutilizzabile non deve restare in attesa per sempre
  catch (e) { consumato(scelto.id, { titolo: concept.titolo, errore: e.message }); log(`score scelto a mano non usato per "${concept.titolo}": ${e.message}`); }
}
const manuale = Boolean(concept.scoreManuale);
const imp = ScoreAbc.risolvi(ScoreAbc.impostazioni(confScore(), concept.categoria), (CFG.categories || []).find((x) => x.name === concept.categoria));
const seed = nuovoSeed();
// LoRA: la strumentale KTO piu' quella del genere, solo se il motore le ha davvero.
// Non si usa yue2-instrumental: in produzione il motore chiudeva i brani a 30 secondi.
// Senza elenco da /props si usa la sola KTO, per non farsi rifiutare il render.
let presenti = [];
try {
  const p = await req('GET', `${CFG.yue}/props`, { ms: 10000 });
  const motore = JSON.parse(p.buf.toString('utf8'));
  presenti = (motore.adapters || []).filter((a) => a.ok !== false).map((a) => a.name);
  // nome del modello musicale, senza percorso ed estensione
  if (motore.model) concept.modello_musica = String(motore.model).split(/[\\/]/).pop().replace(/\.gguf$/i, '');
} catch (e) {
  log(`elenco LoRA non disponibile: ${e.message}`);
}
const piena = (name) => ({ name, scale: 1.0, ar_scale: 1.0, nar_scale: 0.0 });
const delGenere = ((CFG.categories || []).find((x) => x.name === concept.categoria) || {}).lora || [];
const mancanti = delGenere.filter((a) => !presenti.includes(a.name));
if (presenti.length && mancanti.length) log(`LoRA assente sul motore, brano senza: ${mancanti.map((a) => a.name).join(', ')}`);
// Ripiego: dopo un render fallito, o al secondo ritento di un brano corto, si toglie la LoRA di genere
// (LoRA sovrapposte possono rovinare lo score); al terzo fallimento lo score e' di sola melodia.
const sicuro = (concept.attempts || 0) >= 2;
const adapters = concept.vocale ? [] : [piena('yue2-instrumental-kto')];
if (!concept.attempts && (concept.tentativi_render || 0) < 2) adapters.push(...delGenere.filter((a) => presenti.includes(a.name)));

// gemma esce dalla GPU prima del render: su 6 GB i due modelli insieme rallentano il caricamento
try { await gw('/llm/scarica'); } catch (e) { log(`gemma non scaricato: ${e.message}`); }

// Strumentale al primo tentativo: prima il solo score, poi il blocco 2 avvia il render.
// Altrimenti render in un passo, con lo score del compositore o scritto dal motore.
const piano = !manuale && imp.fonte === 'modello' && !concept.vocale && !concept.attempts && !concept.pianoFallito;
// nei generi creativi il nostro score resta anche al primo ritento: quello del motore è molto più monotono
const nostro = !piano && Boolean(concept.abc) && (manuale || ((concept.attempts || 0) <= (imp.livello ? 1 : 0) && imp.fonte !== 'motore'));
const body = piano ? corpoPiano(concept, seed, ScoreAbc.campionamento(imp))
  : corpoRender(concept, adapters, seed, nostro ? concept.abc : null, nostro ? concept.durata_s : 0);
const id = await inviaSynth(body);
if (!id) {
  // un rifiuto della richiesta (4xx) si ripete identico: dopo 5 volte il brano si abbandona
  if (inviaSynth.ultimoStato >= 400 && inviaSynth.ultimoStato < 500) concept.rifiuti = (concept.rifiuti || 0) + 1;
  if (concept.rifiuti >= 5) {
    if (manuale) consumato(concept.scoreManuale, { titolo: concept.titolo, errore: 'rifiutato dal motore' });
    state.failed.push({ titolo: concept.titolo, categoria: concept.categoria, tipo: concept.tipo, motivo: `rifiutato dal motore (HTTP ${inviaSynth.ultimoStato})`, at: new Date().toISOString() });
    log(`scartato "${concept.titolo}": il motore rifiuta la richiesta (HTTP ${inviaSynth.ultimoStato})`);
  } else state.queue.unshift(concept);
  return [{ json: { state } }];
}
state.job = { id, seed, submittedAt: Date.now(), concept, adapters, abcNostro: nostro, ...(manuale && nostro ? { scoreFonte: 'manuale' } : {}), ...(piano ? { fase: 'piano', pianoN: 1 } : {}) };
// la richiesta è consumata: la dashboard la mostra come usata
if (manuale) consumato(concept.scoreManuale, { titolo: concept.titolo });
saveState(state); // subito: il watchdog non deve ricaricare gemma mentre il resto del giro prosegue
log(`job ${id} inviato per "${concept.titolo}" (${piano ? 'score' : `${concept.durata_s}s`})`);
return [{ json: { state } }];
