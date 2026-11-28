// Compositore "estro" per i generi che non sono di quiete: forme ricche, assoli, risposte tra registri, rotture,
// cambi di tonalità e di metro, richiami a temi celebri di pubblico dominio e suoni insoliti nello stile.
// livello 1 (vivo): variazioni e un assolo, senza strappi; livello 2 (pieno): tutto. Deterministico dato il seed.
const Abc = typeof ScoreAbc !== 'undefined' ? ScoreAbc : require('./abc.js');
const Base = typeof Compositore !== 'undefined' ? Compositore : require('./compositore.js');

const { casuale, tonica, profilo, adatta, somiglianza, peso, pesato, SCALE, QUALITA, DIESIS, BEMOLLI } = Base;
const scegli = (r, v) => v[Math.floor(r() * v.length)];
const mescola = (r, v) => { const resto = [...v]; return v.map(() => resto.splice(Math.floor(r() * resto.length), 1)[0]); };
const BASSO = 55, ALTO = 84; // dopo la modulazione (massimo +3) si resta entro 55-87

// ---- Armonie: "semitoni:qualità" dalla tonica, un accordo per battuta ("a+b" = due nella stessa battuta) ----
const GIRI = {
  rock: {
    m: ['0:m 10: 8: 10:', '0:m 3: 10: 5:', '0:m 8: 3: 10:', '5:m 8: 10: 0:m', '0:m 1: 0:m 10:+7:7', '8: 10: 0:m 7:7', '0:m 5: 8: 7:7', '3: 10: 5:m 8:+10:'],
    M: ['0: 10: 5: 0:', '0: 3: 5: 10:', '9:m 5: 0: 7:', '0: 5: 8:+10: 0:', '5: 7: 4:m 9:m', '0: 4:7 9:m 5:+5:m', '8: 10: 0: 0:'],
  },
  blues: {
    m: ['0:m7 0:m7 5:m7 0:m7 8:7 7:7 0:m7 7:7', '0:m 5:7 0:m 0:m7 5:m7 3:7+2:7 0:m 7:7', '0:m6 5:m6 0:m6+8:7 7:7'],
    M: ['0:7 5:7 0:7 0:7 7:7 5:7 0:7 7:7', '0:7 0:7 5:7 6:dim 0:7+9:7 2:7+7:7 0:7 7:7', '0:6 5:7 0:7+8:7 7:7'],
  },
  jazz: {
    m: ['0:m7 5:m7 2:m7b5 7:7', '8:maj7 2:m7b5 7:7 0:m6', '0:m 0:m7 9:m7b5 8:maj7', '5:m7 10:7 3:maj7 2:m7b5+7:7', '0:m6 1:7 0:m6 2:m7b5+7:7', '3:maj7 8:maj7 2:m7b5 7:7'],
    M: ['0:maj7 9:7 2:m7 7:7', '4:m7 9:7 2:m7 1:7', '5:maj7 5:m6 4:m7+9:7 2:m7+7:7', '0:6 1:dim 2:m7 7:7', '2:m7 7:7 4:m7+9:7 2:m7+1:7', '0:maj7 10:7 9:7 8:7+7:7'],
  },
  funk: {
    m: ['0:m7 5:7 0:m7 5:7', '0:m7 3:7 5:7 8:7+7:7', '0:m7 10:7 8:maj7 7:7', '5:m7 10:7 3:maj7 8:maj7', '0:m7 0:m7 1:maj7 0:m7', '2:m7 7:7 0:m7 9:7'],
    M: ['0:7 10:7 5:7 0:7', '0:maj7 4:m7 5:maj7 7:sus4', '2:m7 7:7 4:m7 9:7', '0:7 3:7 5:7 8:7+7:7', '5:maj7 4:m7 2:m7+7:7 0:maj7'],
  },
  elettro: {
    m: ['0:m 8: 3: 10:', '0:m 0:m 8: 10:', '5:m 0:m 8: 7:sus4', '0:m 1: 0:m 10:', '8:maj7 10: 0:m 3:', '0:m7 5:m7 8:maj7+10: 0:m7'],
    M: ['0: 7: 9:m 5:', '9:m 5: 0: 7:', '5:maj7 7: 9:m 0:', '0: 10: 5: 5:m', '2:m7 4:m7 5:maj7 7:sus4'],
  },
  cine: {
    m: ['0:m 8: 3: 10:', '0:m 8:maj7 5:m 7:7', '8: 10: 0:m 0:m', '0:m 1: 8: 7:7', '5:m 0:m 6:dim 7:7', '0:m 3:maj7 8:maj7 5:m+7:7'],
    M: ['0: 4:m 5: 5:m', '0: 7: 9:m 4:m', '5:maj7 7: 4:m 9:m', '0: 8: 10: 0:', '9:m 4: 5: 2:m+7:'],
  },
  folk: {
    m: ['0:m 10: 0:m 7:7', '0:m 3: 10: 0:m', '8: 3: 10: 0:m', '0:m 5: 10: 3:+10:', '5:m 10: 3: 7:7'],
    M: ['0: 5: 0: 7:', '0: 10: 5: 0:', '9:m 5: 0: 7:sus4', '0: 4:m 5: 7:', '2:m 7: 0: 9:m+7:'],
  },
  balcanico: {
    m: ['0:m 5:m 7:7 0:m', '5:m 0:m 7:7 0:m', '8: 7:7 8: 7:7', '0:m 1: 10:m 0:m', '3: 10:7 3:+8: 7:7'],
    M: ['0: 1: 0: 10:m', '5:m 1: 0: 0:', '0: 5:m 1:+10:m 0:', '10:m 0: 1: 0:'],
  },
  flamenco: {
    m: ['5:m 3: 1: 0:', '0: 1: 0: 10:m', '8:7 7: 1:maj7 0:', '5:m 5:m 1:+3: 0:', '0: 5:m 3:+1: 0:'],
    M: ['0: 1: 0: 1:', '5:m 3: 1: 0:', '8: 10:m 1:+3: 0:'],
  },
  drone: { m: ['0:m 8:maj7 3:maj7 10:', '0:sus2 5:sus2 8:maj7 10:'], M: ['0:maj7 5:maj7 9:m7 7:sus4', '0: 9:m7 5:sus2 7:'] },
};

