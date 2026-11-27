// BLOCCO 4 - Feedback e miglioramento: ogni CFG.reviewEvery brani il modello rivede
// i risultati (dati automatici + voti utente in feedback.csv) e aggiorna guidance.json.
const inp = $input.first().json;
const state = inp.state;

// Tutti i brani della libreria: il .json di ogni brano e' la fonte dei dati.
const votes = readVotes();
const votedCount = Object.keys(votes).length;
const newVotes = votedCount !== (state.lastVoteCount || 0);
const periodic = state.done % CFG.reviewEvery === 0 && state.lastReview !== state.done;

if (inp.outcome !== 'saved' || state.done === 0 || !(periodic || newVotes)) {
  return [{ json: { state } }];
}

try {
  // Sincronizza i voti nei .json di tutti i brani votati
  const tracks = libraryTracks();
  for (const t of tracks) {
    const v = votes[t.meta.file_name || (t.audio + '.mp3')] || votes[t.audio + '.mp3'] || votes[t.audio + '.flac'] || votes[t.audio + '.wav'];
    if (v && t.meta.voto !== v.voto) {
      t.meta.voto = v.voto;
      t.meta.nota_utente = v.nota;
      fs.writeFileSync(t.jsonPath, JSON.stringify(t.meta, null, 2));
    }
  }
  const voted = tracks
    .filter((t) => t.meta.voto)
    .sort((a, b) => String(b.meta.generato_il).localeCompare(String(a.meta.generato_il)))
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
    state.lastVoteCount = votedCount;
    return [{ json: { state } }];
  }
  const current = readGuidance();
  const recent = voted;
  const system = 'Sei il revisore artistico di un generatore di musica per centri yoga. Rispondi solo con JSON valido.';
  const user = `Brani votati dall'utente (voto da 1 a 5, le note sono indicazioni dirette; ogni voto utente pesa come 100 dati automatici):
${JSON.stringify(recent, null, 1)}

Linee guida attuali:
${JSON.stringify(current, null, 1)}

Proponi linee guida aggiornate SOLO se servono miglioramenti chiari. Rispondi con un JSON con:
- "style_extra": array di max 5 keyword INGLESI da aggiungere al prompt di stile
- "style_avoid": array di max 6 keyword INGLESI da evitare
- "durata_hint": oggetto categoria -> "min-max" in secondi (tra 120 e 270), solo per le categorie da cambiare
- "bpm_range": oggetto categoria -> "min-max" bpm, solo per le categorie da cambiare (resta nella fascia della loro energia, +/- 15 bpm al massimo)
- "struttura_pref": oggetto categoria -> array di strutture preferite tra piatto, onda, arco, crescendo, loop (solo tra quelle gia' previste per la categoria)
- "note": una frase in italiano che spiega il motivo delle modifiche
Niente nomi di artisti o marchi.`;
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
      const lo = Math.max(30, Math.min(Number(m[1]), c.bpm[1] + 15));
      const hi = Math.min(150, Math.max(Number(m[2]), c.bpm[0] - 15));
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
  const next = {
    versione: current.versione + 1,
    bpm_range: bpmRange,
    struttura_pref: strutturaPref,
    style_extra: [...new Set((j.style_extra || []).map(String).map((s) => s.trim()).filter(Boolean))].slice(0, 5),
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
}
state.lastReview = state.done;
state.lastVoteCount = votedCount;
return [{ json: { state } }];
