// ---- Apprendimento: ricette, punteggi e scelta del brano successivo (UCB) ----
// Incollato dopo lib.js in ogni blocco. Un voto utente vale CFG.pesoVoto; i dati automatici valgono 1.
// Default, a meno che config\parametri.json (caricato in lib.js) non li sostituisca
CFG.pesoVoto = CFG.pesoVoto ?? 100;
CFG.minVotiAffidabili = CFG.minVotiAffidabili ?? 3;
CFG.maxEsperimenti = CFG.maxEsperimenti ?? 2;
CFG.durataEsperimentoBrani = CFG.durataEsperimentoBrani ?? 10;
CFG.esplorazione = CFG.esplorazione ?? 0.3;

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

// Scrittura atomica di una scheda: chi legge non la trova mai a meta'
function scriviScheda(jsonPath, meta) {
  const tmp = jsonPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
  fs.renameSync(tmp, jsonPath);
}

// Aggiorna solo alcuni campi di una scheda, rileggendola: un voto scritto nel frattempo resta.
// Se la scheda manca o e' illeggibile lancia un errore, senza ricrearla con i soli campi.
function aggiornaScheda(jsonPath, campi) {
  const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  scriviScheda(jsonPath, Object.assign(meta, campi));
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

// Chiave di ricetta: categoria | struttura | fascia di bpm (b0, b1, b2). Solo ciò che arriva al motore.
function recipeKey(categoria, struttura, band) {
  return `${categoria}|${struttura}|b${band}`;
}

// Il tipo serve a cartella e tag: segue l'energia del genere, non si impara
function tipoDi(energia) {
  const t = ['ambient-pad', 'melodico-dolce', 'ritmico-leggero', 'ritmico-energico', 'ritmico-energico'][(energia || 3) - 1];
  return !CFG.tipi || CFG.tipi.includes(t) ? t : CFG.tipi[0];
}

// Sotto-intervallo bpm della fascia band (0 bassa, 1 media, 2 alta) dentro il range della categoria
function bandRange(range, band) {
  const [lo, hi] = range;
  const step = (hi - lo) / 3;
  return [Math.round(lo + step * band), Math.round(lo + step * (band + 1))];
}

// Voto utente di un brano: unica fonte e' il campo voto del suo json
function votoUtente(track) {
  const v = track.meta.voto;
  return v >= 1 && v <= 5 ? v : null;
}

// Segnale di iBroadcast ({voto, fonte} o null): conta solo quando cambia, cosi' vince l'ultimo voto dato.
// Ritorna true se meta.voto e' cambiato.
function applicaSegnale(meta, segnale, oraIso) {
  const nuovo = segnale?.voto ?? null;
  if (nuovo === (meta.voto_ib ?? null)) return false;
  meta.voto_ib = nuovo;
  if (nuovo === null || nuovo === meta.voto) return false;
  meta.voto = nuovo;
  meta.voto_fonte = segnale.fonte;
  meta.voto_il = oraIso;
  return true;
}

// Impronta dei voti ("quanti|data dell'ultimo"): cambia anche correggendo un voto gia' dato
function firmaVoti(tracks) {
  const votati = tracks.filter((t) => votoUtente(t));
  const ultimo = votati.map((t) => t.meta.voto_il || '').sort().pop() || '';
  return `${votati.length}|${ultimo}`;
}

// Statistiche per ricetta: voti utente (peso CFG.pesoVoto) e dati automatici (peso 1)
function recipeStats(tracks) {
  const stats = {};
  for (const t of tracks) {
    if (!t.meta.ricetta) continue;
    // le chiavi vecchie avevano anche il tipo: categoria|tipo|struttura|fascia
    const parti = t.meta.ricetta.split('|');
    const k = parti.length === 4 ? recipeKey(parti[0], parti[2], parti[3].slice(1)) : t.meta.ricetta;
    const s = (stats[k] = stats[k] || { nu: 0, u: 0, na: 0, a: 0 });
    s.na++;
    if (t.meta.qualita && t.meta.qualita.esito === 'ok') s.a++;
    const v = votoUtente(t);
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
  const stats = recipeStats(tracks);
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
      for (let band = 0; band < 3; band++) {
        const key = recipeKey(cat.name, struttura, band);
        const r = ricettaScore(stats[key], totale);
        candidati.push({ key, cat, tipo: tipoDi(cat.energia), struttura, band, range, ...r });
      }
    }
  }
  // Varieta': le categorie degli ultimi due brani non tornano subito, se esistono alternative
  const ultime = (state.recent || []).slice(-5).map((r) => r.categoria);
  const altre = candidati.filter((c) => !ultime.includes(c.cat.name));
  let pool = altre.length ? altre : candidati;
  if (CFG.comandi && CFG.comandi.produciGenere) pool = candidati; // "produci ora" ignora la varieta' recente
  // Rotazione tra i generi: prima si sceglie il genere, con peso piu' alto per quelli meno rappresentati
  // in libreria (i generi senza brani pesano di piu'). Poi si applica la logica di ricetta solo a quel genere.
  const conta = {};
  for (const t of tracks) conta[t.meta.categoria] = (conta[t.meta.categoria] || 0) + 1;
  // Peso e stato (attivo/sospeso) per genere da config\parametri.json; "produci ora" forza un genere
  const ov = (n) => CFG.generiOverride[n] || { peso: 1, attivo: true };
  const tutti = [...new Set(pool.map((c) => c.cat.name))];
  let nomi = tutti.filter((n) => ov(n).attivo);
  if (CFG.comandi && CFG.comandi.produciGenere && tutti.includes(CFG.comandi.produciGenere)) nomi = [CFG.comandi.produciGenere];
  if (!nomi.length) nomi = tutti; // tutti sospesi: la produzione non si ferma
  const pesi = nomi.map((n) => ov(n).peso / Math.pow(1 + (conta[n] || 0), 2));
  let r = Math.random() * pesi.reduce((a, b) => a + b, 0);
  let sceltaCat = nomi[nomi.length - 1];
  for (let i = 0; i < nomi.length; i++) { r -= pesi[i]; if (r <= 0) { sceltaCat = nomi[i]; break; } }
  pool = pool.filter((c) => c.cat.name === sceltaCat);
  candidati.splice(0, candidati.length, ...pool);

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
function varianteStats(tracks, nomeCategoria) {
  const stats = {};
  for (const t of tracks) {
    if (t.meta.categoria !== nomeCategoria || !t.meta.variante) continue;
    const s = (stats[t.meta.variante] = stats[t.meta.variante] || { nu: 0, u: 0, na: 0, a: 0 });
    s.na++;
    if (t.meta.qualita && t.meta.qualita.esito === 'ok') s.a++;
    const v = votoUtente(t);
    if (v) { s.nu++; s.u += (v - 1) / 4; }
  }
  return stats;
}

// Sceglie la variante del genere con il punteggio migliore (UCB), con un po' di esplorazione
function pickVariante(cat, tracks) {
  const varianti = cat.varianti || [];
  if (!varianti.length) return null;
  const stats = varianteStats(tracks, cat.name);
  const totale = tracks.filter((t) => t.meta.categoria === cat.name).length;
  const scelte = varianti.map((v) => ({ v, ...ricettaScore(stats[v.nome], totale) }));
  scelte.sort((a, b) => b.score - a.score);
  return scelte[0].v;
}

// ---- Memoria di composizione per genere (state\memoria-composizione.json) ----
// Per ogni genere: identita' degli score, strumenti fissi e parametri dei brani gia' composti.
CFG.memoriaFile = path.join(CFG.dir, 'state', 'memoria-composizione.json');
function leggiMemoria() {
  if (!fs.existsSync(CFG.memoriaFile)) return { generi: {} };
  try {
    const m = JSON.parse(fs.readFileSync(CFG.memoriaFile, 'utf8'));
    if (m && m.generi) return m;
  } catch (e) { /* gestito sotto */ }
  // illeggibile: si mette da parte invece di sovrascriverla
  fs.renameSync(CFG.memoriaFile, `${CFG.memoriaFile}.${Date.now()}.corrotta`);
  log('memoria di composizione non valida: messa da parte, si riparte da vuota');
  return { generi: {} };
}
function salvaMemoria(m) {
  const tmp = CFG.memoriaFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(m));
  fs.renameSync(tmp, CFG.memoriaFile);
}
const gruppoMemoria = (m, nome) => (m.generi[nome] ||= { brani: [] });

