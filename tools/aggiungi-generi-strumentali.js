// Aggiunge sei generi strumentali molto diversi tra loro, tutti con ambito musica e famiglia propria.
const fs = require('fs');
const file = 'E:/n8n/yoga/config/catalogo.json';
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const nomi = new Set(cat.categories.map((c) => c.name));

const nuovi = [
  {
    name: "Techno-minimale",
    energia: 4,
    bpm: [122, 130],
    attivita: "sottofondo ipnotico, ritmo costante per attivita leggere",
    strutture: ["loop", "crescendo"],
    genere: "Techno minimale",
    stile: "minimal techno, hypnotic four-on-the-floor kick, sparse hi-hats, filtered bass, clean and precise, electronic production",
    strumenti: ["drum machine kick", "hi-hat sintetico", "basso filtrato", "stab di sintetizzatore", "rumore percussivo"],
    vietati: ["voce", "chitarra", "archi", "pianoforte acustico"],
    influenze: [{ genere: "minimal techno", peso: 3 }, { genere: "deep house", peso: 1 }, { genere: "dub techno", peso: 1 }],
    enfasi: "costruzione lenta per sottrazione e aggiunta di elementi, filtro che si apre",
    melodia: "poche note di sintetizzatore ripetute, modo minore",
    accordi: "accordo minore statico con cambi rari",
    ritmica: "kick in 4/4 costante, hi-hat sull'offbeat",
    tonalita: ["La minore", "Do minore", "Fa diesis minore"],
    varianti: [
      { nome: "filtro", keywords: "filtered bass, hypnotic kick, sparse hats" },
      { nome: "dub", keywords: "dub techno chords, echoes, minimal kick" }
    ],
    colori: ["#0a0f14", "#2b4c5e", "#7ae7ff"]
  },
  {
    name: "Piano-minimalista",
    energia: 1,
    bpm: [60, 78],
    attivita: "concentrazione e pausa, musica di fondo molto calma",
    strutture: ["piatto", "onda"],
    genere: "Piano minimalista",
    stile: "minimalist piano, repeating short patterns, gentle and precise, played by a pianist, quiet dynamics",
    strumenti: ["pianoforte acustico", "pianoforte preparato leggero", "violoncello lontano", "celesta"],
    vietati: ["batteria", "synth", "voce", "distorsione"],
    influenze: [{ genere: "minimalismo", peso: 3 }, { genere: "musica da camera", peso: 1 }, { genere: "neoclassica", peso: 1 }],
    enfasi: "cellule ripetute che si sovrappongono lentamente, nessun picco",
    melodia: "cellula di 3-4 note ripetuta con variazioni, modo lidio",
    accordi: "accordi maggiori e aggiunte, cambi lenti",
    ritmica: "pulsazione regolare e quieta in 4/4, nessun accento forte",
    tonalita: ["Do maggiore", "Re maggiore", "La maggiore"],
    varianti: [
      { nome: "solo", keywords: "solo piano, repeating patterns, gentle" },
      { nome: "celesta", keywords: "celesta and piano, minimal patterns, delicate" }
    ],
    colori: ["#1a1a24", "#5d6b8a", "#f0e6d2"]
  },
  {
    name: "Score-cinematico",
    energia: 3,
    bpm: [84, 104],
    attivita: "sottofondo narrativo, lettura e lavoro creativo",
    strutture: ["arco", "crescendo"],
    genere: "Score cinematico",
    stile: "cinematic orchestral score, strings and horns, timpani and soft brass, sweeping and emotional, played by an orchestra",
    strumenti: ["archi sinfonici", "corni", "timpani", "arpa", "ottoni morbidi"],
    vietati: ["batteria rock", "synth", "voce", "chitarra elettrica"],
    influenze: [{ genere: "colonna sonora", peso: 3 }, { genere: "musica sinfonica", peso: 2 }, { genere: "epic", peso: 1 }],
    enfasi: "crescendo orchestrale verso un picco di ottoni e timpani, poi ritorno intimo",
    melodia: "tema lirico per archi, intervalli ampi, modo minore",
    accordi: "progressione sinfonica con sospensioni e dominanti",
    ritmica: "respiro lento in 4/4, timpani sui punti di tensione",
    tonalita: ["Re minore", "Sol minore", "Mi bemolle maggiore"],
    varianti: [
      { nome: "archi", keywords: "sweeping strings, emotional, cinematic score" },
      { nome: "corni", keywords: "french horns, timpani, orchestral crescendo" }
    ],
    colori: ["#241b2f", "#7c4d6b", "#f2c57c"]
  },
  {
    name: "Folk-balcanico",
    energia: 5,
    bpm: [132, 146],
    attivita: "sottofondo vivace e festoso, movimento energico",
    strutture: ["loop", "arco"],
    genere: "Folk balcanico strumentale",
    stile: "balkan instrumental folk, accordion and clarinet, fast drums, lively and festive, played by a folk ensemble",
    strumenti: ["fisarmonica", "clarinetto", "tamburo a cornice", "violino", "basso acustico"],
    vietati: ["synth", "voce", "drum machine rigida", "pad lunghi"],
    influenze: [{ genere: "musica balcanica", peso: 3 }, { genere: "klezmer", peso: 1 }, { genere: "folk", peso: 1 }],
    enfasi: "ballo che accelera a ondate, ritorno al tema con tutto l'ensemble",
    melodia: "tema veloce di clarinetto, scala balcanica con intervalli aumentati",
    accordi: "giro minore con bordone di fisarmonica",
    ritmica: "tempo dispari in ritmo di danza, tamburo a cornice sui battere",
    tonalita: ["Mi minore", "La minore", "Re minore"],
    varianti: [
      { nome: "fisarmonica", keywords: "accordion dance, fast clarinet, frame drum" },
      { nome: "violino", keywords: "fiddle dance, balkan rhythm, lively ensemble" }
    ],
    colori: ["#3a1f14", "#c0503a", "#f6d37a"]
  },
  {
    name: "Beat-hip-hop",
    energia: 3,
    bpm: [84, 96],
    attivita: "sottofondo rilassato con groove, studio e pause attive",
    strutture: ["loop", "onda"],
    genere: "Beat hip-hop strumentale",
    stile: "instrumental hip-hop beat, boom-bap drums, vinyl crackle, warm sampled keys, head-nodding groove",
    strumenti: ["batteria boom-bap", "campione di piano", "basso sub", "giradischi con crackle", "vibrafono campionato"],
    vietati: ["voce", "chitarra distorta", "archi lunghi", "drop elettronico"],
    influenze: [{ genere: "boom-bap", peso: 3 }, { genere: "jazz hop", peso: 2 }, { genere: "lo-fi", peso: 1 }],
    enfasi: "loop che evolve lentamente, un elemento in piu ad ogni giro",
    melodia: "campione di piano o vibrafono in loop, poche note",
    accordi: "giro di accordi minori di nona, cambio ogni due battute",
    ritmica: "boom-bap in 4/4, grancassa sul uno e tre, rullante sul due e quattro",
    tonalita: ["Fa minore", "Si bemolle minore", "Do minore"],
    varianti: [
      { nome: "boom-bap", keywords: "boom-bap drums, sampled piano, vinyl crackle" },
      { nome: "jazz", keywords: "jazz hop, vibraphone sample, warm sub bass" }
    ],
    colori: ["#1c1c1c", "#6d4c41", "#d7c49e"]
  },
  {
    name: "Manouche-swing",
    energia: 4,
    bpm: [132, 146],
    attivita: "sottofondo allegro e virtuosistico, energia positiva",
    strutture: ["arco", "loop"],
    genere: "Manouche swing strumentale",
    stile: "gypsy jazz manouche swing, rhythm guitars, lead violin and guitar, fast and joyful, played by a quintet",
    strumenti: ["chitarra manouche ritmica", "chitarra solista", "violino jazz", "contrabbasso", "chitarra acustica pizzicata"],
    vietati: ["batteria elettronica", "synth", "voce", "distorsione"],
    influenze: [{ genere: "gypsy jazz", peso: 3 }, { genere: "swing", peso: 2 }, { genere: "musette", peso: 1 }],
    enfasi: "assoli che si passano tra violino e chitarra, ritorno al tema corale",
    melodia: "tema veloce e cantabile, modo maggiore con cromatismi",
    accordi: "giro di dominanti e diminuite, ritmo di chitarra a pulsazione",
    ritmica: "swing in 4/4 con chitarra ritmica pulsante e contrabbasso sui quarti",
    tonalita: ["Sol maggiore", "Re maggiore", "La maggiore"],
    varianti: [
      { nome: "quintetto", keywords: "gypsy jazz quintet, lead violin, rhythm guitar" },
      { nome: "chitarra", keywords: "manouche guitar, swing rhythm, joyful" }
    ],
    colori: ["#2d2412", "#a77a3c", "#ffe9b0"]
  }
];

let aggiunti = 0;
for (const g of nuovi) {
  if (nomi.has(g.name)) continue;
  g.ambito = "musica";
  g.famiglia = g.famiglia || (g.energia <= 1 ? "meditativo" : g.energia >= 4 ? "ritmico" : "generale");
  cat.categories.push(g);
  aggiunti++;
}
fs.writeFileSync(file, JSON.stringify(cat, null, 2));
console.log("generi strumentali aggiunti:", aggiunti, "| totale:", cat.categories.length);
