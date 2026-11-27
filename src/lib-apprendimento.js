// ---- Apprendimento: ricette, punteggi e scelta del brano successivo (UCB) ----
// Incollato dopo lib.js in ogni blocco. Un voto utente vale CFG.pesoVoto; i dati automatici valgono 1.
CFG.pesoVoto = 100;
CFG.minVotiAffidabili = 3;
CFG.maxEsperimenti = 2;
CFG.durataEsperimentoBrani = 10;
CFG.esplorazione = 0.3;

// Tutti i brani della libreria (ogni .json con titolo)
function libraryTracks() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name === '_scartati') continue; // brani scartati dal controllo qualita': non fanno parte della libreria
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.json') && name !== 'feedback.json') {
        const meta = readJsonSafe(full, null);
        if (meta && meta.titolo) out.push({ meta, jsonPath: full, audio: name.replace(/\.json$/, '') });
      }
    }
  };
  if (fs.existsSync(CFG.root)) walk(CFG.root);
  return out;
}

// Numero progressivo globale dei brani: non si ripete mai e non torna indietro.
// Il contatore vive in state/contatore.json e si incrementa a ogni brano salvato.
CFG.contatoreFile = path.join(CFG.dir, 'state', 'contatore.json');
function numeroProgressivo() {
  const c = readJsonSafe(CFG.contatoreFile, { prossimo: 1 });
  const numero = c.prossimo;
  fs.writeFileSync(CFG.contatoreFile, JSON.stringify({ prossimo: numero + 1, aggiornato: new Date().toISOString() }, null, 2));
  return numero;
}

// Chiave di ricetta: categoria | tipo | struttura | fascia di bpm (b0, b1, b2)
function recipeKey(categoria, tipo, struttura, band) {
  return `${categoria}|${tipo}|${struttura}|b${band}`;
}

// Sotto-intervallo bpm della fascia band (0 bassa, 1 media, 2 alta) dentro il range della categoria
function bandRange(range, band) {
  const [lo, hi] = range;
  const step = (hi - lo) / 3;
  return [Math.round(lo + step * band), Math.round(lo + step * (band + 1))];
}

// Voto utente per un brano: dal feedback.csv (prevale) o dal campo voto del json
function votoUtente(track, votes) {
  const base = track.audio;
  const v = votes[base + '.mp3'] || votes[base + '.flac'] || votes[base + '.wav'] || votes[base + '.ogg'];
  if (v) return v.voto;
  return track.meta.voto || null;
}

// Statistiche per ricetta: voti utente (peso CFG.pesoVoto) e dati automatici (peso 1)
function recipeStats(tracks, votes) {
  const stats = {};
  for (const t of tracks) {
    const k = t.meta.ricetta;
    if (!k) continue;
    const s = (stats[k] = stats[k] || { nu: 0, u: 0, na: 0, a: 0 });
    s.na++;
    if (t.meta.qualita && t.meta.qualita.esito === 'ok') s.a++;
    const v = votoUtente(t, votes);
    if (v) { s.nu++; s.u += (v - 1) / 4; } // voto 1..5 -> 0..1
  }
  return stats;
}

// Punteggio di una ricetta: media pesata con prior 0.5; UCB aggiunge esplorazione
function ricettaScore(s, totale) {
  const peso = CFG.pesoVoto;
  const numeratore = 0.5 + peso * (s ? s.u : 0) + (s ? s.a : 0);
  const denominatore = 1 + peso * (s ? s.nu : 0) + (s ? s.na : 0);
  const p = numeratore / denominatore;
  const n = (s ? s.nu * peso + s.na : 0);
  const bonus = CFG.esplorazione * Math.sqrt(Math.log(totale + 2) / (n + 1));
  return { p, score: p + bonus, affidabile: (s ? s.nu : 0) >= CFG.minVotiAffidabili };
}

