// Score ABC nel dialetto di YuE2: L:1/32, due voci monofoniche (Vocal con gli accordi, Ins con il tema).
// Il motore non corregge uno score fornito: tutto cio' che scriviamo passa da leggiAbc.
const AMMESSE = [48, 32, 24, 16, 12, 8, 6, 4, 3, 2, 1];
const ACCORDO = /^[A-G][#b]?(m\(maj7\)|maj7|m7b5|dim7|7sus4|sus4|sus2|dim|aug|m7|m6|m|7|6)?(\/[A-G][#b]?)?$/;
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUINTE = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
  Am: 0, Em: 1, Bm: 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, 'A#m': 7, Dm: -1, Gm: -2, Cm: -3, Fm: -4, Bbm: -5, Ebm: -6, Abm: -7,
};
const SEGNI = { '^^': 2, '^': 1, '=': 0, _: -1, __: -2 };
const TAG = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'];
const VOCI = ['V: Vocal clef=treble name="Vocal Melody" snm="Vocal"', 'V: Ins clef=treble name="Ins Melody" snm="Inst."'];

// Lunghezza di una battuta in trentaduesimi; null se il metro non e' valido
function unita(metro) {
  const m = /^(\d+)\/(1|2|4|8|16|32)$/.exec(metro || '');
  return m && Number(m[1]) > 0 ? (Number(m[1]) * 32) / Number(m[2]) : null;
}

function armatura(tonalita) {
  const q = QUINTE[tonalita];
  if (q === undefined) return null;
  const alt = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  const ordine = q > 0 ? 'FCGDAEB' : 'BEADGCF';
  for (let i = 0; i < Math.abs(q); i++) alt[ordine[i]] = Math.sign(q);
  return alt;
}

// Altezza MIDI -> testo ABC, tenendo conto delle alterazioni in vigore nella battuta (valide per lettera)
function nomeNota(midi, stato, tonalita) {
  const bemolli = QUINTE[tonalita] < 0;
  const lettere = Object.keys(BASE);
  const pc = (alt, l) => (((BASE[l] + alt) % 12) + 12) % 12;
  let segno = '';
  let lettera;
  // in minore la sesta e la settima alzate si scrivono sulla propria lettera (in Re minore Do#, non Reb)
  if (tonalita.endsWith('m')) {
    const tonica = lettere.indexOf(tonalita[0]);
    const pcTonica = BASE[tonalita[0]] + (tonalita[1] === '#' ? 1 : tonalita[1] === 'b' ? -1 : 0);
    for (const [gradi, semitoni] of [[6, 11], [5, 9]]) {
      const l = lettere[(tonica + gradi) % 7];
      const alt = ((midi - BASE[l] + 18) % 12) - 6;
      if ((midi - pcTonica + 24) % 12 !== semitoni || Math.abs(alt) > 2) continue;
      lettera = l;
      if (stato[l] !== alt) { segno = Object.keys(SEGNI).find((s) => SEGNI[s] === alt); stato[l] = alt; }
    }
  }
  lettera ||= lettere.find((l) => pc(stato[l], l) === midi % 12);
  if (!lettera) {
    lettera = lettere.find((l) => BASE[l] === midi % 12);
    if (lettera) segno = '=';
    else {
      const alt = bemolli ? -1 : 1;
      lettera = lettere.find((l) => pc(alt, l) === midi % 12);
      segno = bemolli ? '_' : '^';
    }
    stato[lettera] = SEGNI[segno];
  }
  const ottava = (midi - stato[lettera] - BASE[lettera]) / 12 - 1;
  const testo = ottava >= 5 ? lettera.toLowerCase() + "'".repeat(ottava - 5) : lettera + ','.repeat(4 - ottava);
  return segno + testo;
}

// Una nota o pausa di durata qualsiasi, spezzata nelle durate ammesse (le note restano legate)
function scriviEvento(e, stato, tonalita) {
  const pezzi = [];
  let resto = e.durata;
  while (resto > 0) {
    const d = AMMESSE.find((x) => x <= resto);
    if (!d) throw new Error(`battuta: durata non valida (${e.durata})`);
    pezzi.push(d);
    resto -= d;
  }
  if (e.midi === null) {
    if (e.lega) throw new Error('legatura su una pausa');
    return pezzi.map((d) => `z${d}`).join('');
  }
  return pezzi.map((d, i) => nomeNota(e.midi, stato, tonalita) + d + (i < pezzi.length - 1 || e.lega ? '-' : '')).join('');
}