// Voti dei brani composti da noi, per seed dello score
function votiPerSeed(nomeCategoria) {
  const out = {};
  for (const t of libraryTracks()) {
    if (t.meta.categoria === nomeCategoria && t.meta.score && votoUtente(t)) out[t.meta.score.seed] = votoUtente(t);
  }
  return out;
}

// Due strumenti fissi danno l'identita' al genere; gli altri (1 o 2) cambiano da un brano al successivo
function strumentiDelGruppo(cat, g) {
  const tutti = [...new Set(cat.strumenti || [])];
  const caso = (v) => v.splice(Math.floor(Math.random() * v.length), 1)[0];
  if (!g.nucleo || !g.nucleo.every((x) => tutti.includes(x))) {
    const scorta = [...tutti];
    g.nucleo = [];
    while (g.nucleo.length < 2 && scorta.length) g.nucleo.push(caso(scorta));
  }
  const resto = tutti.filter((x) => !g.nucleo.includes(x));
  const combinazioni = resto.flatMap((a, i) => [[a], ...resto.slice(i + 1).map((b) => [a, b])]);
  const nuove = combinazioni.filter((c) => c.join() !== g.ultimiExtra);
  const extra = nuove.length ? caso(nuove) : combinazioni[0] || [];
  g.ultimiExtra = extra.join();
  return [...g.nucleo, ...extra];
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

// "Si bemolle minore" -> "Bb minor"; vuoto se non riconosciuta
function tonalitaInglese(nome) {
  const m = /^(do|re|mi|fa|sol|la|si)( bemolle| diesis)? (maggiore|minore)$/.exec(String(nome || '').trim().toLowerCase());
  if (!m) return '';
  const nota = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }[m[1]];
  const alterazione = m[2] === ' bemolle' ? 'b' : m[2] === ' diesis' ? '#' : '';
  return `${nota}${alterazione} ${m[3] === 'minore' ? 'minor' : 'major'}`;
}

