// Compositore "estro" per i generi che non sono di quiete. Idea: un tema chiaro che torna, e poche sorprese ben
// distanziate (un assolo, una variazione, a volte un salto di tonalità o un richiamo a un tema di pubblico dominio).
// livello 1 (vivo) e livello 2 (pieno, un po' più ardito). Deterministico dato il seed.
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

// ---- Celle ritmiche di una battuta di 4/4 in trentaduesimi (8 = quarto); negativi = pause. Poche note, con respiro ----
const PASSI = {
  dritto: [[8, 4, 4, 8, 8], [12, 4, 8, 8], [8, 8, 8, 8], [6, 6, 4, 16], [-4, 4, 8, 16], [16, 8, 8], [12, 4, 16]],
  swing: [[12, 4, 6, 2, 8], [6, 2, 8, 16], [-8, 6, 2, 16], [8, 6, 2, 8, 8], [16, 12, 4], [12, 4, 16]],
  sincopato: [[6, 6, 4, -8, 8], [-4, 4, 8, 6, 2, 8], [8, -4, 4, 16], [12, 4, -8, 8], [6, 2, 8, -16], [4, -4, 8, 16]],
  ampio: [[16, 16], [24, 8], [12, 4, 16], [8, 8, 16], [16, 8, 8], [32]],
  danza: [[4, 4, 8, 8, 8], [6, 2, 8, 16], [8, 4, 4, 8, 8], [8, 8, 8, 8], [12, 4, 16], [4, 4, 4, 4, 16]],
};
const FEEL = { rock: 'dritto', elettro: 'dritto', blues: 'swing', jazz: 'swing', funk: 'sincopato', cine: 'ampio', drone: 'ampio', folk: 'danza', balcanico: 'danza', flamenco: 'danza' };

// celle dell'assolo: più mosse del tema, ma cantabili
const VOLO = [[4, 4, 4, 4, 8, 8], [6, 2, 4, 4, 16], [8, 4, 4, 8, 8], [-4, 4, 4, 4, 16], [12, 4, 4, 4, 8], [4, 4, 8, 4, 4, 8], [16, 4, 4, 8]];

// passi sulla scala, ripetuti a ciclo: soprattutto per grado, salti piccoli
const DISEGNI = { scala: [1], discesa: [-1], arpeggio: [2, 2, -1], onda: [1, 1, -1], domanda: [-1, 2, -1] };
const MOSSE = [-1, -1, -1, 1, 1, 1, 0, -2, 2];

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

// ---- Forme: [sezione dello score, ruolo, peso]. Una sola sezione "speciale" per forma ----
const R = { intro: ['intro', 'gancio', 1], str: ['verse', 'strofa', 2], pre: ['pre-chorus', 'pre', 1], rit: ['chorus', 'rit', 2], solo: ['interlude', 'solo', 2], ponte: ['bridge', 'ponte', 1], coda: ['outro', 'finale', 1] };
const forma = (sigle) => sigle.split(' ').map((s) => R[s]);
const FORME = {
  vivo: { canzone: 'intro str rit str rit solo rit coda', ponte: 'intro str rit str ponte rit coda', viaggio: 'intro str pre rit solo str rit coda' },
  pieno: { canzone: 'intro str pre rit str pre rit solo rit coda', arena: 'intro str rit str rit solo ponte rit coda', corsa: 'intro rit str rit solo str rit coda', suite: 'intro str str pre rit ponte solo rit coda' },
};
const FORME_PER_STILE = { jazz: ['jam', 'canzone'], blues: ['jam', 'arena'] };
FORME.pieno.jam = 'intro str str solo ponte solo str coda';
const CENTRI = { gancio: 69, strofa: 66, pre: 69, rit: 72, solo: 72, ponte: 67, finale: 68 };
const DA_SEZIONE = { intro: R.intro, verse: R.str, 'pre-chorus': R.pre, chorus: R.rit, bridge: R.ponte, interlude: R.solo, instrumental: R.solo, outro: R.coda };

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

