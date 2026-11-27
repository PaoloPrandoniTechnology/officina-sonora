// Compositore e revisore degli score. Per ogni brano genera molti candidati (forma, armonia, tema e sviluppo),
// li valuta e tiene il migliore. Deterministico dato il seed. Le regole musicali sono in docs\score-abc.md.
const Abc = typeof ScoreAbc !== 'undefined' ? ScoreAbc : require('./abc.js');

const NOTE = { do: ['C', 0], re: ['D', 2], mi: ['E', 4], fa: ['F', 5], sol: ['G', 7], la: ['A', 9], si: ['B', 11] };
const TONALITA_ABC = 'Cb Gb Db Ab Eb Bb F C G D A E B F# C# Abm Ebm Bbm Fm Cm Gm Dm Am Em Bm F#m C#m G#m D#m A#m'.split(' ');
const DIESIS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOLLI = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// "Si bemolle maggiore" -> { sigla: 'Bb', pc: 10, minore: false }; se non riconosciuta, La minore
function tonica(nome) {
  const m = /^(do|re|mi|fa|sol|la|si)( bemolle| diesis)? (maggiore|minore)$/.exec(String(nome || '').trim().toLowerCase());
  if (m) {
    const [lettera, pc] = NOTE[m[1]];
    const alt = m[2] === ' bemolle' ? -1 : m[2] === ' diesis' ? 1 : 0;
    const minore = m[3] === 'minore';
    const sigla = lettera + (alt < 0 ? 'b' : alt > 0 ? '#' : '') + (minore ? 'm' : '');
    if (TONALITA_ABC.includes(sigla)) return { sigla, pc: (pc + alt + 12) % 12, minore };
  }
  return { sigla: 'Am', pc: 9, minore: true };
}

const SCALE = {
  minore: [0, 2, 3, 5, 7, 8, 10], maggiore: [0, 2, 4, 5, 7, 9, 11], dorico: [0, 2, 3, 5, 7, 9, 10],
  pentaMinore: [0, 3, 5, 7, 10], pentaMaggiore: [0, 2, 4, 7, 9], armonica: [0, 2, 3, 5, 7, 8, 11], frigiaDominante: [0, 1, 4, 5, 7, 8, 10],
};
const QUALITA = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], m7b5: [0, 3, 6, 10], dim: [0, 3, 6], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9] };

// Progressioni per carattere: "semitoni:qualita'" dalla tonica; m = tonalita' minori, M = maggiori
const ARMONIE = {
  drone: { m: ['0:m 0:m 8:maj7 0:m', '0:sus2 5:sus2 0:sus2 10:sus2', '0:m7 3:maj7 0:m7 5:sus4'], M: ['0:sus2 0: 5:maj7 0:', '0:maj7 5:maj7 0:maj7 7:sus4', '0: 9:m7 5:sus2 0:'] },
  rock: { m: ['0:m 8: 10: 0:m', '0:m 5:m 7:7 7:7', '8: 10: 0:m 0:m', '0:m 3: 10: 5:'], M: ['0: 5: 7: 5:', '0: 10: 5: 0:', '9:m 5: 0: 7:'] },
  blues: { m: ['0:m 0:m 5:m 0:m 7:7 5:m 0:m 7:7', '0:m 5:m 0:m 7:7'], M: ['0:7 0:7 5:7 0:7 7:7 5:7 0:7 7:7', '0:6 5:7 0:6 7:7'] },
  jazz: { m: ['0:m7 5:m7 10:7 3:maj7', '2:m7b5 7:7 0:m6 0:m7', '8:maj7 2:m7b5 7:7 0:m7', '0:m7 8:maj7 2:m7b5 7:7'], M: ['0:maj7 9:m7 2:m7 7:7', '4:m7 9:7 2:m7 7:7', '5:maj7 5:m6 4:m7 9:7', '0:6 2:7 2:m7 7:7'] },
  funk: { m: ['0:m7 5:7', '0:m7 0:m7 8:maj7 7:7', '5:m7 10:7 0:m7 0:m7'], M: ['0:7 5:7', '0:maj7 4:m7 5:maj7 7:sus4', '2:m7 7:7 0:maj7 9:m7'] },
  elettro: { m: ['0:m 0:m 8: 10:', '0:m 3: 8: 5:m', '8: 10: 0:m 7:sus4'], M: ['0: 7: 9:m 5:', '9:m 5: 0: 7:', '0:sus2 5: 9:m 7:sus4'] },
  cine: { m: ['0:m 8: 3: 10:', '0:m 8:maj7 5:m 7:7', '5:m 0:m 8: 7:sus4'], M: ['0: 4:m 5: 5:m', '0: 7: 9:m 4:m', '5:maj7 7: 4:m 9:m'] },
  folk: { m: ['0:m 10: 0:m 10:', '0:m 3: 10: 0:m', '8: 3: 10: 0:m'], M: ['0: 5: 0: 7:', '0: 10: 5: 0:', '9:m 5: 0: 7:sus4'] },
  balcanico: { m: ['0:m 5:m 7:7 0:m', '5:m 0:m 7:7 0:m', '8: 7:7 8: 7:7'], M: ['0: 1: 0: 10:m', '5:m 1: 0: 0:'] },
  flamenco: { m: ['5:m 3: 1: 0:', '0: 1: 0: 10:m', '8:7 7: 1:maj7 0:'], M: ['0: 1: 0: 1:', '5:m 3: 1: 0:'] },
};