// ---- Celle ritmiche di una battuta di 4/4 in trentaduesimi (8 = quarto); negativi = pause ----
const PASSI = {
  dritto: [[4, 4, 4, 4, 4, 4, 4, 4], [8, 4, 4, 8, 4, 4], [6, 6, 4, 6, 6, 4], [2, 2, 4, 2, 2, 4, 8, 8], [-4, 4, 4, 4, -4, 4, 8], [12, 4, 12, 4], [8, 8, 6, 6, 4], [-2, 2, 4, 4, 4, 4, 4, 8], [16, 6, 6, 4], [4, -4, 4, -4, 8, 8], [6, 2, 4, 4, 12, 4]],
  swing: [[6, 2, 6, 2, 6, 2, 6, 2], [6, 2, 8, 6, 2, 8], [-8, 6, 2, 6, 2, 8], [12, 4, 6, 2, 8], [-4, 4, 6, 2, 4, 4, 8], [8, 6, 2, -4, 4, 8], [-2, 2, 4, 6, 2, 12, 4], [16, -4, 4, 6, 2], [4, 4, -6, 2, 6, 2, 8]],
  sincopato: [[4, -2, 2, -4, 4, 2, 2, 4, 8], [-4, 4, -4, 4, 6, 6, 4], [6, 6, 4, -4, 4, 8], [2, 2, -4, 2, 2, 4, -4, 4, 8], [-8, 4, 4, -4, 4, 8], [4, 2, 2, -4, 4, -2, 6, 8], [-2, 4, 2, 8, -2, 4, 2, 8], [8, -4, 2, 2, 6, 6, 4], [12, 2, 2, -4, 4, 8]],
  ampio: [[16, 16], [24, 8], [12, 4, 16], [8, 8, 16], [16, 8, 4, 4], [-8, 8, 12, 4], [6, 2, 8, 16], [12, 12, 8], [4, 4, 8, 16]],
  danza: [[4, 4, 4, 4, 8, 8], [6, 2, 4, 4, 6, 2, 4, 4], [2, 2, 2, 2, 4, 4, 8, 8], [8, 4, 4, 8, 4, 4], [4, 2, 2, 4, 4, 4, 2, 2, 8], [6, 6, 4, 4, 4, 8], [4, 4, 2, 2, 4, 4, 4, 8], [8, 2, 2, 4, 8, 8]],
};
const FEEL = { rock: 'dritto', elettro: 'dritto', blues: 'swing', jazz: 'swing', funk: 'sincopato', cine: 'ampio', drone: 'ampio', folk: 'danza', balcanico: 'danza', flamenco: 'danza' };

// celle dell'assolo: fitte, con respiri
const VOLO = [
  [2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 8], [4, 2, 2, 4, 2, 2, 4, 4, 8], [-4, 2, 2, 2, 2, 2, 2, 4, 4, 8],
  [6, 2, 2, 2, 2, 2, 8, 8], [2, 2, 4, 2, 2, 4, 2, 2, 4, 8], [12, 2, 2, 2, 2, 2, 2, 8],
  [4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 4], [2, 2, 2, 2, 4, -4, 2, 2, 2, 2, 8], [1, 1, 2, 4, 1, 1, 2, 4, 8, 8],
  [8, -4, 4, 2, 2, 2, 2, 8], [-8, 2, 2, 2, 2, 4, 4, 8], [16, 2, 2, 2, 2, 4, 4],
];
const VOLO_VIVO = [[4, 4, 4, 4, 8, 8], [6, 2, 4, 4, 8, 8], [-4, 4, 2, 2, 4, 8, 8], [8, 4, 2, 2, 4, 4, 8], [12, 4, 4, 4, 8], [4, 2, 2, 8, 4, 4, 8]];

// disegni di un fraseggio: passi sulla scala, ripetuti a ciclo sulle note della cella
const DISEGNI = {
  scala: [1], discesa: [-1], arpeggio: [2, 2, 3, -2], sequenza: [1, 1, 1, -2], terze: [2, -1],
  salti: [4, -1, -1, -1], volo: [5, -2, 3, -4], ribattuto: [0, 0, 1, 0, 0, -1], zigzag: [1, -2, 3, -1], domanda: [-1, 3, -1, -1],
};
const MOSSE = [-1, -1, 1, 1, 1, -2, 2, 0, 3, -3, 4];

