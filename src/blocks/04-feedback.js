// BLOCCO 4 - Feedback e miglioramento: ogni CFG.reviewEvery brani il modello rivede
// i risultati (dati automatici + voti utente nei .json) e aggiorna guidance.json.
const inp = $input.first().json;
const state = inp.state;

if (inp.outcome !== 'saved' || state.done === 0) {
  return [{ json: { state } }];
}

let voteMark = state.lastVoteMark;
try {
  // Tutti i brani della libreria: il .json di ogni brano e' la fonte dei dati.
  const tracks = libraryTracks();
  voteMark = firmaVoti(tracks);
  const periodic = state.done % CFG.reviewEvery === 0 && state.lastReview !== state.done;
  if (!periodic && voteMark === state.lastVoteMark) {
    return [{ json: { state } }];
  }
  const voted = tracks
    .filter((t) => votoUtente(t))
    .sort((a, b) => String(b.meta.voto_il || b.meta.generato_il).localeCompare(String(a.meta.voto_il || a.meta.generato_il)))
    .slice(0, 30)
    .map((t) => ({
      titolo: t.meta.titolo,
      categoria: t.meta.categoria,
      tipo: t.meta.tipo,
      energia: t.meta.energia,
      struttura: t.meta.struttura,
      durata_s: t.meta.durata_s,
      render_s: t.meta.render_s,
      bpm: t.meta.bpm,
      style: t.meta.style,
      voto_utente: t.meta.voto,
      nota_utente: t.meta.nota_utente || null,
    }));
  if (voted.length === 0) {
    // Nessun voto ancora: non e' un errore, la revisione aspettera' i primi voti
    state.lastReview = state.done;
    state.lastVoteMark = voteMark;
    return [{ json: { state } }];
  }
  const current = readGuidance();
  const recent = voted;
  const system = 'Sei il revisore artistico di un generatore di musica di sottofondo. Rispondi solo con JSON valido.';
  const user = `Brani votati dall'utente (voto da 1 a 5, le note sono indicazioni dirette; ogni voto utente pesa come 100 dati automatici):
${JSON.stringify(recent, null, 1)}

Linee guida attuali:
${JSON.stringify(current, null, 1)}

Proponi linee guida aggiornate SOLO se servono miglioramenti chiari. Rispondi con un JSON con:
- "stile_generi": oggetto categoria -> array di max 5 keyword INGLESI da aggiungere al prompt di stile di quel genere, solo per le categorie dei brani votati e coerenti con il genere
- "style_avoid": array di max 6 keyword INGLESI da evitare
- "durata_hint": oggetto categoria -> "min-max" in secondi (tra 120 e 270), solo per le categorie da cambiare
- "bpm_range": oggetto categoria -> "min-max" bpm, solo per le categorie da cambiare (resta nella fascia della loro energia, +/- 15 bpm al massimo)
- "struttura_pref": oggetto categoria -> array di strutture preferite tra piatto, onda, arco, crescendo, loop (solo tra quelle gia' previste per la categoria)
- "note": una frase in italiano che spiega il motivo delle modifiche
Niente nomi di artisti o marchi.`;
  const carico = await gw('/llm/carica'); // dopo un render gemma puo' non essere ancora in memoria
  if (!carico.ok) throw new Error(`gemma non caricato: ${carico.error || carico.status}`);
  const j = await llmJson(system, user, 1500);

  const names = CFG.categories.map((c) => c.name);
  const hint = { ...current.durata_hint };
  for (const [cat, range] of Object.entries(j.durata_hint || {})) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(range));
    if (names.includes(cat) && m) hint[cat] = `${clampDur(m[1])}-${clampDur(m[2])}`;
  }
  // bpm_range: solo intervalli validi e dentro la fascia di energia della categoria (+/- 15)
  const bpmRange = { ...(current.bpm_range || {}) };
  for (const [cat, range] of Object.entries(j.bpm_range || {})) {
    const c = CFG.categories.find((x) => x.name === cat);
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(range));
    if (c && m) {
      const entro = (n) => Math.max(30, c.bpm[0] - 15, Math.min(150, c.bpm[1] + 15, Number(n)));
      const lo = entro(m[1]);
      const hi = entro(m[2]);
      if (lo < hi) bpmRange[cat] = `${lo}-${hi}`;
    }
  }
  // struttura_pref: solo strutture gia' previste per la categoria
  const strutturaPref = { ...(current.struttura_pref || {}) };
  for (const [cat, list] of Object.entries(j.struttura_pref || {})) {
    const c = CFG.categories.find((x) => x.name === cat);
    if (c && Array.isArray(list)) {
      const ok = list.filter((s) => c.strutture.includes(s));
      if (ok.length) strutturaPref[cat] = [...new Set(ok)];
    }
  }
  // parole di stile per genere: solo per i generi con brani votati; gli altri conservano le loro
  const stileGeneri = { ...(current.stile_generi || {}) };
  for (const [cat, list] of Object.entries(j.stile_generi || {})) {
    if (!names.includes(cat) || !voted.some((t) => t.categoria === cat) || !Array.isArray(list)) continue;
    stileGeneri[cat] = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))].slice(0, 5);
  }
  const next = {
    versione: current.versione + 1,
    bpm_range: bpmRange,
    struttura_pref: strutturaPref,
    style_extra: current.style_extra || [], // generali: li cambi solo tu
    stile_generi: stileGeneri,
    style_avoid: [...new Set([...(DEFAULT_GUIDANCE.style_avoid), ...(j.style_avoid || []).map(String)])].slice(0, 9),
    durata_hint: hint,
    note: String(j.note || '').slice(0, 300),
    aggiornato: new Date().toISOString(),
  };
  fs.mkdirSync(CFG.historyDir, { recursive: true });
  fs.writeFileSync(path.join(CFG.historyDir, `guidance-v${current.versione}.json`), JSON.stringify(current, null, 2));
  fs.writeFileSync(CFG.guidanceFile, JSON.stringify(next, null, 2));
  log(`linee guida aggiornate a v${next.versione}: ${next.note}`);
} catch (e) {
  log(`revisione non riuscita (linee guida invariate): ${e.message}`);
  return [{ json: { state } }]; // si riprova dopo il prossimo brano
}
state.lastReview = state.done;
state.lastVoteMark = voteMark;
return [{ json: { state } }];