// Una battuta di una voce: gli accordi spezzano l'evento in cui cadono (con legatura, se e' una nota)
function scriviBattuta(eventi, accordi, tonalita, lunghezza) {
  const alt = armatura(tonalita);
  if (!alt) throw new Error(`tonalità non valida: ${tonalita}`);
  const stato = { ...alt };
  const attesa = [...accordi].sort((a, b) => a.pos - b.pos);
  let pos = 0;
  let testo = '';
  for (const e of eventi || [{ midi: null, durata: lunghezza }]) {
    let inizio = pos;
    const fine = pos + e.durata;
    while (inizio < fine) {
      while (attesa.length && attesa[0].pos === inizio) testo += `"${attesa.shift().sigla}"`;
      const taglio = attesa.length && attesa[0].pos < fine ? attesa[0].pos : fine;
      testo += scriviEvento({ midi: e.midi, durata: taglio - inizio, lega: taglio < fine ? e.midi !== null : e.lega }, stato, tonalita);
      inizio = taglio;
    }
    pos = fine;
  }
  if (attesa.length) throw new Error(`battuta: accordo fuori posto (${attesa[0].sigla} in ${attesa[0].pos})`);
  return testo + '|';
}

function scriviAbc(score) {
  const righe = ['X:1', 'T:', `M:${score.metro}`, 'L:1/32', `Q:1/4=${score.bpm}`, ...VOCI, `K:${score.tonalita}`];
  const corrente = { Vocal: { M: score.metro, K: score.tonalita }, Ins: { M: score.metro, K: score.tonalita } };
  for (const s of score.sezioni) {
    const metro = s.metro || score.metro;
    const tonalita = s.tonalita || score.tonalita;
    const lunghezza = unita(metro);
    if (!lunghezza) throw new Error(`metro non valido: ${metro}`);
    righe.push(`% ${s.nome}`);
    for (let i = 0; i < s.battute.length; i += 4) {
      for (const voce of ['Vocal', 'Ins']) {
        righe.push(`V: ${voce}`);
        for (const [campo, valore] of [['M', metro], ['K', tonalita]]) {
          if (corrente[voce][campo] !== valore) { righe.push(`${campo}:${valore}`); corrente[voce][campo] = valore; }
        }
        let riga = '';
        let pause = 0;
        const chiudiPause = () => { if (pause) { riga += `Z${pause > 1 ? pause : ''}|`; pause = 0; } };
        for (const b of s.battute.slice(i, i + 4)) {
          const eventi = voce === 'Vocal' ? b.vocal : b.ins;
          const accordi = voce === 'Vocal' ? b.accordi || [] : [];
          if (!eventi && !accordi.length) { pause++; continue; }
          chiudiPause();
          riga += scriviBattuta(eventi, accordi, tonalita, lunghezza);
        }
        chiudiPause();
        righe.push(riga);
      }
    }
  }
  const testo = righe.join('\n') + '\n';
  const { errori } = leggiAbc(testo);
  if (errori.length) throw new Error(`score non valido: ${errori.join('; ')}`);
  return testo;
}

const PEZZO = /\s+|"([^"]*)"|Z(\d*)\||(\|)|(\^\^|\^|=|__|_)?([A-Ga-gz])([,']*)(\d*)(-?)/y;

