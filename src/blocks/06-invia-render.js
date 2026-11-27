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
const seed = Math.floor(Math.random() * 2147483647);
const body = {
  style: concept.style,
  lyrics: concept.lyrics,
  cot: 'melody',
  // LoRA "instrumental-kto": tiene il brano davvero senza voce (il motore lo richiede per testi solo sezioni)
  ...(concept.vocale ? {} : { adapters: [{ name: 'yue2-instrumental-kto', scale: 1.0, ar_scale: 1.0, nar_scale: 0.0 }] }),
  // Il motore tronca il brano quando finisce i token: si chiede piu' durata e piu' margine,
  // cosi' il brano si chiude da solo e non si interrompe a meta'. Il controllo qualita' usa la durata di riferimento.
  duration: Math.round(concept.durata_s * 1.2),
  semantic_sampling: { max_tokens: Math.round(concept.durata_s * 1.2 * 25 * 1.2) },
  abc_sampling: { max_tokens: Math.max(512, Math.round(concept.durata_s * 1.2 * 25 * 1.2)) },
  output_format: 'mp3',
  seed,
};
const r = await req('POST', `${CFG.yue}/synth`, { body, ms: 20000 });
if (!r.ok) {
  state.queue.unshift(concept);
  log(`/synth rifiutato (HTTP ${r.status}): riprovo al prossimo giro`);
  return [{ json: { state } }];
}
const id = JSON.parse(r.buf.toString('utf8')).id;
state.job = { id, seed, submittedAt: Date.now(), concept };
log(`job ${id} inviato per "${concept.titolo}" (${concept.durata_s}s)`);
return [{ json: { state } }];
