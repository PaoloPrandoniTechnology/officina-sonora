// Il materiale musicale del compositore estro: valori di serie, controlli e unione con le modifiche fatte dalla
// dashboard (config\composizione.json). Usato dalla produzione (blocco 5d) e dal gateway: stesse regole.
const Abc = typeof ScoreAbc !== 'undefined' ? ScoreAbc : require('./abc.js');
const A = typeof Armonia !== 'undefined' ? Armonia : require('./armonia.js');
const M = typeof Melodia !== 'undefined' ? Melodia : require('./melodia.js');

const STILI = { rock: 'Rock', blues: 'Blues', jazz: 'Jazz', funk: 'Funk e groove', elettro: 'Elettronica', cine: 'Cinematico', folk: 'Folk', balcanico: 'Balcanico', flamenco: 'Flamenco' };
const ANDAMENTI = { dritto: 'Dritto (rock, elettronica)', swing: 'Swing (blues, jazz)', sincopato: 'Sincopato (funk)', ampio: 'Ampio (cinematico)', danza: 'Danza (folk, balcanico, flamenco)' };
const RUOLI = { strofa: 'Strofa', pre: 'Pre-ritornello', rit: 'Ritornello', ponte: 'Ponte' };
const SEZIONI = ['gancio', 'strofa', 'pre', 'rit', 'solo', 'ponte', 'finale'];
const GESTI = { x: 'nota d’arrivo o pausa', p: 'passaggio', n: 'volta', a: 'arpeggio', s: 'salto', c: 'cromatica d’approccio', r: 'ribattuta' };

