// BLOCCO 2 - Controlla render: interroga il motore YuE2 sul job in corso.
// Esito (outcome): running | waiting | done | failed
const state = $input.first().json.state;
const job = state.job;
const imp = job ? ScoreAbc.impostazioni(confScore(), job.concept.categoria) : null;
const SECONDI_SCORE_MAX = 330; // oltre, il render non sta nei 360 s del motore

// Lo score non va bene: se ne chiede un altro; finiti i tentativi, il brano torna in coda e il blocco 6
// lo rende con lo score del compositore o del motore (non conta come render fallito).
async function altroPiano(motivo) {
  const c = job.concept;
  if (job.pianoN < imp.tentativi) {
    const seed = nuovoSeed();
    // con "Instrumental" il modello a volte ripete un interlude senza fine: nel ritento scrive una canzone,
    // la cui melodia cantata passa comunque agli strumenti. Lo stile del render non cambia.
    const canzone = c.style.replace(/^Instrumental, /, '').replace(/, no vocals$/, '');
    const id = await inviaSynth(corpoPiano({ ...c, style: canzone }, seed, ScoreAbc.campionamento(imp)));
    if (!id) return 'waiting';
    state.job = { ...job, id, seed, pianoN: job.pianoN + 1, submittedAt: Date.now() };
    log(`score di "${c.titolo}" non usato (${motivo}): ne chiedo un altro`);
    return 'running';
  }
  state.job = null;
  c.pianoFallito = true;
  state.queue.unshift(c);
  log(`score del modello non riuscito per "${c.titolo}" (${motivo}): uso il ripiego`);
  return 'failed';
}

// Gli ultimi score rifiutati restano consultabili dalla dashboard, con il motivo
function conserva(abc, motivo) {
  try {
    const dir = path.join(CFG.dir, 'state', 'score-scartati');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${Date.now()}.json`), JSON.stringify({ titolo: job.concept.titolo, categoria: job.concept.categoria, motivo, il: new Date().toISOString(), abc }));
    for (const f of fs.readdirSync(dir).sort().slice(0, -30)) fs.unlinkSync(path.join(dir, f));
  } catch (e) { log(`score scartato non conservato: ${e.message}`); }
}

// Score pronto: la melodia passa agli strumenti, la durata deriva dallo score e parte il render
async function rendiScore() {
  const c = job.concept;
  let abc;
  try {
    const r = await req('GET', `${CFG.yue}/job?id=${job.id}&result=1`, { ms: 60000 });
    if (!r.ok) throw new Error(`result HTTP ${r.status}`);
    abc = extractAbc(r.buf, r.headers['content-type']);
    if (!abc) throw new Error('risposta senza score');
  } catch (e) {
    return altroPiano(e.message);
  }
  const minimo = Math.max(CFG.durMin, c.durata_s * imp.durataMinima);
  const fuori = (x) => (x.secondi < minimo || x.secondi > SECONDI_SCORE_MAX ? `score di ${x.secondi}s, richiesti circa ${c.durata_s}s` : '');
  let s = null, motivo = '', riparato = false;
  try { s = ScoreAbc.strumentale(abc); motivo = fuori(s); } catch (e) { motivo = e.message; }
  if (motivo && imp.ripara) {
    try {
      const r = ScoreAbc.ripara(abc, { obiettivo: c.durata_s, minimo, massimo: SECONDI_SCORE_MAX });
      if (r) {
        s = ScoreAbc.strumentale(r.abc);
        if (!fuori(s)) { log(`score di "${c.titolo}" recuperato (${motivo}): tagliato a ${s.secondi}s`); motivo = ''; riparato = true; }
      }
    } catch (e) { log(`recupero dello score non riuscito: ${e.message}`); }
  }
  if (!motivo && imp.ripetizioneMax < 1) {
    const ripetizione = ScoreAbc.analizza(s.abc).ripetizione;
    if (ripetizione > imp.ripetizioneMax) motivo = `score troppo ripetitivo (${Math.round(ripetizione * 100)}% di battute ripetute)`;
  }
  if (motivo) { conserva(abc, motivo); return altroPiano(motivo); }
  const concept = { ...c, abc: s.abc, lyrics: s.lyrics, durata_s: s.secondi };
  delete concept.score; // lo score del compositore non e' quello usato: i voti non devono contarlo
  const seed = nuovoSeed();
  const id = await inviaSynth(corpoRender(concept, job.adapters, seed, s.abc, s.secondi));
  if (!id) return 'waiting';
  state.job = { id, seed, submittedAt: Date.now(), concept, adapters: job.adapters, scoreFonte: 'modello', ...(riparato ? { scoreRiparato: true } : {}) };
  log(`score del modello per "${c.titolo}": ${s.secondi}s; render ${id} inviato`);
  return 'running';
}

if (Date.now() - job.submittedAt > CFG.jobTimeoutMs) {
  requeue(state, 'timeout');
  return [{ json: { state, outcome: 'failed' } }];
}

let status;
try {
  status = (await getJson(`${CFG.yue}/job?id=${job.id}`)).status;
} catch (e) {
  if (e.status === 404) {
    requeue(state, 'job non trovato sul motore (riavvio?)');
    return [{ json: { state, outcome: 'failed' } }];
  }
  log(`motore non raggiungibile, attendo: ${e.message}`);
  return [{ json: { state, outcome: 'waiting' } }];
}

if (['succeeded', 'done', 'ok'].includes(status)) {
  return [{ json: { state, outcome: job.fase === 'piano' ? await rendiScore() : 'done' } }];
}
if (['failed', 'error', 'cancelled'].includes(status)) {
  if (job.fase === 'piano') return [{ json: { state, outcome: await altroPiano(status) } }];
  requeue(state, status);
  return [{ json: { state, outcome: 'failed' } }];
}

// Log del rendering ogni ~10 minuti, per non riempire il file.
const now = Date.now();
if (!state.lastRunLog || now - state.lastRunLog > 600000) {
  log(`job ${job.id} "${job.concept.titolo}": ${status}`);
  state.lastRunLog = now;
}
return [{ json: { state, outcome: 'running' } }];