// ---- Richiami: temi di pubblico dominio. Note [semitoni dalla tonica, durata]; null = pausa ----
const n = (...v) => v;
const CAMEI = {
  gioia: { nome: 'Inno alla gioia (Beethoven)', modo: 'M', accordi: ['0:', '7:', '0:', '7:'], note: [n([4, 8], [4, 8], [5, 8], [7, 8]), n([7, 8], [5, 8], [4, 8], [2, 8]), n([0, 8], [0, 8], [2, 8], [4, 8]), n([4, 12], [2, 4], [2, 16])] },
  montagna: { nome: 'Nell’antro del re della montagna (Grieg)', modo: 'm', accordi: ['0:m', '0:m'], note: [n([0, 4], [2, 4], [3, 4], [5, 4], [7, 4], [3, 4], [7, 8]), n([6, 4], [2, 4], [6, 8], [5, 4], [1, 4], [5, 8])] },
  korobeiniki: { nome: 'Korobeiniki (canto popolare russo)', modo: 'm', accordi: ['7:7', '0:m', '7:7', '0:m'], note: [n([7, 8], [2, 4], [3, 4], [5, 8], [3, 4], [2, 4]), n([0, 8], [0, 4], [3, 4], [7, 8], [5, 4], [3, 4]), n([2, 12], [3, 4], [5, 8], [7, 8]), n([3, 8], [0, 8], [0, 16])] },
  turca: { nome: 'Rondò alla turca (Mozart)', modo: 'm', accordi: ['0:m', '0:m'], note: [n([2, 4], [0, 4], [-1, 4], [0, 4], [3, 8], [null, 8]), n([5, 4], [3, 4], [2, 4], [3, 4], [7, 8], [null, 8])] },
  elisa: { nome: 'Per Elisa (Beethoven)', modo: 'm', accordi: ['0:m', '0:m'], note: [n([7, 4], [6, 4], [7, 4], [6, 4], [7, 4], [2, 4], [5, 4], [3, 4]), n([0, 16], [null, 16])] },
  toccata: { nome: 'Toccata in Re minore (Bach)', modo: 'm', accordi: ['0:m', '7:7'], note: [n([7, 2], [5, 2], [7, 28]), n([5, 4], [3, 4], [2, 4], [0, 4], [-1, 8], [0, 8])] },
  quinta: { nome: 'Quinta sinfonia (Beethoven)', modo: 'm', accordi: ['0:m', '7:7'], note: [n([null, 4], [7, 4], [7, 4], [7, 4], [3, 16]), n([null, 4], [5, 4], [5, 4], [5, 4], [2, 16])] },
  diesirae: { nome: 'Dies irae (canto gregoriano)', modo: 'm', accordi: ['0:m', '0:m'], note: [n([3, 8], [2, 8], [3, 8], [0, 8]), n([2, 8], [-2, 8], [0, 16])] },
  tell: { nome: 'Guglielmo Tell (Rossini)', modo: 'M', accordi: ['0:', '0:'], note: [n([7, 2], [7, 2], [7, 4], [7, 2], [7, 2], [7, 4], [7, 2], [7, 2], [7, 4], [7, 2], [7, 2], [7, 4]), n([7, 2], [7, 2], [0, 8], [2, 8], [4, 12])] },
  saints: { nome: 'When the Saints Go Marching In (tradizionale)', modo: 'M', accordi: ['0:', '0:', '0:', '0:'], note: [n([null, 8], [0, 8], [4, 8], [5, 8]), n([7, 32]), n([null, 8], [0, 8], [4, 8], [5, 8]), n([7, 32])] },
  greensleeves: { nome: 'Greensleeves (tradizionale)', modo: 'm', accordi: ['0:m', '10:', '0:m', '7:7'], note: [n([3, 8], [5, 4], [7, 8], [8, 4], [7, 8]), n([5, 8], [2, 4], [-2, 8], [0, 4], [2, 8]), n([3, 8], [0, 4], [0, 8], [-1, 4], [0, 8]), n([2, 8], [-1, 4], [-5, 20])] },
  bellaciao: { nome: 'Bella ciao (tradizionale)', modo: 'm', accordi: ['0:m', '0:m', '0:m', '5:m'], note: [n([-5, 4], [0, 4], [2, 4], [3, 4], [0, 16]), n([-5, 4], [0, 4], [2, 4], [3, 4], [0, 16]), n([-5, 4], [0, 4], [2, 4], [3, 8], [2, 4], [0, 8]), n([3, 8], [2, 4], [0, 4], [7, 8], [7, 8])] },
  habanera: { nome: 'Habanera dalla Carmen (Bizet)', modo: 'm', accordi: ['0:m', '7:7'], note: [n([12, 6], [11, 2], [10, 8], [10, 8], [10, 8]), n([9, 6], [8, 2], [7, 8], [7, 8], [7, 8])] },
  cancan: { nome: 'Can-can (Offenbach)', modo: 'M', accordi: ['0:', '7:7', '7:7', '0:'], note: [n([0, 16], [2, 4], [5, 4], [4, 4], [2, 4]), n([7, 8], [7, 8], [7, 4], [9, 4], [4, 4], [5, 4]), n([2, 8], [2, 8], [2, 4], [5, 4], [4, 4], [2, 4]), n([0, 4], [12, 4], [11, 4], [9, 4], [7, 4], [5, 4], [4, 4], [2, 4])] },
  scarborough: { nome: 'Scarborough Fair (tradizionale)', modo: 'm', accordi: ['0:m', '10:', '0:m'], note: [n([0, 16], [0, 8], [7, 8]), n([7, 16], [2, 8], [3, 4], [2, 4]), n([0, 32])] },
};
const CAMEI_PER_STILE = {
  rock: ['toccata', 'quinta', 'montagna', 'elisa', 'tell', 'diesirae'], blues: ['saints', 'habanera', 'scarborough'],
  jazz: ['saints', 'habanera', 'elisa', 'turca', 'greensleeves'], funk: ['habanera', 'saints', 'elisa', 'korobeiniki', 'quinta'],
  elettro: ['korobeiniki', 'toccata', 'montagna', 'elisa', 'turca', 'gioia'], cine: ['diesirae', 'montagna', 'quinta', 'gioia'],
  folk: ['greensleeves', 'scarborough', 'gioia', 'bellaciao'], balcanico: ['korobeiniki', 'bellaciao', 'turca', 'cancan'],
  flamenco: ['habanera', 'bellaciao', 'turca'], drone: ['scarborough', 'greensleeves'],
};