// ---- Blocchi di stile (usati anche dal gateway per la pagina Linee guida: funzioni senza effetti) ----
// Perche' un termine non puo' essere un blocco di stile; stringa vuota se va bene
function erroreBlocco(testo, { strumentale = false } = {}) {
  const t = String(testo ?? '').trim();
  if (t.length < 2 || t.length > 60) return 'tra 2 e 60 caratteri';
  if (/[,<>]/.test(t)) return 'senza virgole, < o >';
  if (/^no\s/i.test(t)) return 'niente negazioni: escludi il termine';
  if (/\bbpm\b/i.test(t) || /\b[a-g](#|b)?\s+(major|minor)\b/i.test(t)) return 'bpm e tonalita\' li mette il sistema';
  if (/^(instrumental|wordless vocals)$/i.test(t)) return 'e\' un blocco fisso';
  // "singing bowls" e' uno strumento
  if (strumentale && /\b(vocals?|vocalist|vocalise|voice|choir|singer|female|male|child|soprano|lyrics|rap|rapping)\b|\bsinging\b(?!\s+bowl)/i.test(t)) return 'le voci non vanno in un genere strumentale';
  return '';
}

// Stile per YuE2 a blocchi: soli descrittori inglesi, nell'ordine tipo, genere, strumenti, ritmo, atmosfera,
// aggiunte, mix, bpm, tonalità. I descrittori di ogni genere sono nel campo "en" del catalogo.
// Il motore non ha un prompt negativo: un blocco escluso viene semplicemente tolto.
function blocchiStile(cat, variante, strumenti, influenza, guidance, { bpm, tonalita, direttive } = {}) {
  const note = direttive || (((typeof CFG !== 'undefined' && CFG.generiOverride) || {})[cat.name] || {}).direttive || [];
  const en = cat.en || { genre: cat.stile };
  // le varianti segnaposto ripetono per intero la descrizione del genere: si saltano
  const colore = variante && !(cat.en && variante.keywords === cat.stile) ? variante.keywords : '';
  const mio = (guidance.blocchi_generi || {})[cat.name] || {};
  const esclusi = new Set([...(guidance.style_avoid || []), ...(mio.esclusi || [])].map((s) => String(s).trim().toLowerCase()));
  // [origine, termini, argomento]: l'argomento serve solo alla pagina Linee guida
  const gruppi = [
    ['fisso', cat.vocale_senza_parole ? 'Wordless vocals' : 'Instrumental', 'fisso'],
    ['catalogo', en.genre, 'genere'],
    ...strumenti.map((s) => ['catalogo', (en.instruments || {})[s], 'strumenti']),
    ['catalogo', colore, 'variante'],
    ['catalogo', en.rhythm, 'ritmo'],
    ['catalogo', en.mood, 'atmosfera'],
    ...[].concat(influenza || []).map((i) => ['catalogo', (en.influences || {})[i], 'genere']),
    ['nota', note.map((d) => d.replace(/\.$/, '')).join(', '), 'aggiunte'],
    ['generale', (guidance.style_extra || []).join(', '), 'aggiunte'],
    ['tuo', (mio.aggiunti || []).join(', '), 'aggiunte'],
    ['revisione', ((guidance.stile_generi || {})[cat.name] || []).join(', '), 'aggiunte'],
    ['catalogo', en.space, 'produzione'],
    ['fisso', bpm ? `${bpm} BPM` : '', 'fisso'],
    ['fisso', tonalitaInglese(tonalita), 'fisso'],
    ['fisso', cat.vocale_senza_parole ? 'no lyrics' : 'no vocals', 'fisso'],
  ];
  // il motore pesa le parole: ogni frase compare una volta sola
  const viste = new Set();
  const blocchi = [];
  for (const [origine, valore, argomento] of gruppi) {
    for (const testo of String(valore || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const chiave = testo.toLowerCase();
      if (viste.has(chiave)) continue;
      viste.add(chiave);
      blocchi.push({ testo, origine, argomento, escluso: origine !== 'fisso' && esclusi.has(chiave) });
    }
  }
  return blocchi;
}

function componiStile(...argomenti) {
  return blocchiStile(...argomenti).filter((b) => !b.escluso).map((b) => b.testo).join(', ');
}

// Divieti del genere, quelli generali e quelli scelti per il genere (solo nella scheda del brano)
function divietiDi(cat, guidance) {
  const mio = (guidance.blocchi_generi || {})[cat.name] || {};
  return [...(cat.vietati || []), ...(guidance.style_avoid || []), ...(mio.esclusi || [])].join(', ');
}