// nome, modo, accordi (un grado per battuta), note (tonalità di riferimento Do: Do4 è il Do centrale), stili
const RICHIAMI = {
  gioia: ["Inno alla gioia (Beethoven)", "M", "I | V | I | V", "Mi4:8 Mi4:8 Fa4:8 Sol4:8 | Sol4:8 Fa4:8 Mi4:8 Re4:8 | Do4:8 Do4:8 Re4:8 Mi4:8 | Mi4:12 Re4:4 Re4:16", "elettro cine folk"],
  montagna: ["Nell’antro del re della montagna (Grieg)", "m", "i | i", "Do4:4 Re4:4 Mib4:4 Fa4:4 Sol4:4 Mib4:4 Sol4:8 | Fa#4:4 Re4:4 Fa#4:8 Fa4:4 Do#4:4 Fa4:8", "rock elettro cine"],
  korobeiniki: ["Korobeiniki (canto popolare russo)", "m", "V7 | i | V7 | i", "Sol4:8 Re4:4 Mib4:4 Fa4:8 Mib4:4 Re4:4 | Do4:8 Do4:4 Mib4:4 Sol4:8 Fa4:4 Mib4:4 | Re4:12 Mib4:4 Fa4:8 Sol4:8 | Mib4:8 Do4:8 Do4:16", "funk elettro balcanico"],
  turca: ["Rondò alla turca (Mozart)", "m", "i | i", "Re4:4 Do4:4 Si3:4 Do4:4 Mib4:8 -:8 | Fa4:4 Mib4:4 Re4:4 Mib4:4 Sol4:8 -:8", "jazz elettro balcanico flamenco"],
  elisa: ["Per Elisa (Beethoven)", "m", "i | i", "Sol4:4 Fa#4:4 Sol4:4 Fa#4:4 Sol4:4 Re4:4 Fa4:4 Mib4:4 | Do4:16 -:16", "rock jazz funk elettro"],
  toccata: ["Toccata in Re minore (Bach)", "m", "i | V7", "Sol4:2 Fa4:2 Sol4:28 | Fa4:4 Mib4:4 Re4:4 Do4:4 Si3:8 Do4:8", "rock elettro"],
  quinta: ["Quinta sinfonia (Beethoven)", "m", "i | V7", "-:4 Sol4:4 Sol4:4 Sol4:4 Mib4:16 | -:4 Fa4:4 Fa4:4 Fa4:4 Re4:16", "rock funk cine"],
  diesirae: ["Dies irae (canto gregoriano)", "m", "i | i", "Mib4:8 Re4:8 Mib4:8 Do4:8 | Re4:8 Sib3:8 Do4:16", "rock cine"],
  tell: ["Guglielmo Tell (Rossini)", "M", "I | I", "Sol4:2 Sol4:2 Sol4:4 Sol4:2 Sol4:2 Sol4:4 Sol4:2 Sol4:2 Sol4:4 Sol4:2 Sol4:2 Sol4:4 | Sol4:2 Sol4:2 Do4:8 Re4:8 Mi4:12", "rock"],
  saints: ["When the Saints Go Marching In (tradizionale)", "M", "I | I | I | I", "-:8 Do4:8 Mi4:8 Fa4:8 | Sol4:32 | -:8 Do4:8 Mi4:8 Fa4:8 | Sol4:32", "blues jazz funk"],
  greensleeves: ["Greensleeves (tradizionale)", "m", "i | bVII | i | V7", "Mib4:8 Fa4:4 Sol4:8 Lab4:4 Sol4:8 | Fa4:8 Re4:4 Sib3:8 Do4:4 Re4:8 | Mib4:8 Do4:4 Do4:8 Si3:4 Do4:8 | Re4:8 Si3:4 Sol3:20", "jazz folk"],
  bellaciao: ["Bella ciao (tradizionale)", "m", "i | i | i | iv", "Sol3:4 Do4:4 Re4:4 Mib4:4 Do4:16 | Sol3:4 Do4:4 Re4:4 Mib4:4 Do4:16 | Sol3:4 Do4:4 Re4:4 Mib4:8 Re4:4 Do4:8 | Mib4:8 Re4:4 Do4:4 Sol4:8 Sol4:8", "folk balcanico flamenco"],
  habanera: ["Habanera dalla Carmen (Bizet)", "m", "i | V7", "Do5:6 Si4:2 Sib4:8 Sib4:8 Sib4:8 | La4:6 Lab4:2 Sol4:8 Sol4:8 Sol4:8", "blues jazz funk flamenco"],
  cancan: ["Can-can (Offenbach)", "M", "I | V7 | V7 | I", "Do4:16 Re4:4 Fa4:4 Mi4:4 Re4:4 | Sol4:8 Sol4:8 Sol4:4 La4:4 Mi4:4 Fa4:4 | Re4:8 Re4:8 Re4:4 Fa4:4 Mi4:4 Re4:4 | Do4:4 Do5:4 Si4:4 La4:4 Sol4:4 Fa4:4 Mi4:4 Re4:4", "balcanico"],
  scarborough: ["Scarborough Fair (tradizionale)", "m", "i | bVII | i", "Do4:16 Do4:8 Sol4:8 | Sol4:16 Re4:8 Mib4:4 Re4:4 | Do4:32", "blues folk"],
};

const FORME = {
  canzone: ['Canzone', 'gancio:4:0 strofa:8:0 pre:4:5 rit:8:0 strofa:8:2 pre:4:6 rit:8:3 solo:8:1 rit:8:4 finale:4:0', 'rock funk elettro cine folk balcanico flamenco jazz'],
  arena: ['Arena', 'gancio:4:0 strofa:8:0 rit:8:0 strofa:8:3 rit:8:4 ponte:8:2 solo:8:1 rit:8:5 finale:4:0', 'rock funk elettro cine folk balcanico flamenco blues'],
  viaggio: ['Viaggio', 'gancio:4:0 rit:8:0 strofa:8:0 pre:4:3 rit:8:2 solo:8:1 ponte:8:4 rit:8:5 finale:4:0', 'rock funk elettro cine folk balcanico flamenco'],
  jam: ['Jam', 'gancio:4:0 strofa:8:0 strofa:8:2 solo:8:0 solo:8:4 ponte:8:1 strofa:8:3 finale:4:0', 'jazz blues'],
};