// Legge una riga di musica di una voce e aggiunge le battute
function leggiRiga(riga, v, sezione, errori, fattore) {
  const nuova = () => ({ sezione, metro: v.M, tonalita: v.K, eventi: [], accordi: [], pos: 0 });
  let b = nuova();
  let stato = { ...(armatura(v.K) || {}) };
  PEZZO.lastIndex = 0;
  while (PEZZO.lastIndex < riga.length) {
    const da = PEZZO.lastIndex;
    const m = PEZZO.exec(riga);
    if (!m) { errori.push(`simbolo non ammesso: "${riga.slice(da, da + 12)}"`); return; }
    const [, accordo, zeta, sbarra, segno, lettera, ottave, cifre, lega] = m;
    if (accordo !== undefined) {
      if (v.nome !== 'Vocal') errori.push('accordo fuori dalla voce Vocal');
      if (!ACCORDO.test(accordo)) errori.push(`accordo non ammesso: ${accordo}`);
      b.accordi.push({ pos: b.pos, sigla: accordo });
    } else if (zeta !== undefined) {
      if (b.pos || b.accordi.length) errori.push('battuta: Z in mezzo a una battuta');
      if (v.legata) { errori.push('legatura interrotta da una pausa'); v.legata = null; }
      for (let i = 0; i < Number(zeta || 1); i++) v.battute.push({ ...nuova(), eventi: null });
      b = nuova();
    } else if (sbarra) {
      const attesa = unita(b.metro);
      if (b.pos !== attesa) errori.push(`battuta di ${b.pos}/32 invece di ${attesa} (voce ${v.nome}, n. ${v.battute.length + 1})`);
      v.battute.push(b);
      b = nuova();
      stato = { ...(armatura(v.K) || {}) };
    } else if (lettera) {
      // in L:1/32 (il nostro dialetto) le durate sono controllate; il motore scrive anche in L:1/16
      if (fattore === 1 && !AMMESSE.includes(Number(cifre || 1))) errori.push(`battuta: durata non ammessa ${cifre}`);
      const durata = Number(cifre || 1) * fattore;
      let midi = null;
      if (lettera !== 'z') {
        const L = lettera.toUpperCase();
        const ottava = (lettera === L ? 4 : 5) + [...ottave].reduce((n, c) => n + (c === "'" ? 1 : -1), 0);
        const grafia = L + ottava;
        if (segno) stato[L] = SEGNI[segno];
        midi = 12 * (ottava + 1) + BASE[L] + (stato[L] || 0);
        // una nota legata senza segno mantiene l'altezza anche oltre la stanghetta
        if (!segno && v.legata && v.legata.grafia === grafia) midi = v.legata.midi;
        if (v.legata && v.legata.midi !== midi) errori.push('legatura tra altezze diverse');
        v.legata = lega ? { midi, grafia } : null;
      } else {
        if (lega || segno || ottave) errori.push('legatura o segno su una pausa');
        if (v.legata) errori.push('legatura interrotta da una pausa');
        v.legata = null;
      }
      b.eventi.push({ midi, durata, ...(lega ? { lega: true } : {}) });
      b.pos += durata;
    }
  }
  if (b.pos || b.accordi.length) errori.push(`battuta non chiusa (voce ${v.nome})`);
}

function leggiAbc(testo) {
  const errori = [];
  const righe = String(testo).split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const k = righe.findIndex((r) => r.startsWith('K:'));
  const testa = righe.slice(0, k + 1);
  const campo = (p) => (testa.find((r) => r.startsWith(p)) || '').slice(p.length).trim();
  const metro = campo('M:');
  const tonalita = campo('K:');
  const bpm = Number((/^1\/4=(\d+)$/.exec(campo('Q:')) || [])[1]);
  const fattore = { '1/32': 1, '1/16': 2, '1/8': 4 }[campo('L:')];
  if (k < 0 || !testa.includes('X:1') || !fattore || !bpm || !unita(metro) || !armatura(tonalita)) errori.push('intestazione non valida');
  for (const v of ['Vocal', 'Ins']) if (!testa.some((r) => r.startsWith(`V: ${v} `))) errori.push(`voce ${v} non dichiarata`);
  if (errori.length) return { errori, score: null };

  const voci = Object.fromEntries(['Vocal', 'Ins'].map((nome) => [nome, { nome, M: metro, K: tonalita, battute: [], legata: null }]));
  const nomi = [];
  let voce = null;
  for (const r of righe.slice(k + 1)) {
    if (r.startsWith('%')) { nomi.push(r.slice(1).trim()); voce = null; continue; }
    if (r.startsWith('V:')) {
      voce = voci[r.slice(2).trim()] || null;
      if (!voce) errori.push(`voce non ammessa: ${r}`);
      continue;
    }
    if (!voce || !nomi.length) { errori.push(`riga fuori da una sezione o da una voce: ${r.slice(0, 20)}`); continue; }
    if (r.startsWith('M:')) { voce.M = r.slice(2).trim(); if (!unita(voce.M)) errori.push(`metro non valido: ${voce.M}`); continue; }
    if (r.startsWith('K:')) { voce.K = r.slice(2).trim(); if (!armatura(voce.K)) errori.push(`tonalità non valida: ${voce.K}`); continue; }
    leggiRiga(r, voce, nomi.length - 1, errori, fattore);
  }
  const { Vocal, Ins } = voci;
  if (Vocal.legata || Ins.legata) errori.push('legatura aperta alla fine dello score');
  if (!Ins.battute.length) errori.push('nessuna battuta');
  if (Vocal.battute.length !== Ins.battute.length) errori.push(`battute diverse tra le voci: ${Vocal.battute.length} e ${Ins.battute.length}`);
  else if (Vocal.battute.some((b, i) => b.sezione !== Ins.battute[i].sezione || b.metro !== Ins.battute[i].metro || b.tonalita !== Ins.battute[i].tonalita)) errori.push('battuta con sezione, metro o tonalità diversi tra le voci');

  const sezioni = nomi.map((nome, s) => {
    const indici = Ins.battute.map((b, i) => (b.sezione === s ? i : -1)).filter((i) => i >= 0);
    const prima = Ins.battute[indici[0]] || { metro, tonalita };
    return {
      nome,
      ...(prima.metro !== metro ? { metro: prima.metro } : {}),
      ...(prima.tonalita !== tonalita ? { tonalita: prima.tonalita } : {}),
      battute: indici.map((i) => {
        const v = Vocal.battute[i] || { accordi: [], eventi: null };
        const canta = (v.eventi || []).some((e) => e.midi !== null);
        return { accordi: v.accordi, vocal: canta ? v.eventi : null, ins: Ins.battute[i].eventi };
      }),
    };
  });
  return { errori, score: errori.length ? null : { bpm, metro, tonalita, sezioni } };
}

