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
function leggiRiga(riga, v, sezione, errori) {
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
      const durata = Number(cifre || 1);
      if (!AMMESSE.includes(durata)) errori.push(`battuta: durata non ammessa ${durata}`);
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
  if (k < 0 || !testa.includes('X:1') || campo('L:') !== '1/32' || !bpm || !unita(metro) || !armatura(tonalita)) errori.push('intestazione non valida');
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
    leggiRiga(r, voce, nomi.length - 1, errori);
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

module.exports = { scriviAbc, leggiAbc, durataSecondi, lyricsDaScore, unita, TAG };