// ---- voci di serie, tutte nello stesso formato di quelle create dalla dashboard ----
function diSerie() {
  const voci = [];
  const aggiungi = (tipo, chiave, campi) => voci.push({ id: `${tipo}:${chiave}`, tipo, ...campi });
  // shortcut: gli identificativi seguono la posizione nel codice; aggiungere in coda, non in mezzo
  for (const [stile, modi] of Object.entries(A.TESTI)) for (const [modo, ruoli] of Object.entries(modi)) for (const [ruolo, lista] of Object.entries(ruoli)) lista.forEach((testo, i) => aggiungi('armonia', `${stile}:${modo}:${ruolo}:${i}`, { stile, modo, ruolo, testo }));
  for (const [andamento, lista] of Object.entries(M.MOTIVI)) lista.forEach((testo, i) => aggiungi('motivo', `${andamento}:${i}`, { andamento, testo }));
  M.CADENZE.forEach((testo, i) => aggiungi('cadenza', i, { testo }));
  M.LICK.forEach(([ritmo, gesti], i) => aggiungi('assolo', i, { ritmo, gesti }));
  for (const [k, [nome, modo, accordi, note, stili]] of Object.entries(RICHIAMI)) aggiungi('richiamo', k, { nome, modo, accordi, note, stili: stili.split(' ').filter(Boolean) });
  for (const [k, [nome, testo, stili]] of Object.entries(FORME)) aggiungi('forma', k, { nome, testo, stili: stili.split(' ') });
  return voci;
}

// ---- controlli: lanciano un errore leggibile, restituiscono i soli campi del tipo ----
const testo = (v, nome, max = 600) => {
  const t = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!t || t.length > max || /[<>]/.test(t)) throw new Error(`${nome}: mancante, troppo lungo o con < >`);
  return t;
};
const tra = (v, voci, nome) => { if (!Object.hasOwn(voci, v)) throw new Error(`${nome} non valido`); return v; };
const battuteDi = (t) => t.split('|').map((b) => b.trim()).filter(Boolean);
const stiliDi = (v) => {
  const s = [...new Set([].concat(v || []))];
  if (!s.length || !s.every((x) => Object.hasOwn(STILI, x))) throw new Error('scegli almeno uno stile');
  return s;
};

function periodoDi(t, quante) {
  const battute = battuteDi(t);
  if (battute.length !== quante) throw new Error(`servono ${quante} battute separate da |, sono ${battute.length}`);
  return battute.map((b, i) => {
    const accordi = b.split(/\s+/);
    if (accordi.length > 2) throw new Error(`battuta ${i + 1}: al massimo due accordi`);
    return accordi.map((x) => {
      const g = A.grado(x);
      if (!Abc.noteAccordo(`C${g.tipo}`)) throw new Error(`battuta ${i + 1}: accordo non ammesso (${x})`);
      return g;
    });
  });
}

// ritmo scritto in trentaduesimi: "v8 -4 4 4~"
function battutaRitmica(b, n) {
  const figure = b.split(/\s+/);
  let somma = 0;
  figure.forEach((f, i) => {
    const m = /^(-|v)?([1-9]\d?)(~)?$/.exec(f);
    if (!m) throw new Error(`battuta ${n}: figura non riconosciuta (${f})`);
    if (m[3] && (i < figure.length - 1 || m[1] === '-')) throw new Error(`battuta ${n}: ~ va solo sull’ultima nota`);
    somma += Number(m[2]);
  });
  if (somma !== 32) throw new Error(`battuta ${n}: le durate fanno ${somma} invece di 32`);
  if (figure.every((f) => f.startsWith('-'))) throw new Error(`battuta ${n}: serve almeno una nota`);
  return figure.length;
}
function dueBattute(t) {
  const b = battuteDi(t);
  if (b.length !== 2) throw new Error(`servono 2 battute separate da |, sono ${b.length}`);
  b.forEach((x, i) => battutaRitmica(x, i + 1));
  return b.join(' | ');
}