function candidato(r, { cat, bpm, tonalita, durata_s, sezioni, estro = 2 }, { nomeForma, idCameo }) {
  const t = tonica(tonalita);
  const p = profilo(cat, t);
  const pieno = estro >= 2;
  const scala = p.scala.length < 7 ? SCALE[t.minore ? 'minore' : 'maggiore'] : p.scala;
  const modoM = t.minore ? 'm' : 'M';
  const nomiAccordi = /b|^(F|Dm|Gm|Cm|Fm)$/.test(t.sigla) ? BEMOLLI : DIESIS;
  const accordo = (testo) => {
    const [semi, q] = testo.split(':');
    const radice = (t.pc + Number(semi) + 12) % 12;
    // i gradi abbassati si chiamano col bemolle (in La minore Sib, non La#)
    const nomi = [1, 3, 8, 10].includes((Number(semi) + 12) % 12) ? BEMOLLI : nomiAccordi;
    return { sigla: nomi[radice] + q, pcs: QUALITA[q].map((x) => (radice + x) % 12) };
  };

  const forme = FORME[pieno ? 'pieno' : 'vivo'];
  const piano = sezioni ? sezioni.map((s) => DA_SEZIONE[s.replace(/[[\]]/g, '')] || R.str) : forma(forme[nomeForma]);
  const totale = Math.max(piano.length * 2, Math.round((durata_s * bpm) / 240));
  const quante = dividi(piano.map((x) => x[2]), totale);

  // armonia: tre giri (strofa, ritornello, ponte), un accordo per battuta; l'assolo suona sul giro della strofa
  const giri = mescola(r, GIRI[p.stile][modoM]);
  const giroDi = (ruolo) => giri[({ gancio: 1, rit: 1, finale: 1, ponte: 2, pre: 2 }[ruolo] || 0) % giri.length].split(' ').map((b) => accordo(b.split('+')[0]));

  // l'unico cambio di tonalità: l'ultimo ritornello più in alto, nei brani pieni e non sempre
  const ultimoRit = piano.map((x) => x[1]).lastIndexOf('rit');
  const sale = pieno && ultimoRit > 0 && r() < 0.35 ? scegli(r, [1, 2]) : 0;

  // richiamo: il tema è scelto a monte; sta in apertura o in chiusura, dove non spezza il discorso
  let cameo = null;
  if (idCameo) {
    const posti = piano.map((x, i) => ({ i, ruolo: x[1] })).filter((x) => ['gancio', 'finale'].includes(x.ruolo) && quante[x.i] >= CAMEI[idCameo].note.length + 1);
    if (posti.length) cameo = { id: idCameo, ...scegli(r, posti) };
  }

  const gradi = [];
  for (let m = BASSO; m <= ALTO; m++) if (scala.includes((m - t.pc + 120) % 12)) gradi.push(m);
  const vicino = (midi, ammesse) => ammesse.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
  const diAccordo = (midi, c) => { const v = []; for (let m = BASSO; m <= ALTO; m++) if (c.pcs.includes(m % 12)) v.push(m); return vicino(midi, v); };

  // i temi: due celle per strofa, ritornello e ponte; frase A B A + chiusura
  const celle = PASSI[FEEL[p.stile]];
  const nuovaCella = () => { const ritmo = scegli(r, celle); return { ritmo, mosse: ritmo.map(() => scegli(r, MOSSE)) }; };
  const due = () => { const a = nuovaCella(); let b = nuovaCella(); while (b.ritmo === a.ritmo) b = nuovaCella(); return [a, b]; };
  const temaStrofa = due(), temaRit = due(), temaPonte = due();
  const trovate = new Set();
  const volte = {};
  let ultima = vicino(CENTRI.strofa, gradi);
  const usate = new Set();

  // una battuta di melodia: ritmo e passi sulla scala; sui tempi forti si appoggia all'accordo
  function melodia({ ritmo, mosse, parti, lunghezza, accordo: c, centro, chiude = false }) {
    let idx = gradi.indexOf(vicino(parti === undefined ? ultima : parti, gradi));
    let pos = 0;
    const adattate = adatta(ritmo, lunghezza);
    return adattate.map((d, k) => {
      const durata = Math.abs(d);
      const inizio = pos;
      pos += durata;
      if (d < 0) return { midi: null, durata };
      if (k) idx += mosse[k % mosse.length];
      idx = Math.max(0, Math.min(gradi.length - 1, idx));
      // fuori dal registro della sezione la linea torna indietro
      while (idx > 0 && gradi[idx] > centro + 9) idx -= 1;
      while (idx < gradi.length - 1 && gradi[idx] < centro - 9) idx += 1;
      let midi = gradi[idx];
      if (inizio === 0 || inizio === 16 || (chiude && k === adattate.length - 1)) {
        midi = diAccordo(midi, c);
        idx = gradi.indexOf(vicino(midi, gradi));
      }
      ultima = midi;
      return { midi, durata };
    });
  }
  // chiusura di sezione: una piccola corsa nella seconda metà, oppure una nota che respira
  function chiusura(c, lunghezza, centro) {
    trovate.add('fill');
    const ritmo = scegli(r, [[16, 4, 4, 4, 4], [12, 4, 4, 4, 8], [8, 8, 4, 4, 8]]);
    return melodia({ ritmo, mosse: [scegli(r, [1, -1])], lunghezza, accordo: c, centro });
  }

  const lunghezza = Abc.unita('4/4');
  const scoreSezioni = piano.map(([nome, ruolo], s) => {
    const volta = (volte[ruolo] = (volte[ruolo] || 0) + 1) - 1;
    const quanteB = quante[s];
    const giro = giroDi(ruolo);
    const centro = CENTRI[ruolo];
    const disegni = mescola(r, Object.keys(DISEGNI));
    const ultimaSezione = s === piano.length - 1;
    if (ruolo === 'solo' || ruolo === 'ponte') trovate.add(ruolo);
    ultima = vicino(centro, gradi);
    // la strofa che ritorna cambia solo la risposta
    const risposta = volta && ruolo === 'strofa' ? nuovaCella() : null;

    const battute = Array.from({ length: quanteB }, (_, i) => {
      const fineBrano = ultimaSezione && i === quanteB - 1;
      let c = giro[i % giro.length];
      if (ruolo === 'pre' && i === quanteB - 1) c = accordo('7:7');
      if (fineBrano) c = accordo(`0:${p.stile === 'flamenco' ? '' : t.minore ? 'm' : ''}`);
      const scrivi = (ins) => ({ accordi: [{ pos: 0, sigla: c.sigla }], vocal: null, ins });
      if (fineBrano) return scrivi([{ midi: vicino(centro, gradi.filter((g) => g % 12 === t.pc)), durata: lunghezza }]);

      const nella = i % 4;
      const frase = Math.floor(i / 4);
      const chiude = i === quanteB - 1;
      if (chiude && ruolo !== 'finale') return scrivi(chiusura(c, lunghezza, centro));

      if (ruolo === 'solo') {
        // l'assolo sale poco a poco, cambia disegno a ogni frase e a metà richiama il ritornello
        const alto = centro - 4 + Math.round((i / quanteB) * 8);
        if (frase % 2 === 1 && nella < 2) return scrivi(melodia({ ...temaRit[nella], parti: alto, lunghezza, accordo: c, centro: alto }));
        if (nella === 3) return scrivi(melodia({ ritmo: [8, 8, 16], mosse: [-1], lunghezza, accordo: c, centro: alto, chiude: true }));
        return scrivi(melodia({ ritmo: scegli(r, VOLO), mosse: DISEGNI[disegni[frase % disegni.length]], lunghezza, accordo: c, centro: alto }));
      }
      if (ruolo === 'gancio' && i < Math.floor(quanteB / 2)) return scrivi(null); // il brano entra con gli accordi

      const tema = ruolo === 'strofa' ? temaStrofa : ruolo === 'ponte' || ruolo === 'pre' ? temaPonte : temaRit;
      const m = nella === 1 ? tema[1] : nella === 3 ? risposta || tema[1] : tema[0];
      // a inizio frase si riparte dalla stessa altezza: così il tema si riconosce
      const parti = nella === 0 ? centro : nella === 2 ? centro + [0, 3, -2, 5][(frase + volta) % 4] : undefined;
      let { ritmo, mosse } = m;
      if (nella === 1 && (frase + volta) % 2) mosse = mosse.map((x) => -x); // la risposta si rovescia una volta sì e una no
      if (nella === 3) { ritmo = frase % 2 ? [8, 24] : [8, 8, 16]; mosse = [-1]; }
      if (nella === 0) usate.add(ritmo.join());
      return scrivi(melodia({ ritmo, mosse, parti, lunghezza, accordo: c, centro, chiude: nella === 3 }));
    });

    // il richiamo sostituisce le battute della sezione scelta, trasportato nella tonalità o nella sua relativa
    if (cameo && cameo.i === s) {
      const c = CAMEI[cameo.id];
      const sposta = c.modo === modoM ? 0 : t.minore ? 3 : -3;
      const altezze = c.note.flat().filter((x) => x[0] !== null).map((x) => x[0]);
      const centrale = (Math.min(...altezze) + Math.max(...altezze)) / 2;
      const base = t.pc + sposta + 12 * Math.round((70 - centrale - t.pc - sposta) / 12);
      const da = ruolo === 'finale' ? Math.max(0, quanteB - c.note.length - 1) : 0;
      c.note.forEach((battuta, k) => {
        const [semi, q] = c.accordi[k % c.accordi.length].split(':');
        const sigla = accordo(`${(Number(semi) + sposta + 12) % 12}:${q}`).sigla;
        battute[da + k] = { accordi: [{ pos: 0, sigla }], vocal: null, ins: battuta.map(([x, durata]) => ({ midi: x === null ? null : base + x, durata })) };
      });
      cameo.battute = [da, da + c.note.length];
    }

    const sezione = { nome, battute };
    if (!sale || s < ultimoRit) return sezione;
    trovate.add('modulazione');
    const tr = Abc.trasponi({ tonalita: t.sigla, sezioni: [sezione] }, sale);
    return { ...tr.sezioni[0], tonalita: tr.tonalita };
  });

  if (cameo) trovate.add('cameo');
  const ritmi = (m) => m.map((x) => x.ritmo.join()).join('|');
  return {
    score: { bpm, metro: '4/4', tonalita: t.sigla, sezioni: scoreSezioni },
    ritornello: usate,
    cameo: cameo ? { id: cameo.id, nome: CAMEI[cameo.id].nome, sezione: cameo.i, battute: cameo.battute } : null,
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
  // né un ciclo né un fiume di materiale sempre nuovo: circa due battute su tre diverse
  const diverse = new Set(piene.map((b) => JSON.stringify(b.ins))).size / (piene.length || 1);
  const varieta = Math.max(0, 1 - Math.abs(diverse - 0.65) * 3);
  const ritorno = Math.min(1, piene.filter((b) => c.ritornello.has(b.ins.map((x) => (x.midi === null ? -x.durata : x.durata)).join())).length / (piene.length || 1) / 0.35);
  const densita = c.score.sezioni.map((_, i) => media(battute.filter((b) => b.s === i && b.ins).map((b) => b.ins.filter((x) => x.midi !== null).length)));
  const contrasto = Math.min(1, (Math.max(...densita) - Math.min(...densita)) / 3);
  const salti = note.slice(1).filter((x, i) => Math.abs(x.midi - note[i].midi) > 7).length / (note.length || 1);
  const picco = Math.max(...note.map((x) => x.midi));
  const climax = note.findIndex((x) => x.midi === picco) / (note.length || 1) >= 0.4 ? 1 : 0;
  const accordo = forti ? buone / forti : 0;
  const novita = 1 - Math.max(0, ...precedenti.map((x) => somiglianza(c.firma, x)));
  const qualita = accordo * 25 + varieta * 20 + ritorno * 25 + contrasto * 10 + Math.max(0, 1 - salti * 10) * 15 + climax * 5;
  return { punteggio: Math.round((qualita * 0.85 + novita * 15) * 10) / 10, dettagli: { accordo: +accordo.toFixed(2), varieta: +varieta.toFixed(2), ritorno: +ritorno.toFixed(2), contrasto: +contrasto.toFixed(2), salti: +salti.toFixed(3), climax, novita: +novita.toFixed(2) } };
}

// Stessa interfaccia di Compositore.componi, con in più cameo e trovate
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
  const idCameo = r() < (pieno ? 0.35 : 0.15) ? pesato(r, fresco(CAMEI_PER_STILE[stile], 'cameo', 4), (x) => peso(pref, `cameo:${x}`)) : null;
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

if (typeof module !== 'undefined') module.exports = { componi, revisiona, CAMEI, GIRI };