// ---- Suoni e trovate in inglese, aggiunti allo stile: diversi a ogni brano ----
const TOCCHI = {
  tutti: ['dynamic arrangement full of surprises', 'drum fills between sections', 'stop-time breaks', 'call and response between instruments', 'rich ear candy details', 'dramatic final section'],
  rock: ['blazing electric guitar solo', 'twin guitar harmonies', 'wah pedal lead', 'tremolo picked riff', 'feedback swells', 'bass guitar breakdown', 'tom drum breakdown', 'talk box guitar', 'slide guitar licks', 'palm muted gallop'],
  blues: ['expressive guitar solo with bends', 'wailing harmonica solo', 'honky tonk piano break', 'hammond organ swells', 'slide guitar answers', 'walking bass solo', 'stop-time guitar breaks', 'brushed snare shuffle'],
  jazz: ['virtuoso improvised solo', 'trading fours with drums', 'walking double bass solo', 'muted trumpet', 'vibraphone solo', 'clarinet runs', 'rimshot accents', 'accordion flourishes'],
  funk: ['talk box lead', 'slap bass solo', 'tight horn stabs', 'wah clavinet', 'conga break', 'electric piano solo', 'vinyl scratches', 'whistle synth lead', 'flute solo with trills'],
  elettro: ['soaring analog synth solo', 'filter sweeps', 'glitch fills', 'arpeggiator countermelody', 'theremin lead', 'chiptune arpeggios', 'risers and drops', 'granular textures', 'resonant acid bassline', 'reverse cymbal transitions'],
  cine: ['soaring solo violin', 'french horn theme', 'taiko drum hits', 'music box interlude', 'ethereal glass harmonica', 'cello countermelody', 'huge orchestral crescendo', 'prepared piano details'],
  folk: ['virtuoso fiddle solo', 'accordion solo', 'hammered dulcimer', 'jaw harp', 'tin whistle ornaments', 'mandolin tremolo', 'hurdy-gurdy drone', 'hand clap breaks'],
  balcanico: ['wild clarinet solo', 'brass band stabs', 'darbuka break', 'cimbalom runs', 'accelerating dance sections', 'accordion solo', 'violin glissandi'],
  flamenco: ['rapid picado guitar runs', 'rasgueado flourishes', 'hand clap breaks', 'cajon solo', 'oud answers', 'castanet accents'],
  drone: ['bowed vibraphone', 'kalimba details', 'ebow guitar lines', 'shimmering bell textures'],
};

// ---- Forme: [sezione dello score, ruolo, peso] ----
const R = { intro: ['intro', 'gancio', 1], str: ['verse', 'strofa', 2], pre: ['pre-chorus', 'pre', 1], rit: ['chorus', 'rit', 2], solo: ['interlude', 'solo', 2], duello: ['interlude', 'duello', 1.5], rottura: ['bridge', 'rottura', 1], ponte: ['bridge', 'ponte', 1.5], coda: ['outro', 'finale', 1] };
const forma = (sigle) => sigle.split(' ').map((s) => R[s]);
const FORME = {
  vivo: {
    canzone: 'intro str pre rit str ponte solo rit coda',
    dialogo: 'intro str rit duello str ponte rit coda',
    viaggio: 'intro str str rit solo rottura rit coda',
    rondo: 'intro rit str rit ponte rit duello rit coda',
  },
  pieno: {
    arena: 'intro str pre rit str solo rottura duello rit coda',
    corsa: 'intro rit str solo str pre rit ponte duello rit coda',
    suite: 'intro str rottura str pre rit ponte solo pre rit coda',
    jam: 'intro str str solo ponte duello solo str coda',
    montagne: 'intro str rit rottura solo str pre rit duello rit coda',
  },
};
const FORME_PER_STILE = { jazz: ['jam', 'arena', 'corsa'], blues: ['jam', 'montagne', 'arena'], cine: ['suite', 'montagne'] };
const DA_SEZIONE = { intro: R.intro, verse: R.str, 'pre-chorus': R.pre, chorus: R.rit, bridge: R.ponte, interlude: R.solo, instrumental: R.solo, outro: R.coda };
const CENTRI = { gancio: 69, strofa: 66, pre: 69, rit: 73, solo: 72, duello: 70, rottura: 62, ponte: 68, finale: 68 };

// Battute per sezione, pari, la cui somma si avvicina al totale
function dividi(pesi, totale) {
  const somma = pesi.reduce((a, b) => a + b, 0);
  const out = pesi.map((p) => Math.max(2, 4 * Math.round((p * totale) / somma / 4)));
  for (let giro = 0; giro < 300; giro++) {
    const diff = totale - out.reduce((a, b) => a + b, 0);
    if (Math.abs(diff) < 2) break;
    const i = out.map((b, k) => k).filter((k) => diff > 0 || out[k] > 2)
      .sort((a, b) => (diff > 0 ? out[a] / pesi[a] - out[b] / pesi[b] : out[b] / pesi[b] - out[a] / pesi[a]))[0];
    if (i === undefined) break;
    out[i] += diff > 0 ? 2 : -2;
  }
  return out;
}