// Secondi di ogni sezione (Q: e' sempre in quarti: 8 trentaduesimi)
function durateSezioni(score) {
  return score.sezioni.map((s) => ((s.battute.length * unita(s.metro || score.metro)) / 8) * (60 / score.bpm));
}
function durataSecondi(score) {
  return durateSezioni(score).reduce((a, b) => a + b, 0);
}

// Mappa delle sezioni per il campo lyrics: solo i tag che la LoRA strumentale conosce
function lyricsDaScore(score, { forma, note = [] }) {
  const orologio = (s) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
  const durate = durateSezioni(score);
  let t = 0;
  return score.sezioni.map((s, i) => {
    const tag = s.nome === 'interlude' ? 'bridge' : s.nome;
    if (!TAG.includes(tag)) throw new Error(`sezione senza tag: ${s.nome}`);
    const da = t;
    t += durate[i];
    if (forma === 'tempi') return `[${tag} ${orologio(da)}-${orologio(t)}]`;
    if (forma === 'indicazioni' && note[i]) return `[${tag} - ${note[i]}]`;
    return `[${tag}]`;
  }).join('\n\n');
}

// Battuta con la melodia cantata spostata sullo strumento: il canto vince dove si sovrappone
function fondiBattuta(vocal, ins, lunghezza) {
  const celle = Array(lunghezza).fill(null);
  for (const eventi of [ins, vocal]) {
    let pos = 0;
    for (const e of eventi || []) {
      if (e.midi !== null) for (let i = pos; i < pos + e.durata; i++) celle[i] = { e, fine: i === pos + e.durata - 1 };
      pos += e.durata;
    }
  }
  const out = [];
  for (const c of celle) {
    const origine = c ? c.e : null;
    let ultimo = out[out.length - 1];
    if (ultimo && ultimo.origine === origine) ultimo.durata++;
    else out.push((ultimo = { origine, midi: origine ? origine.midi : null, durata: 1 }));
    // la legatura resta solo se il frammento arriva in fondo alla nota di partenza
    ultimo.lega = Boolean(c && c.fine && c.e.lega);
  }
  return out.map(({ midi, durata, lega }) => ({ midi, durata, ...(lega ? { lega } : {}) }));
}

