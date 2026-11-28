// Armonia dei generi creativi: periodi di 8 battute (4 per il pre-ritornello) scritti in gradi romani, con cadenze.
// Sintassi: battute separate da |, due accordi nella stessa battuta separati da spazio. Maiuscolo = maggiore,
// minuscolo = minore; b/# alzano o abbassano il grado (riferito alla scala maggiore della tonica); /grado = basso.
// Strofa: finisce aperta. Pre: spinge verso la dominante. Ritornello: chiude. Ponte: parte lontano dalla tonica.

const GRADI = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };

// "bVImaj7/I" -> { semi: 8, tipo: 'maj7', basso: 0 }
function grado(testo) {
  const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(maj7|7sus4|sus4|sus2|dim7|dim|aug|ø|7|6)?(?:\/([b#]?)(VII|VI|IV|V|III|II|I))?$/.exec(testo);
  if (!m) throw new Error(`grado non riconosciuto: ${testo}`);
  const [, alt, numero, suffisso = '', altB, basso] = m;
  const alza = (a) => (a === 'b' ? -1 : a === '#' ? 1 : 0);
  const minore = numero === numero.toLowerCase();
  const semi = (GRADI[numero.toLowerCase()] + alza(alt) + 12) % 12;
  const tipo = suffisso === 'ø' ? 'm7b5' : minore ? ({ '': 'm', 7: 'm7', 6: 'm6' }[suffisso] ?? suffisso) : suffisso;
  return { semi, tipo, basso: basso ? (GRADI[basso.toLowerCase()] + alza(altB) + 12) % 12 : null };
}

const periodo = (testo) => testo.split('|').map((b) => b.trim().split(/\s+/).map(grado));

const G = {
  rock: {
    m: {
      strofa: ['i | i bVII | bVI | bVII | i | bIII | iv | bVII', 'i | bVII/I | IV/I | i | bVI | bVII | iv | v', 'i | bIII | iv | i | bVI | bIII | bVII | V', 'i | i | bVI bVII | i | iv | bVI | iisus4 | V7'],
      pre: ['iv | bVI | bVII | V', 'bVI | bVII | iv | V7sus4 V', 'iv | iv/bIII | iiø | V'],
      rit: ['i | bVI | bIII | bVII | i | bVI | iv V | i', 'bVI | bVII | i | bIII | bVI | bVII | V | i', 'i bVII | bVI | bIII | bVII/II | iv | bVI | bVII V | i'],
      ponte: ['bVI | bIII | iv | i | bVI | bIII | iisus4 | V', 'iv | bVII | bIII | bVI | iiø | V | iv | V7'],
    },
    M: {
      strofa: ['I | bVII | IV | I | vi | IV | bVII | V', 'I | V/VII | vi | IV | I | iii | IV | V', 'I | I | bIII IV | I | vi | ii | IV | V', 'I | IV/I | I | bVII | IV | iv | I | V'],
      pre: ['ii | iii | IV | V', 'IV | iv | bVII | V7sus4 V', 'vi | V/VII | I IV | V'],
      rit: ['I | V | vi | IV | I | V | IV V | I', 'IV | I | V | vi | IV | I/III | V | I', 'I | bIII | IV | I | bVI | bVII | V | I'],
      ponte: ['vi | iii | IV | I | ii | iii | IV | V', 'bVI | bVII | I | I | bVI | bVII | IV | V'],
    },
  },
  blues: {
    m: {
      strofa: ['i7 | iv7 | i7 | i7 | iv7 | iv7 | i7 | V7', 'i7 | i7 | iv7 | i7 | bVI7 | V7 | i7 | V7', 'i6 | iv7 i6 | i6 | I7 | iv7 | #ivdim7 | i6 bVI7 | V7'],
      pre: ['iv7 | iv7 | bVI7 | V7', 'iv7 | #ivdim7 | i7/V VI7 | V7'],
      rit: ['bVI7 | V7 | i7 | i7 | bVI7 | V7 | i7 iv7 | i7', 'iv7 | i7 | iv7 | i7 | bVI7 | V7 | i7 | i7'],
      ponte: ['iv7 | bVII7 | bIII7 | bVI7 | iiø | V7 | i7 | V7', 'bVI7 | bVI7 | i7 | i7 | bVI7 | bVII7 | V7 | V7'],
    },
    M: {
      strofa: ['I7 | IV7 | I7 | I7 | IV7 | #ivdim7 | I7 VI7 | II7 V7', 'I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | V7', 'I7 | IV7 iv7 | I7 III7 | VI7 | ii7 | V7 | I7 bIII7 | II7 V7'],
      pre: ['IV7 | #ivdim7 | I7/V VI7 | II7 V7', 'II7 | II7 | V7 | V7'],
      rit: ['V7 | IV7 | I7 | I7 | V7 | IV7 | I7 V7 | I7', 'IV7 | IV7 | I7 | VI7 | II7 | V7 | I7 | I7'],
      ponte: ['IV7 | IV7 | I7 | I7 | II7 | II7 | V7 | V7', 'III7 | III7 | VI7 | VI7 | II7 | II7 | V7 | V7'],
    },
  },
  jazz: {
    m: {
      strofa: ['i6 | iiø V7 | i7 | iv7 bVII7 | bIIImaj7 | bVImaj7 | iiø | V7', 'i7 | i7/bVII | viø | bVImaj7 V7 | i7 VI7 | iiø V7 | i6 | iiø V7', 'iv7 | bVII7 | bIIImaj7 | bVImaj7 | iiø | V7 | i6 | V7'],
      pre: ['iv7 | iv7 bVII7 | bIIImaj7 bVImaj7 | iiø V7', 'bVImaj7 | #ivø VII7 | iiø bII7 | V7'],
      rit: ['bVImaj7 | V7 | i7 | VI7 | iiø | V7 | i6 | i6', 'iv7 bVII7 | bIIImaj7 VI7 | iiø bII7 | i7 | iv7 | bVI7 V7 | i6 | i6'],
      ponte: ['bIIImaj7 | iv7 bVII7 | bIIImaj7 | VI7 | iiø | V7 | bVImaj7 | V7', 'iv7 | iv6 | bIIImaj7 | I7 | iv7 | bVII7 | iiø | V7'],
    },
    M: {
      strofa: ['Imaj7 | vi7 | ii7 | V7 | iii7 VI7 | ii7 V7 | Imaj7 IV7 | iii7 VI7', 'Imaj7 | #idim7 | ii7 | #iidim7 | iii7 | VI7 | ii7 | V7', 'Imaj7 | IVmaj7 | iii7 | VI7 | ii7 | bII7 | Imaj7 VI7 | ii7 V7'],
      pre: ['IVmaj7 | iv6 | iii7 VI7 | ii7 V7', 'ii7 | ii7/I | viiø III7 | V7sus4 V7'],
      rit: ['IVmaj7 | iv7 bVII7 | iii7 | VI7 | ii7 | V7 | Imaj7 | Imaj7', 'ii7 V7 | Imaj7 | iv7 bVII7 | Imaj7 | #ivø VII7 | iii7 VI7 | ii7 V7 | I6'],
      ponte: ['III7 | III7 | VI7 | VI7 | II7 | II7 | ii7 | V7', 'v7 I7 | IVmaj7 | iv7 bVII7 | Imaj7 | vi7 II7 | ii7 | V7sus4 | V7'],
    },
  },
  funk: {
    m: {
      strofa: ['i7 | IV7 | i7 | IV7 | i7 | IV7 | bVImaj7 | bVII V7', 'i7 | i7 | iv7 | iv7 | i7 | bIII7 | iv7 | V7sus4 V7', 'i7 | i7 bIII7 | iv7 | i7 | bVImaj7 | v7 | iv7 | bVII7'],
      pre: ['iv7 | v7 | bVImaj7 | V7sus4 V7', 'bVImaj7 | bVII7 | iv7 | V7'],
      rit: ['bVImaj7 | bVII7 | i7 | i7 | bVImaj7 | bVII7 | iv7 V7 | i7', 'iv7 bVII7 | bIIImaj7 bVImaj7 | iiø V7 | i7 | iv7 bVII7 | bIIImaj7 | bVI7 V7 | i7'],
      ponte: ['bIIImaj7 | iv7 | v7 | iv7 | bIIImaj7 | iv7 | bVI7 | V7', 'iv7 | iv7 | v7 | v7 | bVImaj7 | bVII7sus4 | iiø | V7'],
    },
    M: {
      strofa: ['I7 | I7 | IV7 | IV7 | I7 | bVII7 | IV7 | V7sus4', 'Imaj7 | iii7 | IVmaj7 | V7sus4 | Imaj7 | iii7 VI7 | ii7 | V7', 'I7 | IV7 I7 | I7 | bIII7 IV7 | I7 | IV7 I7 | bVII7 | V7'],
      pre: ['ii7 | iii7 | IVmaj7 | V7sus4 V7', 'IVmaj7 | iv7 | iii7 VI7 | ii7 V7'],
      rit: ['IVmaj7 | iii7 vi7 | ii7 V7 | I6 | IVmaj7 | III7 vi7 | ii7 V7 | Imaj7', 'IVmaj7 | V7/IV | iii7 | vi7 | ii7 | V7sus4 V7 | Imaj7 | Imaj7'],
      ponte: ['bVImaj7 | bVII7 | Imaj7 | Imaj7 | bVImaj7 | bVII7 | ii7 | V7', 'vi7 | II7 | v7 | I7 | IVmaj7 | iv7 | ii7 | V7sus4'],
    },
  },
  elettro: {
    m: {
      strofa: ['i | i | bVI | bVI | iv | iv | bVII | bVII', 'i7 | bVImaj7 | bIII | bVII/II | i7 | bVImaj7 | iv7 | v', 'i | bIII/I | iv/I | i | bVImaj7 | bIIImaj7 | iv7 | Vsus4 V'],
      pre: ['bVI | bVII | i7/V | bVII', 'iv7 | v7 | bVI | Vsus4 V'],
      rit: ['bVI | bVII | i | bIII | bVI | bVII | v | i', 'i bVII | bVI | bIII | bVII | iv | bVI | bVII | i', 'bVImaj7 | bIII | bVII | i | bVImaj7 | bVII | iv V | i'],
      ponte: ['bIIImaj7 | iv7 | i7 | bVII | bVImaj7 | v7 | iv7 | Vsus4', 'iv | iv | bVI | bVI | bII | bII | V | V'],
    },
    M: {
      strofa: ['I | iii | vi | IV | I | iii | IV | V', 'Imaj7 | Imaj7/VII | vi7 | vi7/V | IVmaj7 | iii7 | ii7 | V', 'vi | IV | I | V | vi | IV | ii | V'],
      pre: ['ii7 | iii7 | IV | V', 'IV | V/IV | iii7 | vi V'],
      rit: ['IV | V | vi | I/III | IV | V | I | I', 'I | V/VII | vi | IVsus2 | I | V | IV V | I', 'IVmaj7 | V | iii7 | vi | ii7 | V | I | I'],
      ponte: ['vi | iii | IV | I | bVI | bVII | Vsus4 | V', 'ii7 | vi7 | bVIImaj7 | IV | ii7 | iii7 | IV | V'],
    },
  },
  cine: {
    m: {
      strofa: ['i | bVI/I | iv/I | i | bVI | bIII/V | iv | V', 'i | v/bVII | bVI | bIII/V | iv | i/bIII | iiø | V', 'i | bII | i | bVII | bVI | iv | Vsus4 | V'],
      pre: ['iv | iv/bIII | iiø | V', 'bVI | bVII | iv/VI | V'],
      rit: ['bVI | bIII | bVII | i | bVI | bIII | iv V | i', 'i | bVI | bIII | bVII | iv | bVI | V | i', 'i/bIII | iv | bVII | bIII | bVImaj7 | iv | V | I'],
      ponte: ['bIII | bVII/II | i | bVI | iv | bII | V | V', 'bVImaj7 | II | v | bIII | iv | bVI | iiø | V'],
    },
    M: {
      strofa: ['I | iii/VII | vi | IV | I/III | IV | ii | V', 'I | V/I | IV/I | iv/I | I | vi | II/#IV | V', 'Isus2 | I | IVmaj7 | I/III | ii7 | vi | IV | Vsus4 V'],
      pre: ['vi | V/VII | I | II/#IV V', 'IV | iv | I/V | V'],
      rit: ['I | V/VII | vi | IV | I/III | IV | V | I', 'IV | V | iii | vi | IV | iv | Vsus4 V | I'],
      ponte: ['bVI | bVII | I | I | bIII | IV | Vsus4 | V', 'iii | vi | ii | V | bVImaj7 | iv | Vsus4 | V'],
    },
  },
  folk: {
    m: {
      strofa: ['i | i | bVII | bVII | i | bIII | bVII | v', 'i | bVII | i | iv | i | bVI | bVII | V', 'i | iv | bVII | bIII | bVI | iv | V | V'],
      pre: ['bIII | bVII | iv | V', 'iv | i | bVI | bVII'],
      rit: ['bIII | bVII | i | i | bIII | bVII | i V | i', 'i | bVII bIII | iv | i | bVI | bIII bVII | V | i'],
      ponte: ['bVI | bIII | bVII | i | bVI | bIII | iv | V', 'iv | iv | i | i | bVI | bVII | Vsus4 | V'],
    },
    M: {
      strofa: ['I | I | IV | I | I | vi | ii | V', 'I | IV | I | V | vi | IV | I/III V | V', 'I | bVII | IV | I | I | bVII | IV | V'],
      pre: ['IV | I/III | ii | V', 'vi | iii | IV | V'],
      rit: ['IV | I | V | vi | IV | I | V | I', 'I | V/VII | vi | I/V | IV | I/III | ii V | I'],
      ponte: ['vi | IV | I | V | vi | IV | ii | V', 'ii | vi | ii | vi | IV | I/III | II | V'],
    },
  },
  balcanico: {
    m: {
      strofa: ['i | i | iv | i | iv | i | V7 | i V7', 'i | bII | i | bII | bVII | bVI | V | V', 'i | iv | bVII | bIII | bVI | iv | V7 | V7'],
      pre: ['iv | bIII | bII | V7', 'iv | iv | V7 | V7'],
      rit: ['bIII | bVII7 | bIII | V7 | iv | i | V7 | i', 'iv | i | V7 | i | iv | i | bVI V7 | i'],
      ponte: ['bVI | bVII | bIII | bIII | iv | bVI | V | V', 'iv7 | bVII7 | bIII | bVI | iiø | V7 | i | V7'],
    },
    M: {
      strofa: ['I | bII | I | bvii | I | bII | bvii | I', 'I | iv | bII | I | iv | bII | bvii | I'],
      pre: ['iv | bvii | bII | bII', 'iv | iv | bII | bvii'],
      rit: ['iv | bII | bvii | I | iv | bII | bvii bII | I', 'bII | bIII | iv | bII | bIII | bII | bvii | I'],
      ponte: ['iv | iv | bvii | bvii | bVI | bVI | bII | bII', 'bvii | bIII | bVI | bII | bvii | iv | bII | I'],
    },
  },
  flamenco: {
    m: {
      strofa: ['I | bII | I | bII | iv | bIII | bII | I', 'iv | bIII | bII | I | iv | bIII bII | I | I', 'I | I | iv | iv | bvii | bII | I | bII'],
      pre: ['iv | bvii | bII | bII', 'bVI7 | bVI7 | bII | bII'],
      rit: ['iv | bIII | bII | I | bVI | bIII | bII | I', 'bIII7 | bVI | bVII7 | bIII | iv | bII7 | I | I'],
      ponte: ['bVI | bIII | bvii | iv | bVI | bVII | bII | I', 'iv | iv | bIII | bIII | bII | bVI7 | bII | I'],
    },
    M: {
      strofa: ['I | bII | I | bII | iv | bIII | bII | I'],
      pre: ['iv | bvii | bII | bII'],
      rit: ['iv | bIII | bII | I | bVI | bIII | bII | I'],
      ponte: ['bVI | bIII | bvii | iv | bVI | bVII | bII | I'],
    },
  },
};

const ARMONIA = Object.fromEntries(Object.entries(G).map(([stile, modi]) => [stile, Object.fromEntries(Object.entries(modi).map(([modo, ruoli]) =>
  [modo, Object.fromEntries(Object.entries(ruoli).map(([ruolo, voci]) => [ruolo, voci.map(periodo)]))]))]));
ARMONIA.drone = ARMONIA.cine;

if (typeof module !== 'undefined') module.exports = { TESTI: G, ARMONIA, grado };