function candidato(r, { cat, bpm, tonalita, durata_s, sezioni, metri = true, estro = 2 }, { nomeForma, idCameo }) {
  const t = tonica(tonalita);
  const p = profilo(cat, t);
  const pieno = estro >= 2;
  const scala = p.scala.length < 7 ? SCALE[t.minore ? 'minore' : 'maggiore'] : p.scala; // le pentatoniche restano per i colori
  const penta = SCALE[t.minore ? 'pentaMinore' : 'pentaMaggiore'];
  const modoM = t.minore ? 'm' : 'M';
  const nomiAccordi = /b|^(F|Dm|Gm|Cm|Fm)$/.test(t.sigla) ? BEMOLLI : DIESIS;
  const accordo = (testo) => {
    const [semi, q] = testo.split(':');
    const radice = (t.pc + Number(semi) + 12) % 12;
    // i gradi abbassati si chiamano col bemolle (in La minore Sib, non La#)
    const nomi = [1, 3, 8, 10].includes((Number(semi) + 12) % 12) ? BEMOLLI : nomiAccordi;
    return { sigla: nomi[radice] + q, pcs: QUALITA[q].map((x) => (radice + x) % 12) };
  };

  // forma
  const forme = FORME[pieno ? 'pieno' : 'vivo'];
  const piano = sezioni ? sezioni.map((s) => DA_SEZIONE[s.replace(/[[\]]/g, '')] || R.str) : forma(forme[nomeForma]);
  const totale = Math.max(piano.length * 2, Math.round((durata_s * bpm) / 240));
  const quante = dividi(piano.map((x) => x[2]), totale);

  // armonia: un giro diverso per ogni ruolo
  const giri = mescola(r, GIRI[p.stile][modoM]);
  const giroDi = (ruolo, volta) => {
    const i = { strofa: 0, gancio: 1, rit: 1, finale: 1, ponte: 2, pre: 3, solo: 4, duello: 4, rottura: 0 }[ruolo] || 0;
    return giri[(i + (ruolo === 'solo' ? volta : 0)) % giri.length].split(' ').map((b) => b.split('+').map(accordo));
  };

  // cambi di tonalità: ponte altrove, ultimo ritornello più in alto
  const ultimoRit = piano.map((x) => x[1]).lastIndexOf('rit');
  const sale = pieno && ultimoRit > 0 && r() < 0.8 ? scegli(r, [1, 2, 2, 3]) : 0;
  const ponteAltrove = pieno ? scegli(r, [0, 3, 5, -2]) : 0;
  const metroPonte = metri && pieno && r() < 0.5 ? (p.metroBridge || scegli(r, ['3/4', '7/8', '3/4'])) : undefined;

  // richiamo: il tema è scelto a monte, qui si decide dove metterlo
  let cameo = null;
  if (idCameo) {
    const posti = piano.map((x, i) => ({ i, ruolo: x[1] })).filter((x) => ['gancio', 'solo', 'finale', 'ponte'].includes(x.ruolo) && !(x.ruolo === 'ponte' && metroPonte) && quante[x.i] >= CAMEI[idCameo].note.length + 1);
    if (posti.length) cameo = { id: idCameo, ...scegli(r, posti) };
  }

  const gradiDi = (s) => { const v = []; for (let m = BASSO; m <= ALTO; m++) if (s.includes((m - t.pc + 120) % 12)) v.push(m); return v; };
  const gradi = gradiDi(scala);
  const gradiPenta = gradiDi(penta);
  const vicino = (midi, ammesse) => ammesse.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
  const diAccordo = (midi, c) => { const v = []; for (let m = BASSO; m <= ALTO; m++) if (c.pcs.includes(m % 12)) v.push(m); return vicino(midi, v); };

  // sopra i 120 bpm i trentaduesimi non si distinguono più
  const volo = pieno ? VOLO.filter((c) => bpm <= 120 || !c.includes(1)) : VOLO_VIVO;

  // materiale tematico
  const celle = PASSI[FEEL[p.stile]];
  const nuovaCella = () => { const ritmo = scegli(r, celle); return { ritmo, mosse: ritmo.map(() => scegli(r, MOSSE)) }; };
  const due = () => { const a = nuovaCella(); let b = nuovaCella(); while (b.ritmo === a.ritmo) b = nuovaCella(); return [a, b]; };
  const temaStrofa = due(), temaRit = due(), temaPonte = due();
  const trovate = new Set();
  const volte = {};
  let ultima = vicino(CENTRI.strofa, gradi);
  const usate = new Set();

  // una battuta di melodia: ritmo e passi sulla scala; sui tempi forti si appoggia all'accordo
  function melodia({ ritmo, mosse, parti, lunghezza, accordi, centro, ampiezza = 9, scalaNote = gradi, cromatico = 0, chiude = false }) {
    let idx = scalaNote.indexOf(vicino(parti === undefined ? ultima : parti, scalaNote));
    let pos = 0;
    const celleAdattate = adatta(ritmo, lunghezza);
    const out = celleAdattate.map((d, k) => {
      const durata = Math.abs(d);
      const inizio = pos;
      pos += durata;
      if (d < 0) return { midi: null, durata };
      if (k) idx += mosse[k % mosse.length];
      idx = Math.max(0, Math.min(scalaNote.length - 1, idx));
      // fuori dal registro della sezione la linea rimbalza indietro
      while (idx > 0 && scalaNote[idx] > centro + ampiezza) idx -= 2;
      while (idx < scalaNote.length - 1 && scalaNote[idx] < centro - ampiezza) idx += 2;
      idx = Math.max(0, Math.min(scalaNote.length - 1, idx));
      let midi = scalaNote[idx];
      const c = [...accordi].reverse().find((a) => a.pos <= inizio) || accordi[0];
      if (inizio === 0 || inizio === 16 || (chiude && k === celleAdattate.length - 1)) {
        midi = diAccordo(midi, c);
        idx = scalaNote.indexOf(vicino(midi, scalaNote));
      } else if (cromatico && durata <= 4 && r() < cromatico && midi > BASSO) midi -= 1; // nota di passaggio o "blue note"
      ultima = midi;
      return { midi, durata };
    });
    return out;
  }
  // chiusure di frase: corsa verso la sezione dopo, colpi con silenzio, spinta sincopata
  function chiusura(accordi, lunghezza, centro) {
    const tipo = scegli(r, ['corsa', 'corsa', 'colpi', 'spinta', 'salita']);
    trovate.add(tipo === 'colpi' ? 'stop' : 'fill');
    if (tipo === 'colpi') {
      const x = diAccordo(centro + 5, accordi[0]);
      const c = adatta([4, -4, 4, -4, 2, 2, -12], lunghezza);
      return c.map((d) => ({ midi: d < 0 ? null : x, durata: Math.abs(d) }));
    }
    if (tipo === 'spinta') return melodia({ ritmo: [6, 6, 4, 6, 6, 4], mosse: [0, 2, 1, -1, 2, 1], lunghezza, accordi, centro });
    const su = tipo === 'salita' || r() < 0.5;
    return melodia({ ritmo: Array(16).fill(2), mosse: [su ? 1 : -1], parti: su ? centro - 7 : centro + 8, lunghezza, accordi, centro, ampiezza: 12, cromatico: tipo === 'salita' ? 0.25 : 0 });
  }

  const scoreSezioni = piano.map(([nome, ruolo], s) => {
    const volta = (volte[ruolo] = (volte[ruolo] || 0) + 1) - 1;
    const metro = ruolo === 'ponte' ? metroPonte : undefined;
    const lunghezza = Abc.unita(metro || '4/4');
    if (metro) trovate.add(`metro:${metro}`);
    const quanteB = Math.max(2, 2 * Math.round((quante[s] * 32) / lunghezza / 2));
    const giro = giroDi(ruolo, volta);
    const centro = CENTRI[ruolo] + (volta && ruolo === 'strofa' ? scegli(r, [-5, 4, 7]) : 0);
    const disegni = mescola(r, Object.keys(DISEGNI));
    const colori = (p.stile === 'blues' || p.stile === 'rock' || p.stile === 'funk') && r() < 0.5 ? gradiPenta : gradi;
    // la seconda strofa e i ritornelli successivi rinnovano la risposta
    const risposta = volta ? nuovaCella() : null;
    const ultimaSezione = s === piano.length - 1;
    if (ruolo === 'solo' || ruolo === 'duello' || ruolo === 'rottura') trovate.add(ruolo);
    ultima = vicino(centro, gradi);
    let domanda = null;

    const battute = Array.from({ length: quanteB }, (_, i) => {
      const fineBrano = ultimaSezione && i === quanteB - 1;
      let cs = giro[i % giro.length];
      // al secondo passaggio del giro una sostituzione: dominante secondaria o di tritono verso l'accordo dopo
      if (i >= giro.length && i % giro.length === giro.length - 1 && r() < 0.5) {
        const prossimo = giro[(i + 1) % giro.length][0];
        const radice = prossimo.pcs[0];
        const nuova = (radice + (p.stile === 'jazz' && r() < 0.5 ? 1 : 7)) % 12;
        cs = [cs[0], { sigla: `${nomiAccordi[nuova]}7`, pcs: QUALITA['7'].map((x) => (nuova + x) % 12) }];
        trovate.add('sostituzioni');
      }
      if (ruolo === 'pre' && i === quanteB - 1) cs = [accordo('7:7')];
      if (fineBrano) cs = [accordo(`0:${p.stile === 'flamenco' ? '' : t.minore ? 'm' : ''}`)];
      const accordi = cs.slice(0, 2).map((c, k) => ({ pos: k * (lunghezza / 2), sigla: c.sigla, pcs: c.pcs }));
      const scrivi = (ins) => ({ accordi: accordi.map(({ pos, sigla }) => ({ pos, sigla })), vocal: null, ins });
      if (fineBrano) return scrivi([{ midi: diAccordo(centro, cs[0]), durata: 4 }, { midi: null, durata: 4 }, { midi: vicino(centro, gradi.filter((g) => g % 12 === t.pc)), durata: lunghezza - 8 }]);

      const nella = i % 4;
      const frase = Math.floor(i / 4);
      const chiude = i === quanteB - 1;

      if (ruolo === 'rottura') {
        // la banda si ferma: colpi, silenzi, poi la ricarica
        if (chiude) return scrivi(chiusura(accordi, lunghezza, centro + 4));
        if (nella % 2 === 0) { const x = diAccordo(centro - 3 + frase * 4, cs[0]); return scrivi(adatta(scegli(r, [[4, -28], [4, -8, 4, -16], [6, 6, 4, -16], [-16, 4, 4, 8]]), lunghezza).map((d) => ({ midi: d < 0 ? null : x, durata: Math.abs(d) }))); }
        return scrivi(melodia({ ritmo: scegli(r, [[-16, 4, 4, 4, 4], [-8, 2, 2, 2, 2, 8, 8], [-24, 2, 2, 4]]), mosse: [scegli(r, [1, -1, 2])], lunghezza, accordi, centro: centro + frase * 3 }));
      }
      if (ruolo === 'solo') {
        // improvvisazione: il registro sale, il disegno cambia ogni due battute, in fondo una nota lunga o una corsa
        const arco = quanteB > 2 ? i / (quanteB - 1) : 1;
        const c = centro - 5 + Math.round(arco * 10);
        if (chiude) return scrivi(chiusura(accordi, lunghezza, c));
        if (pieno && i === quanteB - 2) return scrivi(melodia({ ritmo: [24, 2, 2, 2, 2], mosse: [-1], parti: c + 6, lunghezza, accordi, centro: c + 3, ampiezza: 12 }));
        if (i % 8 === 4) return scrivi(melodia({ ritmo: temaRit[0].ritmo, mosse: temaRit[0].mosse, parti: c, lunghezza, accordi, centro: c })); // cita il gancio
        const disegno = disegni[Math.floor(i / 2) % disegni.length];
        return scrivi(melodia({ ritmo: scegli(r, volo), mosse: DISEGNI[disegno], lunghezza, accordi, centro: c, ampiezza: 11, scalaNote: colori, cromatico: pieno ? (p.stile === 'jazz' || p.stile === 'blues' ? 0.2 : 0.08) : 0 }));
      }
      if (ruolo === 'duello') {
        // botta e risposta: due strumenti immaginari in registri lontani, stesso ritmo, risposta rovesciata
        if (chiude) return scrivi(chiusura(accordi, lunghezza, centro));
        if (i % 2 === 0) {
          domanda = { ritmo: scegli(r, pieno ? volo : celle), mosse: [scegli(r, MOSSE), scegli(r, MOSSE), scegli(r, MOSSE)] };
          return scrivi(melodia({ ...domanda, parti: centro + 7, lunghezza, accordi, centro: centro + 7, ampiezza: 7 }));
        }
        const d = domanda || { ritmo: celle[0], mosse: [1] };
        return scrivi(melodia({ ritmo: d.ritmo, mosse: d.mosse.map((x) => -x), parti: centro - 7, lunghezza, accordi, centro: centro - 7, ampiezza: 7 }));
      }

      if (ruolo === 'gancio') {
        // apertura: rada, poi il gancio del ritornello anticipato
        if (i === 0 && quanteB > 2) return scrivi(melodia({ ritmo: [-16, 4, 4, 8], mosse: [2, 2, 1], lunghezza, accordi, centro: centro - 4 }));
        if (chiude) return scrivi(chiusura(accordi, lunghezza, centro));
        const m = temaRit[i % 2];
        return scrivi(melodia({ ritmo: m.ritmo, mosse: m.mosse, parti: centro - (i < 2 ? 5 : 0), lunghezza, accordi, centro }));
      }

      const tema = ruolo === 'rit' || ruolo === 'finale' ? temaRit : ruolo === 'ponte' || ruolo === 'pre' ? temaPonte : temaStrofa;
      // chiusura di sezione sempre, e a metà delle sezioni lunghe un piccolo scarto
      if ((chiude && ruolo !== 'finale') || (i % 8 === 7 && r() < (pieno ? 0.7 : 0.4))) return scrivi(chiusura(accordi, lunghezza, centro));
      const gancio = ruolo === 'rit' && nella === 0; // il gancio torna riconoscibile
      let m = tema[nella === 1 || nella === 3 ? 1 : 0];
      if (nella === 3 && risposta) m = risposta;
      let { ritmo, mosse } = m;
      if (!gancio) {
        // ogni ritorno dello stesso motivo viene trasformato
        const come = (frase * 2 + nella + volta * 3) % 6;
        if (come === 1) mosse = mosse.map((x) => -x);
        else if (come === 2) ritmo = ritmo.flatMap((d) => (d >= 8 ? [d / 2, d / 2] : [d]));
        else if (come === 3) ritmo = [...ritmo].reverse();
        else if (come === 4) ritmo = ritmo.map((d, k) => (k === 0 && d > 0 ? -d : d));
        else if (come === 5) ({ ritmo, mosse } = nuovaCella());
      }
      if (nella === 3) ritmo = scegli(r, [[8, 8, 16], [4, 4, 8, -16], [12, 4, 16], [6, 6, 4, 16], ritmo]);
      const partenza = nella === 0 ? centro + (ruolo === 'rit' ? 0 : [0, 3, -2, 5][frase % 4]) : nella === 2 ? centro + 2 + (frase % 3) : undefined;
      const ins = melodia({ ritmo, mosse: gancio ? tema[0].mosse : mosse, parti: partenza, lunghezza, accordi, centro: centro + (gancio && volta ? 2 : 0), chiude: nella === 3, cromatico: !gancio && p.stile === 'jazz' ? 0.12 : 0 });
      if (nella === 0) usate.add(tema[0].ritmo.join());
      return scrivi(ins);
    });

    // il richiamo sostituisce le battute della sezione scelta, trasportato nella tonalità o nella sua relativa
    if (cameo && cameo.i === s) {
      const c = CAMEI[cameo.id];
      const sposta = c.modo === modoM ? 0 : t.minore ? 3 : -3;
      const altezze = c.note.flat().filter((x) => x[0] !== null).map((x) => x[0]);
      const centrale = (Math.min(...altezze) + Math.max(...altezze)) / 2;
      const base = t.pc + sposta + 12 * Math.round((70 - centrale - t.pc - sposta) / 12);
      const da = ruolo === 'finale' ? Math.max(0, quanteB - c.note.length - 1) : ruolo === 'solo' ? Math.max(0, quanteB - c.note.length - 1) : 0;
      c.note.forEach((battuta, k) => {
        const [semi, q] = c.accordi[k % c.accordi.length].split(':');
        const sigla = accordo(`${(Number(semi) + sposta + 12) % 12}:${q}`).sigla;
        battute[da + k] = { accordi: [{ pos: 0, sigla }], vocal: null, ins: battuta.map(([x, durata]) => ({ midi: x === null ? null : base + x, durata })) };
      });
      cameo.battute = [da, da + c.note.length];
    }

    const sezione = { nome, ...(metro ? { metro } : {}), battute };
    const spostamento = s === ultimoRit || (s > ultimoRit && ultimoRit >= 0) ? sale : ruolo === 'ponte' ? ponteAltrove : 0;
    if (!spostamento) return sezione;
    trovate.add('modulazione');
    const tr = Abc.trasponi({ tonalita: t.sigla, sezioni: [sezione] }, spostamento);
    return { ...tr.sezioni[0], tonalita: tr.tonalita };
  });

  if (cameo) trovate.add('cameo');
  const ritmi = (m) => m.map((x) => x.ritmo.join()).join('|');
  const suoni = [...mescola(r, TOCCHI[p.stile]).slice(0, pieno ? 3 : 2), ...mescola(r, TOCCHI.tutti).slice(0, pieno ? 2 : 1)];
  if (trovate.has('modulazione') && sale) suoni.push('key change in the last chorus');
  return {
    score: { bpm, metro: '4/4', tonalita: t.sigla, sezioni: scoreSezioni },
    ritornello: usate,
    cameo: cameo ? { id: cameo.id, nome: CAMEI[cameo.id].nome, sezione: cameo.i, battute: cameo.battute } : null,
    tocchi: suoni,
    trovate: [...trovate].sort(),
    parametri: { progressioni: [], celle: [], trasformazioni: [], forma: nomeForma, cameo: cameo ? cameo.id : null, trovate: [...trovate].sort() },
    firma: { tema: ritmi(temaStrofa), mosse: [...temaStrofa, ...temaRit].map((x) => x.mosse.join()).join('|'), ritornello: ritmi(temaRit), progressioni: giri.slice(0, 3).join('/'), tonalita: t.sigla, forma: nomeForma, cameo: cameo ? cameo.id : null },
  };
}