function profilo(cat, t) {
  const n = cat.name;
  const stile = {
    'Jazz-lounge': 'jazz', 'Bossa-nova-chitarra': 'jazz', 'Manouche-swing': 'jazz',
    'Blues-shuffle-strumentale': 'blues', 'Rockabilly-strumentale': 'blues',
    'Post-rock-strumentale': 'cine', 'Piano-minimalista': 'cine', 'Score-cinematico': 'cine',
    'Reggae-dub-morbido': 'funk', 'Funk-groove': 'funk', 'Afro-latin-groove': 'funk', 'Trip-hop-dolce': 'funk', 'Beat-hip-hop': 'funk',
    'Folk-balcanico': 'balcanico', 'Flamenco-chitarra': 'flamenco', 'Celtic-arpa-whistle': 'folk', 'Folk-strumming': 'folk', 'Hatha-base': 'folk',
    'Gamelan-ambient': 'drone',
  }[n] || { rock: 'rock', elettronico: 'elettro', ritmico: 'elettro', meditativo: 'drone' }[cat.famiglia] || 'cine';
  const scala = stile === 'flamenco' ? 'frigiaDominante' : stile === 'balcanico' && t.minore ? 'armonica'
    : stile === 'blues' || stile === 'folk' || stile === 'drone' ? (t.minore ? 'pentaMinore' : 'pentaMaggiore')
      : stile === 'funk' && t.minore ? 'dorico' : t.minore ? 'minore' : 'maggiore';
  // metro alternativo per il bridge, dove il genere lo sopporta
  const metroBridge = { cine: '3/4', folk: '3/4', balcanico: '7/8' }[stile];
  return { stile, scala: SCALE[scala], energia: cat.energia || 3, metroBridge };
}

// Celle ritmiche di una battuta di 4/4 in trentaduesimi (8 = quarto); numeri negativi = pause
const CELLE = {
  1: [[32], [24, 8], [16, 16], [-8, 24], [16, 8, 8], [12, 4, 16]],
  2: [[16, 8, 8], [8, 8, 16], [12, 4, 16], [16, 16], [-8, 8, 16], [24, 4, 4]],
  3: [[8, 8, 8, 8], [12, 4, 8, 8], [8, 4, 4, 16], [4, 4, 8, 8, 8], [-4, 4, 8, 8, 8], [12, 12, 8], [6, 2, 8, 16]],
  4: [[4, 4, 4, 4, 8, 8], [6, 6, 4, 8, 8], [8, 4, 4, 4, 4, 8], [4, 4, 8, 4, 4, 8], [-4, 4, 4, 4, 12, 4], [12, 4, 8, 4, 4]],
  5: [[4, 4, 4, 4, 4, 4, 4, 4], [2, 2, 4, 8, 4, 4, 8], [4, 2, 2, 4, 4, 8, 4, 4], [6, 6, 4, 4, 4, 8], [-4, 4, 4, 4, 4, 4, 8]],
};
const PESI = { intro: 1, verse: 2, 'pre-chorus': 1, chorus: 2, bridge: 1.5, outro: 1 };
const CENTRI = { intro: 64, verse: 66, 'pre-chorus': 69, chorus: 74, bridge: 68, outro: 65 };