// Da uno score del motore a uno strumentale: Vocal tiene solo gli accordi, Ins la melodia
function strumentale(testo) {
  const { errori, score } = leggiAbc(testo);
  if (!score) throw new Error(`score non valido: ${errori.slice(0, 3).join('; ')}`);
  const battute = [];
  for (const s of score.sezioni) {
    const lunghezza = unita(s.metro || score.metro);
    for (const b of s.battute) {
      if (b.vocal) b.ins = fondiBattuta(b.vocal, b.ins, lunghezza);
      b.vocal = null;
      battute.push(b);
    }
  }
  // una legatura rimasta senza la nota successiva alla stessa altezza si toglie
  const eventi = battute.flatMap((b) => b.ins || [{ midi: null }]);
  eventi.forEach((e, i) => { if (e.lega && (!eventi[i + 1] || eventi[i + 1].midi !== e.midi)) delete e.lega; });
  const tag = (nome) => (nome === 'interlude' ? 'bridge' : TAG.includes(nome) ? nome : 'verse');
  const perLyrics = { ...score, sezioni: score.sezioni.map((s) => ({ ...s, nome: tag(s.nome) })) };
  return { abc: scriviAbc(score), secondi: Math.round(durataSecondi(score)), lyrics: lyricsDaScore(perLyrics, { forma: 'semplice' }) };
}

// ---- Analisi, riparazione e modifiche (usate dalla produzione, dal gateway e dall'editor della dashboard) ----
const SEZIONI = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'interlude', 'outro', 'instrumental'];
const TIPI_ACCORDO = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], '7sus4': [0, 5, 7, 10], 'm(maj7)': [0, 3, 7, 11] };
const DIESIS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOLLI = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const classe = (nome) => (BASE[nome[0]] + (nome[1] === '#' ? 1 : nome[1] === 'b' ? -1 : 0) + 12) % 12;

// Sigla di un accordo -> note (classi 0-11) e basso
function noteAccordo(sigla) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sigla || '');
  if (!m || !TIPI_ACCORDO[m[2]]) return null;
  const radice = classe(m[1]);
  return { radice, note: TIPI_ACCORDO[m[2]].map((x) => (radice + x) % 12), basso: m[3] ? classe(m[3]) : radice };
}

function trasponiTonalita(tonalita, semitoni) {
  const minore = tonalita.endsWith('m');
  const pc = (classe(tonalita) + semitoni + 120) % 12;
  return Object.keys(QUINTE).filter((k) => k.endsWith('m') === minore && classe(k) === pc)
    .sort((a, b) => Math.abs(QUINTE[a]) - Math.abs(QUINTE[b]))[0];
}