// Revisore: premia varietà, contrasto tra sezioni e un gancio che torna, senza note a caso sui tempi forti
function revisiona(c, precedenti = []) {
  const battute = c.score.sezioni.flatMap((s, i) => s.battute.map((b) => ({ ...b, s: i })));
  const piene = battute.filter((b) => b.ins && b.ins.some((x) => x.midi !== null));
  const note = piene.flatMap((b) => b.ins.filter((x) => x.midi !== null));
  const media = (v) => v.reduce((a, x) => a + x, 0) / (v.length || 1);
  let forti = 0, buone = 0;
  for (const b of piene) {
    const prima = b.ins[0];
    if (prima.midi === null) continue;
    forti++;
    const m = Abc.noteAccordo(b.accordi[0].sigla);
    if (m && m.note.includes(prima.midi % 12)) buone++;
  }
  const quota = (v, n) => Math.min(1, new Set(v).size / (n || 1));
  const varieta = Math.min(1, quota(piene.map((b) => JSON.stringify(b.ins)), piene.length) / 0.85);
  const ritmi = Math.min(1, quota(piene.map((b) => b.ins.map((x) => (x.midi === null ? -x.durata : x.durata)).join()), piene.length) / 0.35);
  const ritorno = Math.min(1, piene.filter((b) => c.ritornello.has(b.ins.map((x) => (x.midi === null ? -x.durata : x.durata)).join())).length / (piene.length || 1) / 0.15);
  const densita = c.score.sezioni.map((_, i) => media(battute.filter((b) => b.s === i).map((b) => (b.ins || []).filter((x) => x.midi !== null).length)));
  const contrasto = Math.min(1, (Math.max(...densita) - Math.min(...densita)) / 7);
  const salti = note.slice(1).filter((x, i) => Math.abs(x.midi - note[i].midi) > 9).length / (note.length || 1);
  const picco = Math.max(...note.map((x) => x.midi));
  const climax = note.findIndex((x) => x.midi === picco) / (note.length || 1) >= 0.4 ? 1 : 0;
  const accordo = forti ? buone / forti : 0;
  const novita = 1 - Math.max(0, ...precedenti.map((x) => somiglianza(c.firma, x)));
  const qualita = accordo * 20 + varieta * 25 + ritmi * 15 + ritorno * 15 + contrasto * 10 + Math.max(0, 1 - salti * 10) * 10 + climax * 5;
  return { punteggio: Math.round((qualita * 0.85 + novita * 15) * 10) / 10, dettagli: { accordo: +accordo.toFixed(2), varieta: +varieta.toFixed(2), ritmi: +ritmi.toFixed(2), ritorno: +ritorno.toFixed(2), contrasto: +contrasto.toFixed(2), salti: +salti.toFixed(3), climax, novita: +novita.toFixed(2) } };
}