// Sceglie categoria, tipo, struttura e fascia di bpm per il prossimo brano.
// Ricette non ancora affidabili entrano solo come esperimento, al massimo CFG.maxEsperimenti alla volta.
function pickSlot(state, guidance) {
  const tracks = libraryTracks();
  const votes = readVotes();
  const stats = recipeStats(tracks, votes);
  const totale = tracks.length;

  // Gli esperimenti terminano quando la ricetta diventa affidabile o dopo N brani
  state.experiments = (state.experiments || []).filter((e) => {
    const s = stats[e.key];
    const affidabile = s && s.nu >= CFG.minVotiAffidabili;
    return !affidabile && totale - e.da < CFG.durataEsperimentoBrani;
  });
  const inEsperimento = new Set(state.experiments.map((e) => e.key));
  const candidati = [];
  for (const cat of CFG.categories) {
    const strutture = (guidance.struttura_pref && guidance.struttura_pref[cat.name]) || cat.strutture;
    const range = durRangeBpm(guidance, cat);
    for (const struttura of strutture) {
      for (const tipo of CFG.tipi) {
        for (let band = 0; band < 3; band++) {
          const key = recipeKey(cat.name, tipo, struttura, band);
          const s = stats[key];
          const r = ricettaScore(s, totale);
          candidati.push({ key, cat, tipo, struttura, band, range, ...r });
        }
      }
    }
  }
  // Varieta': le categorie degli ultimi due brani non tornano subito, se esistono alternative
  const ultime = (state.recent || []).slice(-5).map((r) => r.categoria);
  const altre = candidati.filter((c) => !ultime.includes(c.cat.name));
  if (altre.length) candidati.splice(0, candidati.length, ...altre);

  // Prima le ricette affidabili con punteggio migliore; le non affidabili solo se c'e' posto negli esperimenti
  const affidabili = candidati.filter((c) => c.affidabile).sort((a, b) => b.score - a.score);
  const nuove = candidati.filter((c) => !c.affidabile).sort((a, b) => b.score - a.score);
  let scelto = null;
  const postoEsperimento = state.experiments.length < CFG.maxEsperimenti;
  if (nuove.length && (postoEsperimento || inEsperimento.has(nuove[0].key)) && Math.random() < 0.5) {
    scelto = nuove.find((c) => inEsperimento.has(c.key)) || nuove[0];
  }
  if (!scelto) scelto = affidabili[0] || nuove[0];
  if (!scelto.affidabile && !inEsperimento.has(scelto.key)) state.experiments.push({ key: scelto.key, da: totale });

  const cat = { ...scelto.cat, bpm: bandRange(scelto.range, scelto.band) };
  return {
    category: cat,
    tipo: scelto.tipo,
    struttura: scelto.struttura,
    sezioni: CFG.strutture[scelto.struttura],
    band: scelto.band,
    ricetta: scelto.key,
    esperimento: !scelto.affidabile,
    punteggio: Number(scelto.score.toFixed(3)),
  };
}

// Intervallo bpm della categoria, da guidance (come in lib.js ma usabile qui)
function durRangeBpm(guidance, cat) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec((guidance.bpm_range || {})[cat.name] || '');
  return m ? [Number(m[1]), Number(m[2])] : cat.bpm;
}

// ---- Identita' dei generi: stile composto in codice, varianti scelte con UCB sui voti ----

// Statistiche per variante di un genere (voti utente e dati automatici)
function varianteStats(tracks, votes, nomeCategoria) {
  const stats = {};
  for (const t of tracks) {
    if (t.meta.categoria !== nomeCategoria || !t.meta.variante) continue;
    const s = (stats[t.meta.variante] = stats[t.meta.variante] || { nu: 0, u: 0, na: 0, a: 0 });
    s.na++;
    if (t.meta.qualita && t.meta.qualita.esito === 'ok') s.a++;
    const v = votoUtente(t, votes);
    if (v) { s.nu++; s.u += (v - 1) / 4; }
  }
  return stats;
}

// Sceglie la variante del genere con il punteggio migliore (UCB), con un po' di esplorazione
function pickVariante(cat, tracks, votes) {
  const varianti = cat.varianti || [];
  if (!varianti.length) return null;
  const stats = varianteStats(tracks, votes, cat.name);
  const totale = tracks.filter((t) => t.meta.categoria === cat.name).length;
  const scelte = varianti.map((v) => ({ v, ...ricettaScore(stats[v.nome], totale) }));
  scelte.sort((a, b) => b.score - a.score);
  return scelte[0].v;
}

// Sottoinsieme casuale di strumenti del genere (solo quelli del suo set), 2-4 per brano
function scegliStrumenti(cat) {
  const pool = [...(cat.strumenti || [])];
  const n = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
  const scelti = [];
  while (scelti.length < n && pool.length) scelti.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return scelti;
}

// Un'influenza pesata tra quelle del genere (puo' essere anche il genere stesso)
function scegliInfluenza(cat) {
  const lista = cat.influenze || [];
  if (!lista.length) return null;
  const tot = lista.reduce((a, b) => a + b.peso, 0);
  let r = Math.random() * tot;
  for (const i of lista) { r -= i.peso; if (r <= 0) return i.genere; }
  return lista[0].genere;
}

// Compone lo stile del brano dal genere: identita' fissa, strumenti del set, variante, influenza, melodia e ritmica
function componiStile(cat, variante, strumenti, influenza, guidance) {
  const parti = [
    cat.stile,
    `instruments: ${strumenti.join(', ')}`,
    variante ? variante.keywords : '',
    influenza ? `influence: ${influenza}` : '',
    cat.enfasi ? `emphasis: ${cat.enfasi}` : '',
    cat.melodia ? `melody: ${cat.melodia}` : '',
    cat.accordi ? `chords: ${cat.accordi}` : '',
    cat.ritmica ? `rhythm: ${cat.ritmica}` : '',
    (guidance.style_extra || []).join(', '),
    cat.vocale_senza_parole ? 'wordless vocals, no lyrics' : 'instrumental, no vocals',
  ].filter(Boolean);
  return parti.join(', ');
}

// Divieti del genere e quelli generali
function divietiDi(cat, guidance) {
  return [...(cat.vietati || []), ...(guidance.style_avoid || [])].join(', ');
}
