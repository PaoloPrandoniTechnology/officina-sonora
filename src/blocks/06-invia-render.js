// BLOCCO 6 - Invia render: se non c'e' un job e la coda ha un brano, lo invia a YuE2.
const state = $input.first().json.state;
if (state.job || state.queue.length === 0) return [{ json: { state } }];
if (CFG.comandi.pausa) return [{ json: { state } }]; // in pausa non si avviano nuovi render

if (!(await engineUp())) {
  log('motore YuE2 non attivo: attendo il watchdog');
  return [{ json: { state } }];
}

const concept = state.queue.shift();
concept.durata_s = concept.durata_s || CFG.durDefault;
const seed = nuovoSeed();
// LoRA: la strumentale KTO piu' quella del genere, solo se il motore le ha davvero.
// Non si usa yue2-instrumental: in produzione il motore chiudeva i brani a 30 secondi.
// Senza elenco da /props si usa la sola KTO, per non farsi rifiutare il render.
let presenti = [];
try {
  const p = await req('GET', `${CFG.yue}/props`, { ms: 10000 });
  presenti = (JSON.parse(p.buf.toString('utf8')).adapters || []).filter((a) => a.ok !== false).map((a) => a.name);
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
// Altrimenti render in un passo, con lo score del compositore (ripiego) o scritto dal motore.
const piano = !concept.vocale && !concept.attempts && !concept.pianoFallito;
const nostro = !piano && Boolean(concept.abc) && !concept.attempts;
const body = piano ? corpoPiano(concept, seed)
  : corpoRender(concept, adapters, seed, nostro ? concept.abc : null, nostro ? concept.durata_s : 0);
const id = await inviaSynth(body);
if (!id) {
  state.queue.unshift(concept);
  return [{ json: { state } }];
}
state.job = { id, seed, submittedAt: Date.now(), concept, adapters, abcNostro: nostro, ...(piano ? { fase: 'piano', pianoN: 1 } : {}) };
saveState(state); // subito: il watchdog non deve ricaricare gemma mentre il resto del giro prosegue
log(`job ${id} inviato per "${concept.titolo}" (${piano ? 'score' : `${concept.durata_s}s`})`);
return [{ json: { state } }];