const PC = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
// "Sol4:8 -:8" -> [[7, 8], [null, 8]] (semitoni dal Do centrale)
function noteDi(t) {
  const battute = battuteDi(t);
  if (battute.length < 1 || battute.length > 8) throw new Error('da 1 a 8 battute di note');
  return battute.map((b, i) => {
    const note = b.split(/\s+/).map((x) => {
      const m = /^(?:(-)|(do|re|mi|fa|sol|la|si)(#|b)?([2-6])):([1-9]\d?)$/i.exec(x);
      if (!m) throw new Error(`battuta ${i + 1}: nota non riconosciuta (${x}); scrivi per esempio Sol4:8 o -:8`);
      if (m[1]) return [null, Number(m[5])];
      const midi = 12 * (Number(m[4]) + 1) + PC[m[2].toLowerCase()] + (m[3] === '#' ? 1 : m[3] ? -1 : 0);
      if (midi < 48 || midi > 84) throw new Error(`battuta ${i + 1}: ${x} è fuori da Do3-Do6`);
      return [midi - 60, Number(m[5])];
    });
    const somma = note.reduce((a, n) => a + n[1], 0);
    if (somma !== 32) throw new Error(`battuta ${i + 1}: le durate fanno ${somma} invece di 32`);
    return note;
  });
}

function formaDi(t) {
  const sezioni = t.split(/\s+/).map((x) => {
    const m = /^([a-z]+):(\d+):(\d)$/.exec(x);
    if (!m || !SEZIONI.includes(m[1])) throw new Error(`sezione non riconosciuta: ${x} (ruoli: ${SEZIONI.join(', ')})`);
    const battute = Number(m[2]);
    if (battute < 2 || battute > 16) throw new Error(`${x}: da 2 a 16 battute`);
    return { ruolo: m[1], battute, priorita: Number(m[3]) };
  });
  if (sezioni.length < 3 || sezioni.length > 16) throw new Error('da 3 a 16 sezioni');
  if (sezioni.at(-1).ruolo !== 'finale' || sezioni.at(-1).priorita !== 0) throw new Error('l’ultima sezione deve essere finale:…:0');
  if (sezioni.filter((x) => x.priorita === 0).length < 2) throw new Error('almeno due sezioni con priorità 0 (sempre presenti)');
  return sezioni;
}

function controlla(v) {
  switch (v && v.tipo) {
    case 'armonia': {
      const campi = { stile: tra(v.stile, STILI, 'stile'), modo: tra(v.modo, { m: 1, M: 1 }, 'modo'), ruolo: tra(v.ruolo, RUOLI, 'ruolo'), testo: testo(v.testo, 'accordi') };
      periodoDi(campi.testo, campi.ruolo === 'pre' ? 4 : 8);
      return campi;
    }
    case 'motivo': return { andamento: tra(v.andamento, ANDAMENTI, 'andamento'), testo: dueBattute(testo(v.testo, 'ritmo')) };
    case 'cadenza': return { testo: dueBattute(testo(v.testo, 'ritmo')) };
    case 'assolo': {
      const ritmo = testo(v.ritmo, 'ritmo'), gesti = testo(v.gesti, 'gesti').replace(/ /g, '');
      if (ritmo.includes('|')) throw new Error('una frase d’assolo dura una battuta');
      const figure = battutaRitmica(ritmo, 1);
      if (gesti.length !== figure || [...gesti].some((g) => !GESTI[g])) throw new Error(`gesti: servono ${figure} lettere tra ${Object.keys(GESTI).join(' ')}`);
      return { ritmo, gesti };
    }
    case 'richiamo': {
      const campi = { nome: testo(v.nome, 'nome', 80), modo: tra(v.modo, { m: 1, M: 1 }, 'modo'), accordi: testo(v.accordi, 'accordi'), note: testo(v.note, 'note', 1200), stili: stiliDi(v.stili) };
      const note = noteDi(campi.note);
      periodoDi(campi.accordi, note.length);
      return campi;
    }
    case 'forma': {
      const campi = { nome: testo(v.nome, 'nome', 40), testo: testo(v.testo, 'sezioni'), stili: stiliDi(v.stili) };
      formaDi(campi.testo);
      return campi;
    }
    default: throw new Error('tipo di materiale sconosciuto');
  }
}

// Voci di serie con le modifiche, più quelle nuove. Una voce non valida resta in elenco con il suo errore.
function unisci(utente) {
  const u = utente || {};
  const modifiche = u.modifiche || {};
  const serie = diSerie().map((v) => {
    const m = modifiche[v.id];
    if (!m) return { ...v, serie: true, attivo: true };
    const { attivo, ...campi } = m;
    return { ...v, ...campi, id: v.id, tipo: v.tipo, serie: true, attivo: attivo !== false, modificata: Object.keys(campi).length > 0 };
  });
  const nuove = (Array.isArray(u.nuove) ? u.nuove : []).filter((v) => v && typeof v.id === 'string').map((v) => ({ ...v, serie: false, attivo: v.attivo !== false }));
  return [...serie, ...nuove].map((v) => { try { controlla(v); return v; } catch (e) { return { ...v, errore: e.message }; } });
}

const chiaveDi = (id) => id.split(':').slice(1).join(':');
// ripete una lista corta fino a n elementi
const almeno = (lista, n) => Array.from({ length: Math.max(n, lista.length) }, (_, i) => lista[i % lista.length]);

// Il materiale pronto per il compositore: solo voci attive e valide; un gruppo rimasto vuoto usa quelle di serie
function pronto(utente) {
  const voci = unisci(utente);
  const serie = unisci({});
  const buone = (test) => { const v = voci.filter((x) => x.attivo && !x.errore && test(x)); return v.length ? v : serie.filter(test); };
  const armonia = {};
  for (const stile of Object.keys(STILI)) {
    armonia[stile] = {};
    for (const modo of ['m', 'M']) {
      armonia[stile][modo] = Object.fromEntries(Object.keys(RUOLI).map((ruolo) => [ruolo,
        buone((x) => x.tipo === 'armonia' && x.stile === stile && x.modo === modo && x.ruolo === ruolo).map((x) => periodoDi(x.testo, ruolo === 'pre' ? 4 : 8))]));
    }
  }
  armonia.drone = armonia.cine;
  const motivi = Object.fromEntries(Object.keys(ANDAMENTI).map((a) => [a, almeno(buone((x) => x.tipo === 'motivo' && x.andamento === a).map((x) => x.testo), 6)]));
  const camei = {}, cameiPerStile = {}, forme = {}, formePerStile = {};
  for (const v of voci.filter((x) => x.attivo && !x.errore)) {
    if (v.tipo !== 'richiamo') continue;
    const k = chiaveDi(v.id), note = noteDi(v.note);
    camei[k] = { nome: v.nome, modo: v.modo, accordi: periodoDi(v.accordi, note.length), note };
    for (const s of v.stili) (cameiPerStile[s] ||= []).push(k);
  }
  for (const stile of Object.keys(STILI)) {
    for (const v of buone((x) => x.tipo === 'forma' && x.stili.includes(stile))) {
      forme[chiaveDi(v.id)] = formaDi(v.testo);
      (formePerStile[stile] ||= []).push(chiaveDi(v.id));
    }
    formePerStile[stile] ||= ['canzone'];
  }
  forme.canzone ||= formaDi(FORME.canzone[1]);
  cameiPerStile.drone = cameiPerStile.cine;
  formePerStile.drone = formePerStile.cine;
  return {
    armonia, motivi,
    cadenze: almeno(buone((x) => x.tipo === 'cadenza').map((x) => x.testo), 5),
    lick: buone((x) => x.tipo === 'assolo').map((x) => [x.ritmo, x.gesti]),
    camei, cameiPerStile, forme, formePerStile,
  };
}

if (typeof module !== 'undefined') module.exports = { STILI, ANDAMENTI, RUOLI, SEZIONI, GESTI, diSerie, controlla, unisci, pronto, periodoDi, noteDi, formaDi };