function trasponi(score, semitoni) {
  const tonalita = trasponiTonalita(score.tonalita, semitoni);
  const accordo = (sigla, k) => {
    const nomi = QUINTE[k] < 0 ? BEMOLLI : DIESIS;
    return sigla.replace(/(^|\/)([A-G][#b]?)/g, (_, p, n) => p + nomi[(classe(n) + semitoni + 120) % 12]);
  };
  const eventi = (e) => e && e.map((n) => {
    if (n.midi === null) return { ...n };
    if (n.midi + semitoni < 24 || n.midi + semitoni > 100) throw new Error('trasposizione fuori dall\'estensione suonabile');
    return { ...n, midi: n.midi + semitoni };
  });
  return {
    ...score, tonalita,
    sezioni: score.sezioni.map((s) => {
      const k = s.tonalita ? trasponiTonalita(s.tonalita, semitoni) : tonalita;
      return { ...s, ...(s.tonalita ? { tonalita: k } : {}), battute: s.battute.map((b) => ({ accordi: (b.accordi || []).map((a) => ({ ...a, sigla: accordo(a.sigla, k) })), vocal: eventi(b.vocal), ins: eventi(b.ins) })) };
    }),
  };
}

// Toglie le legature rimaste senza la nota successiva alla stessa altezza (dopo un taglio o una modifica)
function sistemaLegature(score) {
  for (const voce of ['vocal', 'ins']) {
    const eventi = score.sezioni.flatMap((s) => s.battute.flatMap((b) => b[voce] || [{ midi: null }]));
    eventi.forEach((e, i) => { if (e.lega && (!eventi[i + 1] || eventi[i + 1].midi !== e.midi)) delete e.lega; });
  }
  return score;
}

// Misure di uno score: servono alla dashboard e ai controlli della produzione
function analizza(testo) {
  const { errori, score } = leggiAbc(testo);
  if (!score) return { errori, score: null };
  const durate = durateSezioni(score);
  const battute = score.sezioni.flatMap((s) => s.battute);
  const note = battute.flatMap((b) => [...(b.ins || []), ...(b.vocal || [])]).filter((n) => n.midi !== null);
  const piene = battute.filter((b) => b.ins && b.ins.some((n) => n.midi !== null));
  let forti = 0, buone = 0, accordo = null, cambi = 0;
  for (const b of battute) {
    const primo = (b.accordi || []).find((a) => a.pos === 0);
    cambi += (b.accordi || []).filter((a) => { const nuovo = a.sigla !== accordo; accordo = a.sigla; return nuovo; }).length;
    const sigla = primo ? primo.sigla : accordo;
    const prima = b.ins && b.ins[0];
    if (!sigla || !prima || prima.midi === null) continue;
    const c = noteAccordo(sigla);
    if (!c) continue;
    forti++;
    if (c.note.includes(prima.midi % 12)) buone++;
  }
  return {
    errori, score,
    secondi: Math.round(durate.reduce((a, b) => a + b, 0)),
    bpm: score.bpm, metro: score.metro, tonalita: score.tonalita,
    battute: battute.length,
    sezioni: score.sezioni.map((s, i) => ({ nome: s.nome, battute: s.battute.length, secondi: Math.round(durate[i]) })),
    note: note.length,
    estensione: note.length ? [Math.min(...note.map((n) => n.midi)), Math.max(...note.map((n) => n.midi))] : null,
    accordi: cambi,
    // quota di battute melodiche che ripetono una battuta già sentita
    ripetizione: piene.length ? Math.round((1 - new Set(piene.map((b) => JSON.stringify(b.ins))).size / piene.length) * 100) / 100 : 0,
    // quota di battute che iniziano con una nota dell'accordo
    accordoSulBattere: forti ? Math.round((buone / forti) * 100) / 100 : null,
    voce: battute.some((b) => b.vocal && b.vocal.some((n) => n.midi !== null)),
  };
}

// Recupera uno score troncato, con una riga rovinata o troppo lungo: tiene l'inizio fino a un confine
// valido (meglio la fine di una sezione) il più vicino possibile alla durata richiesta. null se non basta.
function ripara(testo, { obiettivo = 0, minimo = 0, massimo = 330 } = {}) {
  const righe = String(testo).split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const k = righe.findIndex((r) => r.startsWith('K:'));
  if (k < 0) return null;
  const confine = (r) => r === undefined || r.startsWith('%') || /^V:\s*Vocal$/.test(r);
  const buoni = [];
  for (let taglio = righe.length; taglio > k + 1; taglio--) {
    if (!confine(righe[taglio])) continue;
    const parte = righe.slice(0, taglio);
    // una legatura rimasta aperta sul taglio si chiude: ultima riga di musica di ogni voce
    let aperte = 2;
    for (let i = parte.length - 1; i > k && aperte; i--) if (parte[i].endsWith('|')) { parte[i] = parte[i].replace(/-\|$/, '|'); aperte--; }
    const { score } = leggiAbc(parte.join('\n'));
    if (!score) continue;
    score.sezioni = score.sezioni.filter((s) => s.battute.length);
    const secondi = durataSecondi(score);
    if (secondi > massimo || secondi < minimo) continue;
    buoni.push({ score, secondi, sezioneIntera: righe[taglio] === undefined || righe[taglio].startsWith('%'), intero: taglio === righe.length });
  }
  if (!buoni.length) return null;
  const meta = obiettivo || massimo;
  const distanza = (b) => Math.abs(b.secondi - meta);
  const interi = buoni.filter((b) => b.sezioneIntera && distanza(b) <= meta * 0.2);
  const scelto = buoni.find((b) => b.intero && (!obiettivo || distanza(b) <= meta * 0.2))
    || (interi.length ? interi : buoni).reduce((a, b) => (distanza(b) < distanza(a) ? b : a));
  const prima = righe.filter((r) => r.endsWith('|')).length;
  const score = sistemaLegature(scelto.score);
  // dopo un taglio l'ultima sezione fa da chiusura: il motore riceve il segnale di finire
  if (!scelto.intero) score.sezioni[score.sezioni.length - 1].nome = 'outro';
  const abc = scriviAbc(score);
  return { abc, secondi: Math.round(scelto.secondi), tagliato: !scelto.intero || abc.split('\n').filter((r) => r.endsWith('|')).length < prima };
}

const tagDi = (nome) => (nome === 'interlude' ? 'bridge' : TAG.includes(nome) ? nome : 'verse');
const lyricsDi = (score) => lyricsDaScore({ ...score, sezioni: score.sezioni.map((s) => ({ ...s, nome: tagDi(s.nome) })) }, { forma: 'semplice' });

// ---- Impostazioni: come nascono gli score dei brani nuovi (config\score.json) ----
const IMPOSTAZIONI = [
  { chiave: 'fonte', gruppo: 'Chi scrive', etichetta: 'Chi scrive lo score', scelte: [['auto', 'Automatico, secondo l’estro'], ['modello', 'Modello YuE2, compositore di riserva'], ['compositore', 'Compositore del progetto'], ['motore', 'Motore durante il render']], def: 'auto', descrizione: 'Vale per i brani strumentali. I generi con voci usano sempre il motore.' },
  { chiave: 'estro', gruppo: 'Chi scrive', etichetta: 'Estro', scelte: [['auto', 'Automatico dal genere'], ['quiete', 'Quiete: ripetizione voluta'], ['vivo', 'Vivo: tema, variazioni leggere, un assolo'], ['pieno', 'Pieno: anche cambi di tonalità e richiami']], def: 'auto', descrizione: 'Quanto il brano cambia mentre suona. Quiete per meditazione e yoga, pieno per la musica da ascolto.' },
  { chiave: 'tentativi', gruppo: 'Modello YuE2', etichetta: 'Tentativi del modello', min: 1, max: 5, passo: 1, def: 3, descrizione: 'Quanti score si chiedono prima di passare al compositore. Ogni tentativo costa circa due minuti.' },
  { chiave: 'ripara', gruppo: 'Modello YuE2', etichetta: 'Recupera gli score troncati o troppo lunghi', si: true, def: true, descrizione: 'Taglia lo score a un confine di sezione vicino alla durata richiesta invece di buttarlo.' },
  { chiave: 'durataMinima', gruppo: 'Modello YuE2', etichetta: 'Durata minima accettata', min: 0.5, max: 1, passo: 0.05, def: 0.75, descrizione: 'Frazione della durata richiesta sotto cui lo score si rifiuta.' },
  { chiave: 'ripetizioneMax', gruppo: 'Modello YuE2', etichetta: 'Ripetizione massima', min: 0.5, max: 1, passo: 0.05, def: 1, descrizione: 'Quota di battute melodiche ripetute oltre cui lo score si rifiuta. 1 = nessun limite.' },
  { chiave: 'temperature', gruppo: 'Campionamento', etichetta: 'Temperatura', min: 0.1, max: 1.5, passo: 0.05, def: 0.7, descrizione: 'Più alta: melodie più imprevedibili e più errori di scrittura.' },
  { chiave: 'top_p', gruppo: 'Campionamento', etichetta: 'Top-p', min: 0.5, max: 1, passo: 0.01, def: 0.9, descrizione: 'Quanta parte delle scelte probabili resta in gioco.' },
  { chiave: 'top_k', gruppo: 'Campionamento', etichetta: 'Top-k', min: 1, max: 200, passo: 1, def: 30, descrizione: 'Numero massimo di scelte considerate a ogni passo.' },
  { chiave: 'repetition_penalty', gruppo: 'Campionamento', etichetta: 'Penalità di ripetizione', min: 1, max: 1.2, passo: 0.005, def: 1.005, descrizione: 'Scoraggia il modello dal ripetersi. Valori alti rompono la notazione.' },
  { chiave: 'penalty_window', gruppo: 'Campionamento', etichetta: 'Finestra della penalità', min: 0, max: 500, passo: 10, def: 100, descrizione: 'Quanti simboli indietro guarda la penalità.' },
  { chiave: 'max_tokens', gruppo: 'Campionamento', etichetta: 'Lunghezza massima dello score', min: 1000, max: 12000, passo: 500, def: 6000, descrizione: 'Simboli oltre cui lo score si interrompe: circa 6000 per sei minuti.' },
  { chiave: 'armonia', gruppo: 'Campionamento', etichetta: 'Varietà armonica', min: 0, max: 10, passo: 1, def: 0, descrizione: 'Spinge il modello a non ripetere lo stesso giro di accordi. 0 = spenta; sperimentale.' },
  { chiave: 'candidati', gruppo: 'Compositore', etichetta: 'Score provati per brano', min: 5, max: 200, passo: 5, def: 30, descrizione: 'Il compositore ne scrive tanti e il revisore tiene il migliore.' },
  { chiave: 'metri', gruppo: 'Compositore', etichetta: 'Cambi di metro nel ponte', si: true, def: true, descrizione: 'Permette 3/4 o 7/8 nei generi che li sopportano.' },
];

function valoreValido(def, v) {
  if (def.scelte) return def.scelte.some(([x]) => x === v);
  if (def.si) return typeof v === 'boolean';
  return typeof v === 'number' && v >= def.min && v <= def.max && (def.passo !== 1 || Number.isInteger(v));
}

// Valori in vigore per un genere: predefiniti, poi generali, poi del genere. I valori non validi si ignorano.
function impostazioni(conf, categoria) {
  const strati = [(conf || {}).generale, ((conf || {}).generi || {})[categoria]];
  return Object.fromEntries(IMPOSTAZIONI.map((d) => {
    let v = d.def;
    for (const s of strati) if (s && valoreValido(d, s[d.chiave])) v = s[d.chiave];
    return [d.chiave, v];
  }));
}

// "auto" si risolve col genere: livello 0 quiete, 1 vivo, 2 pieno (campo estro del catalogo)
function risolvi(imp, cat) {
  const c = cat || {};
  const livello = { quiete: 0, vivo: 1, pieno: 2 }[imp.estro] ?? c.estro ?? (c.ambito === 'musica' ? 2 : 0);
  return { ...imp, livello, fonte: imp.fonte === 'auto' ? (livello ? 'compositore' : 'modello') : imp.fonte };
}

// Parte della richiesta al motore che riguarda la scrittura dello score
function campionamento(imp) {
  const abc = { max_tokens: imp.max_tokens };
  for (const d of IMPOSTAZIONI) if (['temperature', 'top_p', 'top_k', 'repetition_penalty', 'penalty_window'].includes(d.chiave) && imp[d.chiave] !== d.def) abc[d.chiave] = imp[d.chiave];
  return { abc_sampling: abc, ...(imp.armonia ? { harmony: { strength: imp.armonia } } : {}) };
}

// ---- Score scelti a mano per i brani da produrre ----
const SECONDI_MANUALE = [30, 330];
const NOMI = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const nomeTonalita = (k) => `${NOMI[k[0]]}${k[1] === 'b' ? ' bemolle' : k[1] === '#' ? ' diesis' : ''} ${k.endsWith('m') ? 'minore' : 'maggiore'}`;

// La richiesta in attesa per un brano: prima quelle fatte per quel titolo, poi quelle per il genere
function richiestaPer(richieste, usati, concept) {
  const libere = (richieste || []).filter((r) => !(usati || {})[r.id] && r.categoria === concept.categoria);
  return libere.find((r) => r.titolo === concept.titolo) || libere.find((r) => !r.titolo) || null;
}

// Il brano prende dallo score velocità, tonalità, durata e sezioni; lo stile si allinea
function applica(concept, richiesta) {
  const a = analizza(richiesta.abc);
  if (!a.score) throw new Error(`score non valido: ${a.errori.slice(0, 3).join('; ')}`);
  const inglese = `${a.tonalita.replace(/m$/, '')} ${a.tonalita.endsWith('m') ? 'minor' : 'major'}`;
  const lyrics = lyricsDi(a.score);
  const out = {
    ...concept, abc: richiesta.abc, scoreManuale: richiesta.id, lyrics, sezioni: lyrics.split('\n\n'),
    bpm: a.bpm, tonalita: nomeTonalita(a.tonalita), durata_s: a.secondi,
    style: String(concept.style || '').replace(/\b\d+ BPM\b/, `${a.bpm} BPM`).replace(/\b[A-G][#b]? (major|minor)\b/, inglese),
  };
  delete out.score;
  return out;
}

module.exports = { strumentale, scriviAbc, leggiAbc, durataSecondi, lyricsDaScore, unita, TAG, SEZIONI, noteAccordo, trasponi, sistemaLegature, analizza, ripara, lyricsDi, IMPOSTAZIONI, valoreValido, impostazioni, risolvi, campionamento, SECONDI_MANUALE, nomeTonalita, richiestaPer, applica };
