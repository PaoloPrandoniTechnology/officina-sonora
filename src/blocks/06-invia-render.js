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
// LoRA: la strumentale (pensata per lo score) piu' quella del genere, solo se il motore le ha davvero.
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
const adapters = concept.vocale ? [] : [
  piena(presenti.includes('yue2-instrumental') ? 'yue2-instrumental' : 'yue2-instrumental-kto'),
];
adapters.push(...delGenere.filter((a) => presenti.includes(a.name)));

const durata = Math.min(360, Math.round(concept.durata_s * 1.2)); // 360 s: limite del motore
const body = {
  style: concept.style,
  lyrics: concept.lyrics,
  cot: 'full', // score con melodia e accordi
  ...(adapters.length ? { adapters } : {}),
  // Il motore tronca il brano quando finisce i token: si chiede piu' durata e piu' margine,
  // cosi' il brano si chiude da solo e non si interrompe a meta'. Il controllo qualita' usa la durata di riferimento.
  duration: durata,
  semantic_sampling: { max_tokens: Math.min(9000, Math.round(durata * 25 * 1.2)) },
  abc_sampling: { max_tokens: Math.max(512, Math.min(9000, Math.round(durata * 25 * 1.2))) },
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
state.job = { id, seed, submittedAt: Date.now(), concept, adapters };
log(`job ${id} inviato per "${concept.titolo}" (${concept.durata_s}s)`);
return [{ json: { state } }];