function casuale(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const scegli = (r, v) => v[Math.floor(r() * v.length)];

// Battute per sezione, pari, la cui somma si avvicina alla durata richiesta
function battutePerSezione(nomi, totale) {
  const somma = nomi.reduce((a, n) => a + PESI[n], 0);
  const out = nomi.map((n) => Math.max(2, 2 * Math.round((PESI[n] * totale) / somma / 2)));
  for (let giro = 0; giro < 200; giro++) {
    const diff = totale - out.reduce((a, b) => a + b, 0);
    if (Math.abs(diff) < 2) break;
    const candidati = out.map((b, i) => i).filter((i) => diff > 0 || out[i] > 2)
      .sort((a, b) => (diff > 0 ? out[a] / PESI[nomi[a]] - out[b] / PESI[nomi[b]] : out[b] / PESI[nomi[b]] - out[a] / PESI[nomi[a]]));
    if (!candidati.length) break;
    out[candidati[0]] += diff > 0 ? 2 : -2;
  }
  return out;
}

// Adatta una cella alla lunghezza della battuta: taglia, e l'ultimo evento riempie il resto
function adatta(cella, lunghezza) {
  const out = [];
  let pos = 0;
  for (const d of cella) {
    if (pos >= lunghezza) break;
    const durata = Math.min(Math.abs(d), lunghezza - pos);
    out.push(Math.sign(d) * durata);
    pos += durata;
  }
  if (pos < lunghezza) out[out.length - 1] += Math.sign(out[out.length - 1]) * (lunghezza - pos);
  return out;
}

const MOSSE = [-1, -1, -1, 1, 1, 1, -2, 2, 0, 3];
const TRASFORMAZIONI = ['sequenza', 'inversione', 'ornamento', 'sposta'];

// ---- Memoria: identita' del genere (omogeneita'), preferenze dai voti, somiglianza tra brani ----

function quanteProgressioni(cat, tonalita) {
  const t = tonica(tonalita);
  return ARMONIE[profilo(cat, t).stile][t.minore ? 'm' : 'M'].length;
}

// Peso di un elemento in base ai voti dei brani che lo hanno usato (1 = nessun voto)
function peso(preferenze, chiave) {
  const e = preferenze[chiave];
  return e ? Math.max(0.25, Math.min(2, 1 + e.somma / e.n / 2)) : 1;
}

function preferenze(brani, voti) {
  const out = {};
  for (const b of brani) {
    const voto = voti[b.seed];
    if (!voto || !b.parametri) continue;
    const chiavi = [
      ...b.parametri.progressioni.map((x) => `prog:${x}`),
      ...b.parametri.celle.map((x) => `cella:${x}`),
      ...b.parametri.trasformazioni.map((x) => `trasf:${x}`),
    ];
    for (const k of chiavi) {
      out[k] ||= { n: 0, somma: 0 };
      out[k].n++;
      out[k].somma += voto - 3;
    }
  }
  return out;
}

function pesato(r, voci, pesoDi) {
  let x = r() * voci.reduce((a, v) => a + pesoDi(v), 0);
  for (const v of voci) { x -= pesoDi(v); if (x <= 0) return v; }
  return voci[voci.length - 1];
}

// Il materiale che rende riconoscibile un genere: scelto una volta, poi cambia solo cio' che i voti bocciano
function identita(cat, esistente, pref = {}, seme = 0) {
  const r = casuale([...cat.name].reduce((a, c) => Math.imul(a, 31) + c.charCodeAt(0), seme));
  const t = tonica((cat.tonalita || [])[0]);
  const p = profilo(cat, t);
  const armonie = ARMONIE[p.stile];
  const indici = (n) => [...Array(n).keys()];
  const estrai = (voci, quanti) => {
    const resto = [...voci];
    return indici(Math.min(quanti, voci.length)).map(() => resto.splice(Math.floor(r() * resto.length), 1)[0]);
  };
  const tutteProg = indici(Math.max(armonie.m.length, armonie.M.length));
  if (!esistente) {
    return {
      progressioni: estrai(tutteProg, 3),
      celle: Object.fromEntries(Object.entries(CELLE).map(([l, c]) => [l, estrai(indici(c.length), 4)])),
      trasformazioni: estrai(TRASFORMAZIONI, 3),
      metroBridge: Boolean(p.metroBridge) && r() < 0.7,
      registro: scegli(r, [-2, 0, 2]),
    };
  }
  // un elemento con almeno due voti e media 2 o meno lascia il posto a uno non ancora usato
  const rinnova = (usati, tutti, chiave) => {
    const liberi = tutti.filter((x) => !usati.includes(x));
    return usati.map((x) => {
      const e = pref[chiave(x)];
      return e && e.n >= 2 && e.somma / e.n <= -1 && liberi.length ? liberi.splice(Math.floor(r() * liberi.length), 1)[0] : x;
    });
  };
  return {
    ...esistente,
    progressioni: rinnova(esistente.progressioni, tutteProg, (x) => `prog:${x}`),
    celle: Object.fromEntries(Object.entries(esistente.celle).map(([l, c]) => [l, rinnova(c, indici(CELLE[l].length), (x) => `cella:${l}:${x}`)])),
    trasformazioni: rinnova(esistente.trasformazioni, TRASFORMAZIONI, (x) => `trasf:${x}`),
  };
}

// 0 = brano del tutto nuovo, 1 = stesso tema, ritmi e armonie
function somiglianza(a, b) {
  return (a.tema === b.tema ? 0.15 : 0) + (a.mosse === b.mosse ? 0.5 : 0) + (a.ritornello === b.ritornello ? 0.15 : 0) + (a.progressioni === b.progressioni ? 0.2 : 0);
}

function candidato(r, { cat, bpm, tonalita, durata_s, sezioni }, id, pref) {
  const t = tonica(tonalita);
  const p = profilo(cat, t);
  const nomi = sezioni.map((s) => s.replace(/[[\]]/g, ''));
  const quante = battutePerSezione(nomi, Math.round((durata_s * bpm) / 240));
  const nomiAccordi = /b|^(F|Dm|Gm|Cm|Fm)$/.test(t.sigla) ? BEMOLLI : DIESIS;
  const accordo = (testo) => {
    const [semi, q] = testo.split(':');
    const radice = (t.pc + Number(semi)) % 12;
    return { sigla: nomiAccordi[radice] + q, pcs: QUALITA[q].map((x) => (radice + x) % 12) };
  };
  const progressioni = ARMONIE[p.stile][t.minore ? 'm' : 'M'];
  // ordine delle progressioni del genere: le piu' votate hanno piu' possibilita' di aprire il brano
  const resto = [...id.progressioni];
  const ordine = id.progressioni.map(() => resto.splice(resto.indexOf(pesato(r, resto, (x) => peso(pref, `prog:${x}`))), 1)[0]);
  const usate = { progressioni: new Set(), celle: new Set(), trasformazioni: new Set() };
  const progDi = (n) => {
    const indice = ordine[({ chorus: 1, bridge: 2, 'pre-chorus': 2 }[n] || 0) % ordine.length];
    usate.progressioni.add(indice);
    return progressioni[indice % progressioni.length].split(' ').map(accordo);
  };
  const tonicaFinale = accordo(`0:${p.stile === 'flamenco' ? '' : t.minore ? 'm' : ''}`);
  const dominante = accordo('7:7');

  // tutte le altezze della scala nell'estensione suonabile
  const gradi = [];
  for (let m = 55; m <= 88; m++) if (p.scala.includes((m - t.pc + 120) % 12)) gradi.push(m);
  const vicino = (midi, ammesse) => ammesse.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
  const diAccordo = (midi, c) => {
    const note = [];
    for (let m = 55; m <= 88; m++) if (c.pcs.includes(m % 12)) note.push(m);
    return vicino(midi, note);
  };

  const livello = (n) => Math.max(1, Math.min(5, p.energia - (n === 'intro' || n === 'outro' || n === 'bridge' ? 1 : 0)));
  const temi = {};
  const motivo = (l) => [0, 1].map(() => {
    const i = pesato(r, id.celle[l], (x) => peso(pref, `cella:${l}:${x}`));
    usate.celle.add(`${l}:${i}`);
    return { ritmo: CELLE[l][i], mosse: CELLE[l][i].map(() => scegli(r, MOSSE)) };
  });
  const tema = (n) => (temi[n] ||= motivo(livello(n)));
  const volte = {};
  const spostamento = (p.stile === 'drone' ? -4 : 0) + id.registro;

  const scoreSezioni = nomi.map((nome, s) => {
    const volta = (volte[nome] = (volte[nome] || 0) + 1) - 1;
    const metro = nome === 'bridge' && id.metroBridge && p.metroBridge ? p.metroBridge : undefined;
    const lunghezza = Abc.unita(metro || '4/4');
    // con un metro diverso si ricalcola il numero di battute per conservare la durata
    const n = Math.max(2, 2 * Math.round((quante[s] * 32) / lunghezza / 2));
    const prog = progDi(nome);
    const passo = p.energia <= 2 ? 2 : 1; // nei generi calmi un accordo dura due battute
    const centro = CENTRI[nome] + spostamento + (volta && nome === 'chorus' ? 2 : 0);
    const m = tema(nome);
    const trasforma = volta ? pesato(r, id.trasformazioni, (x) => peso(pref, `trasf:${x}`)) : 'esposizione';
    if (volta) usate.trasformazioni.add(trasforma);
    let ultima = vicino(centro, gradi);

    const battute = Array.from({ length: n }, (_, i) => {
      const fineBrano = s === nomi.length - 1 && i === n - 1;
      let c = prog[Math.floor(i / passo) % prog.length];
      if (nome === 'pre-chorus' && i === n - 1) c = dominante;
      if (fineBrano) c = tonicaFinale;
      const accordi = [{ pos: 0, sigla: c.sigla }];
      if (fineBrano) return { accordi, vocal: null, ins: [{ midi: vicino(centro, gradi.filter((g) => g % 12 === t.pc)), durata: lunghezza }] };
      if (nome === 'intro' && i < Math.floor(n / 2)) return { accordi, vocal: null, ins: null };

      // frase di quattro battute: a, b, a variata, cadenza (nella seconda frase cambia la risposta)
      const nella = i % 4;
      const frase = Math.floor(i / 4);
      const cadenza = nella === 3 || i === n - 1;
      const cella = m[nella === 1 ? 1 : 0];
      let ritmo = cella.ritmo;
      let mosse = cella.mosse;
      if (cadenza) {
        ritmo = nome === 'bridge' && i === n - 1 ? [8, -24] : nome === 'pre-chorus' && i === n - 1 ? [8, 8, 4, 4, 4, 4] : frase % 2 ? [8, 24] : [8, 8, 16];
        mosse = nome === 'pre-chorus' ? ritmo.map(() => 1) : ritmo.map(() => -1);
      } else if (trasforma === 'inversione') mosse = mosse.map((x) => -x);
      else if (trasforma === 'ornamento' && nella === 2) ritmo = ritmo.flatMap((d) => (d >= 16 ? [d / 2, d / 2] : [d]));
      else if (trasforma === 'sposta' && nella === 2 && ritmo[0] > 4) ritmo = [-4, ritmo[0] - 4, ...ritmo.slice(1)];

      // sequenza: ogni ripresa della sezione e ogni frase successiva ripartono piu' su di un grado
      const salto = (nella === 2 ? 1 + (trasforma === 'sequenza' ? 1 : 0) : 0) + (frase % 2) + (volta % 3);
      let idx = gradi.indexOf(vicino(nella === 0 || nella === 2 ? centro : ultima, gradi)) + (nella === 0 || nella === 2 ? salto : 0);
      let pos = 0;
      const ins = adatta(ritmo, lunghezza).map((d, k) => {
        const durata = Math.abs(d);
        const inizio = pos;
        pos += durata;
        if (d < 0) return { midi: null, durata };
        if (k) idx += mosse[k % mosse.length] ?? 1;
        // resta nel registro della sezione: se esce, la linea torna indietro
        idx = Math.max(0, Math.min(gradi.length - 1, idx));
        while (idx > 0 && gradi[idx] > centro + 9) idx--;
        while (idx < gradi.length - 1 && gradi[idx] < centro - 9) idx++;
        let midi = gradi[idx];
        if (inizio === 0 || inizio === 16 || (cadenza && pos === lunghezza)) {
          midi = diAccordo(midi, c); // sui tempi forti e in cadenza: nota dell'accordo
          idx = gradi.indexOf(vicino(midi, gradi));
        }
        ultima = midi;
        return { midi, durata };
      });
      return { accordi, vocal: null, ins };
    });
    return { nome, ...(metro ? { metro } : {}), battute };
  });
  const principali = [temi.verse, temi.chorus].filter(Boolean);
  const ritmi = (m) => (m ? m.map((x) => x.ritmo.join()).join('|') : '');
  return {
    score: { bpm, metro: '4/4', tonalita: t.sigla, sezioni: scoreSezioni },
    motivi: principali.map((x) => x[0].ritmo),
    parametri: Object.fromEntries(Object.entries(usate).map(([k, v]) => [k, [...v]])),
    firma: { tema: ritmi(temi.verse), mosse: principali.flat().map((x) => x.mosse.join()).join('|'), ritornello: ritmi(temi.chorus), progressioni: ordine.join(), tonalita: t.sigla },
  };
}

// Revisore: punteggio 0-100 sulla qualita' musicale del candidato
function revisiona({ score, motivi, firma }, precedenti = []) {
  const battute = score.sezioni.flatMap((s) => s.battute.map((b) => ({ ...b, sezione: s.nome, lunghezza: Abc.unita(s.metro || score.metro) })));
  const piene = battute.filter((b) => b.ins);
  const note = piene.flatMap((b) => b.ins.filter((n) => n.midi !== null));
  const media = (v) => v.reduce((a, x) => a + x, 0) / (v.length || 1);

  let forti = 0;
  let buone = 0;
  for (const b of piene) {
    const prima = b.ins[0];
    if (prima.midi === null) continue;
    forti++;
    const m = /^([A-G][#b]?)(.*)$/.exec(b.accordi[0].sigla);
    const radice = Math.max(DIESIS.indexOf(m[1]), BEMOLLI.indexOf(m[1]));
    if (QUALITA[m[2]].some((x) => (radice + x) % 12 === prima.midi % 12)) buone++;
  }
  const accordo = forti ? buone / forti : 0;
  const salti = note.slice(1).filter((n, i) => Math.abs(n.midi - note[i].midi) > 7).length / (note.length || 1);
  const sigle = new Set(motivi.map((m) => m.join()));
  const ritorno = piene.filter((b) => sigle.has(b.ins.map((n) => (n.midi === null ? -n.durata : n.durata)).join())).length / (piene.length || 1);
  const di = (n) => media(piene.filter((b) => b.sezione === n).flatMap((b) => b.ins.filter((x) => x.midi !== null).map((x) => x.midi)));
  const contrasto = Math.max(0, Math.min(1, (di('chorus') - di('verse')) / 6)) || 0;
  const picco = Math.max(...note.map((n) => n.midi));
  const climax = note.findIndex((n) => n.midi === picco) / (note.length || 1) >= 0.35 ? 1 : 0;
  const varieta = Math.min(1, new Set(piene.map((b) => JSON.stringify(b.ins))).size / piene.length / 0.5);

  const ritornoOk = ritorno >= 0.25 && ritorno <= 0.6 ? 1 : Math.max(0, 1 - Math.min(Math.abs(ritorno - 0.25), Math.abs(ritorno - 0.6)) * 4);
  const novita = 1 - Math.max(0, ...precedenti.map((x) => somiglianza(firma, x)));
  const qualita = accordo * 25 + Math.max(0, 1 - salti * 8) * 15 + ritornoOk * 20 + contrasto * 15 + climax * 10 + varieta * 15;
  const punteggio = qualita * 0.85 + novita * 15;
  return { punteggio: Math.round(punteggio * 10) / 10, dettagli: { accordo: +accordo.toFixed(2), salti: +salti.toFixed(3), ritorno: +ritorno.toFixed(2), contrasto: +contrasto.toFixed(2), climax, varieta: +varieta.toFixed(2), novita: +novita.toFixed(2) } };
}

// Genera i candidati, li fa valutare e restituisce il migliore gia' scritto e validato in ABC
// identita, precedenti (firme dei brani gia' fatti) e preferenze vengono dalla memoria del genere
function componi({ candidati = 30, seed = 1, identita: id, precedenti = [], preferenze: pref = {}, ...richiesta }) {
  const materiale = id || identita(richiesta.cat);
  const gia = new Set(precedenti.map((x) => x.mosse));
  let migliore = null;
  // un tema gia' usato non si ripresenta: si continua a cercare finche' ne esce uno nuovo
  for (let i = 0; i < candidati || (!migliore && i < candidati + 200); i++) {
    const c = candidato(casuale(seed + i * 7919), richiesta, materiale, pref);
    if (gia.has(c.firma.mosse)) continue;
    const voto = revisiona(c, precedenti);
    if (!migliore || voto.punteggio > migliore.punteggio) migliore = { score: c.score, parametri: c.parametri, firma: c.firma, ...voto };
  }
  if (!migliore) throw new Error('nessun tema nuovo disponibile');
  const { score } = migliore;
  return { ...migliore, identita: materiale, abc: Abc.scriviAbc(score), lyrics: Abc.lyricsDaScore(score, { forma: 'semplice' }), durata_s: Math.round(Abc.durataSecondi(score)) };
}

if (typeof module !== 'undefined') module.exports = { componi, revisiona, tonica, identita, preferenze, peso, quanteProgressioni };