// Stessa interfaccia di Compositore.componi, con in più cameo, tocchi e trovate
function componi({ candidati = 30, seed = 1, precedenti = [], preferenze: pref = {}, identita, ...richiesta }) {
  const pieno = richiesta.estro === undefined || richiesta.estro >= 2;
  const stile = profilo(richiesta.cat, tonica(richiesta.tonalita)).stile;
  // forma e richiamo si decidono prima, escludendo quelli appena usati: altrimenti il revisore premia sempre gli stessi
  const r = casuale(seed);
  const fresco = (voci, campo, quanti) => {
    const recenti = precedenti.slice(-quanti).map((x) => x[campo]);
    const libere = voci.filter((v) => !recenti.includes(v));
    return libere.length ? libere : voci;
  };
  const forme = pieno && FORME_PER_STILE[stile] ? FORME_PER_STILE[stile] : Object.keys(FORME[pieno ? 'pieno' : 'vivo']);
  const nomeForma = richiesta.sezioni ? 'scelta' : pesato(r, fresco(forme, 'forma', 2), (x) => peso(pref, `forma:${x}`));
  const idCameo = r() < (pieno ? 0.85 : 0.35) ? pesato(r, fresco(CAMEI_PER_STILE[stile], 'cameo', 4), (x) => peso(pref, `cameo:${x}`)) : null;
  const gia = new Set(precedenti.map((x) => x.mosse));
  let migliore = null;
  for (let i = 0; i < candidati || (!migliore && i < candidati + 200); i++) {
    const c = candidato(casuale(seed + (i + 1) * 7919), richiesta, { nomeForma, idCameo });
    if (gia.has(c.firma.mosse)) continue;
    const voto = revisiona(c, precedenti);
    if (!migliore || voto.punteggio > migliore.punteggio) migliore = { ...c, ...voto };
  }
  if (!migliore) throw new Error('nessun tema nuovo disponibile');
  const { score, ritornello, ...resto } = migliore;
  return { ...resto, score, abc: Abc.scriviAbc(score), lyrics: Abc.lyricsDi(score), durata_s: Math.round(Abc.durataSecondi(score)) };
}

if (typeof module !== 'undefined') module.exports = { componi, revisiona, CAMEI, TOCCHI, GIRI };
