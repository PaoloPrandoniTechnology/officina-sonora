// Aggiunge cinque generi strumentali con chitarre e batteria, piu' movimentati e distanti dallo yoga.
const fs = require('fs');
const file = 'E:/n8n/yoga/config/catalogo.json';
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const nomi = new Set(cat.categories.map((c) => c.name));

const nuovi = [
  {
    name: "Surf-rock-strumentale",
    energia: 4,
    bpm: [126, 142],
    attivita: "sottofondo energico, movimento leggero e pedalata",
    strutture: ["loop", "arco"],
    genere: "Surf rock strumentale",
    stile: "instrumental surf rock, reverb guitar lead, driving drums, bright and playful, played by a band",
    strumenti: ["chitarra elettrica con riverbero", "batteria con piatti", "basso elettrico", "chitarra ritmica twang", "organo leggero"],
    vietati: ["voce", "synth dominante", "pad lunghi", "drop elettronico"],
    influenze: [{ genere: "surf rock", peso: 3 }, { genere: "rock and roll", peso: 1 }, { genere: "rockabilly", peso: 1 }],
    enfasi: "tema di chitarra che ritorna ad ogni giro, batteria in crescendo",
    melodia: "tema breve di chitarra con bending, scala minore armonica",
    accordi: "giro di tre accordi con power chord e cambio sulla quarta",
    ritmica: "beat di batteria dritto in 4/4 con rullate, basso in ottavi",
    tonalita: ["Mi minore", "La minore", "Re minore"],
    varianti: [
      { nome: "reverb", keywords: "reverb guitar lead, twangy rhythm, driving drums" },
      { nome: "organo", keywords: "surf guitar with organ, bright cymbals, energetic" }
    ],
    colori: ["#0b3b4f", "#1fa3b8", "#ffb84d"]
  },
  {
    name: "Post-rock-strumentale",
    energia: 4,
    bpm: [100, 120],
    attivita: "sottofondo ampio e dinamico, lavoro e concentrazione attiva",
    strutture: ["arco", "crescendo"],
    genere: "Post-rock strumentale",
    stile: "instrumental post-rock, layered clean and delayed guitars, building drums, cinematic and expansive, played by a band",
    strumenti: ["chitarra elettrica con delay", "chitarra clean arpeggiata", "batteria con crescendo", "basso profondo", "glockenspiel"],
    vietati: ["voce", "synth dominante", "drum machine rigida", "drop elettronico"],
    influenze: [{ genere: "post-rock", peso: 3 }, { genere: "shoegaze", peso: 1 }, { genere: "ambient rock", peso: 1 }],
    enfasi: "costruzione a strati, picco sul terzo crescendo, ritorno morbido",
    melodia: "motivo di chitarra ripetuto con variazioni, modo eolio",
    accordi: "accordi maggiori e minori alternati, cambi ogni 4 battute",
    ritmica: "batteria che passa da pulsazione leggera a battere pieno, 4/4",
    tonalita: ["Sol minore", "Re minore", "Do maggiore"],
    varianti: [
      { nome: "delay", keywords: "delayed guitars, building drums, cinematic" },
      { nome: "arpeggi", keywords: "clean arpeggio guitars, glockenspiel, expansive" }
    ],
    colori: ["#1b2631", "#4a6fa5", "#e8d5b5"]
  },
  {
    name: "Blues-shuffle-strumentale",
    energia: 3,
    bpm: [100, 116],
    attivita: "sottofondo con groove, pedalata e lavoro a ritmo",
    strutture: ["arco", "loop"],
    genere: "Blues shuffle strumentale",
    stile: "instrumental blues shuffle, slide guitar, drums with swing shuffle, warm organ, played by a band, lively",
    strumenti: ["chitarra slide", "batteria con shuffle", "basso walking", "organo hammond", "chitarra ritmica elettrica"],
    vietati: ["voce", "synth", "drum machine rigida", "pad lunghi"],
    influenze: [{ genere: "blues", peso: 3 }, { genere: "rock", peso: 1 }, { genere: "boogie", peso: 1 }],
    enfasi: "assoli brevi che si alternano al groove, crescita sul ritornello",
    melodia: "frase blues di slide con bending, pentatonica minore con blue note",
    accordi: "dodici battute blues, dominanti di settima",
    ritmica: "shuffle in 12/8 sentito in 4/4, rullante sul due e sul quattro",
    tonalita: ["Mi minore", "La minore", "Mi maggiore"],
    varianti: [
      { nome: "slide", keywords: "slide guitar blues, shuffle drums, walking bass" },
      { nome: "hammond", keywords: "hammond organ blues, shuffle drums, warm guitar" }
    ],
    colori: ["#3a1f0f", "#b5651d", "#f5d27a"]
  },
  {
    name: "Indie-rock-strumentale",
    energia: 4,
    bpm: [116, 130],
    attivita: "sottofondo positivo e movimentato, studio e attivita leggere",
    strutture: ["loop", "crescendo"],
    genere: "Indie rock strumentale",
    stile: "instrumental indie rock, jangly guitars, driving drums, bright and energetic, played by a band",
    strumenti: ["chitarra elettrica jangle", "batteria rock", "basso elettrico", "chitarra ritmica con power chord", "tastiera vintage"],
    vietati: ["voce", "synth dominante", "pad lunghi", "drop elettronico"],
    influenze: [{ genere: "indie rock", peso: 3 }, { genere: "power pop", peso: 1 }, { genere: "new wave", peso: 1 }],
    enfasi: "ritornelli di chitarra che si aprono, batteria che accelera nel finale",
    melodia: "riff breve e orecchiabile, modo maggiore con passaggi minori",
    accordi: "progressione I-V-vi-IV con power chord e arpeggi",
    ritmica: "batteria in 4/4 con colpo sul levare, basso sugli ottavi",
    tonalita: ["Sol maggiore", "Re maggiore", "Mi minore"],
    varianti: [
      { nome: "jangle", keywords: "jangly guitars, driving drums, bright" },
      { nome: "tastiera", keywords: "vintage keyboard, rock drums, energetic guitars" }
    ],
    colori: ["#1e2f3a", "#3a9ad9", "#ffd166"]
  },
  {
    name: "Rockabilly-strumentale",
    energia: 5,
    bpm: [132, 146],
    attivita: "sottofondo molto movimentato, cardio e ritmo alto",
    strutture: ["loop", "arco"],
    genere: "Rockabilly strumentale",
    stile: "instrumental rockabilly, fast slap bass, twangy electric guitar, swinging drums, lively and joyful, played by a band",
    strumenti: ["contrabbasso slap", "chitarra elettrica twang", "batteria rockabilly", "chitarra solista con bending", "claps"],
    vietati: ["voce", "synth", "drum machine rigida", "pad lunghi"],
    influenze: [{ genere: "rockabilly", peso: 3 }, { genere: "rock and roll", peso: 2 }, { genere: "country", peso: 1 }],
    enfasi: "assolo di chitarra che sale, ritorno al tema con batteria piena",
    melodia: "tema veloce di chitarra con bending, modo misolidio",
    accordi: "giro rock and roll I-IV-V con dominanti",
    ritmica: "shuffle veloce in 4/4, contrabbasso slap sul battere",
    tonalita: ["Mi maggiore", "La maggiore", "Re maggiore"],
    varianti: [
      { nome: "contrabbasso", keywords: "slap upright bass, twangy guitar, swinging drums" },
      { nome: "claps", keywords: "rockabilly guitar, claps, fast drums, lively" }
    ],
    colori: ["#4a1d2b", "#e04b5a", "#ffe066"]
  }
];

let aggiunti = 0;
for (const g of nuovi) {
  if (nomi.has(g.name)) continue;
  cat.categories.push(g);
  aggiunti++;
}
fs.writeFileSync(file, JSON.stringify(cat, null, 2));
console.log('generi aggiunti:', aggiunti, '| totale:', cat.categories.length);
