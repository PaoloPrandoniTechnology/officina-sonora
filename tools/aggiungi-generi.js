// Aggiunge sei generi al catalogo: tre piu' ritmati e tre piu' suonati dal vivo.
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/config/catalogo.json';
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const nomi = new Set(cat.categories.map((c) => c.name));

const nuovi = [
  {
    name: 'Funk-groove',
    energia: 3,
    bpm: [96, 108],
    attivita: 'hatha dinamico, movimento a ritmo',
    strutture: ['arco', 'loop'],
    genere: 'Funk groove leggero',
    stile: 'light funk groove, played by a band, tight rhythm section, warm and joyful, slight swing',
    strumenti: ['basso slap', 'chitarra funk pulita', 'clavinet', 'batteria suonata con spazzole', 'ottoni morbidi'],
    vietati: ['synth distorto', 'voce', 'drum machine rigida', 'pad lunghi'],
    influenze: [{ genere: 'funk', peso: 3 }, { genere: 'soul', peso: 1 }, { genere: 'disco leggero', peso: 1 }],
    enfasi: 'crescita a ondate sui ritornelli, respiro tra le sezioni',
    melodia: 'motivo corto di 2 battute ripetuto, scala pentatonica maggiore',
    accordi: 'accordi di settima dominante e minore, giro breve ripetuto',
    ritmica: 'groove sincopato in 4/4, sedicesimi sul basso, ghost note sulla batteria',
    tonalita: ['Mi minore', 'La maggiore', 'Re minore'],
    varianti: [
      { nome: 'pulito', keywords: 'clean funk guitar, tight bass, brush drums' },
      { nome: 'ottoni', keywords: 'soft horn section, groove, warm organ' },
    ],
    colori: ['#2b1a3d', '#c25b8f', '#ffd166'],
  },
  {
    name: 'Afro-latin-groove',
    energia: 4,
    bpm: [100, 116],
    attivita: 'vinyasa ritmato, flusso a tempo',
    strutture: ['loop', 'crescendo'],
    genere: 'Afro-latin groove',
    stile: 'afro-latin groove, live percussion ensemble, congas and shakers, bright and flowing, human feel',
    strumenti: ['congas', 'bongos', 'shaker', 'timbales leggeri', 'basso acustico', 'chitarra nylon ritmica'],
    vietati: ['batteria rock', 'synth distorto', 'voce', 'drum machine rigida'],
    influenze: [{ genere: 'afro-cuban', peso: 3 }, { genere: 'bossa nova', peso: 1 }, { genere: 'world', peso: 1 }],
    enfasi: 'costruzione per strati: prima le percussioni, poi basso e chitarra',
    melodia: 'frase ritmica ripetuta con piccole variazioni, modo dorico',
    accordi: 'vamp minore con cambi ogni due battute',
    ritmica: 'clave 3-2 sottinteso, pulsazione in 4/4 con sincopi',
    tonalita: ['Re minore', 'Sol minore', 'La minore'],
    varianti: [
      { nome: 'congas', keywords: 'congas, bongos, live percussion, warm' },
      { nome: 'chitarra', keywords: 'nylon guitar montuno, shakers, bright' },
    ],
    colori: ['#3d2a14', '#e07a3f', '#ffe08a'],
  },
  {
    name: 'Trip-hop-dolce',
    energia: 3,
    bpm: [84, 96],
    attivita: 'stretching con ritmo lento, mobilita',
    strutture: ['onda', 'arco'],
    genere: 'Trip-hop dolce',
    stile: 'soft trip-hop, dusty drums, rhodes piano, warm bass, relaxed and melancholic, played feel',
    strumenti: ['rhodes', 'basso elettrico morbido', 'batteria con beat spezzato', 'vibrafono', 'chitarra jazz pulita'],
    vietati: ['synth distorto', 'voce', 'drop elettronico', 'pad lunghi'],
    influenze: [{ genere: 'trip-hop', peso: 3 }, { genere: 'jazz', peso: 1 }, { genere: 'lo-fi', peso: 2 }],
    enfasi: 'battito spezzato che si alterna a passaggi morbidi',
    melodia: 'linea di rhodes semplice, modo dorico, note lunghe',
    accordi: 'accordi di nona e settima, progressione lenta ciclica',
    ritmica: 'beat spezzato a 4/4, grancassa irregolare, rullante in ritardo',
    tonalita: ['Fa minore', 'Do minore', 'Si bemolle maggiore'],
    varianti: [
      { nome: 'rhodes', keywords: 'rhodes piano, warm bass, dusty drums' },
      { nome: 'vibrafono', keywords: 'vibraphone, soft broken beat, jazzy' },
    ],
    colori: ['#1f2a33', '#5c7a86', '#e6c9a0'],
  },
  {
    name: 'Reggae-dub-morbido',
    energia: 2,
    bpm: [70, 82],
    attivita: 'rilassamento con ritmo in levare',
    strutture: ['piatto', 'onda'],
    genere: 'Reggae dub morbido',
    stile: 'soft reggae dub, one-drop rhythm, live bass and organ, spacious echoes, warm and loose',
    strumenti: ['basso reggae', 'organo hammond', 'chitarra skank', 'rullante con eco', 'percussioni leggere'],
    vietati: ['batteria rock', 'synth distorto', 'voce', 'arpeggi veloci'],
    influenze: [{ genere: 'reggae', peso: 3 }, { genere: 'dub', peso: 2 }],
    enfasi: 'eco e riverberi che crescono e svaniscono, battito sempre presente ma calmo',
    melodia: 'poche note, intervalli semplici, modo minore pentatonico',
    accordi: 'accordi minori con settima, skank sul levare',
    ritmica: 'one-drop in 4/4: il battere sul terzo tempo, basso sul levare',
    tonalita: ['La minore', 'Mi minore', 'Re minore'],
    varianti: [
      { nome: 'dub', keywords: 'dub echoes, spacious reverb, organ' },
      { nome: 'roots', keywords: 'roots reggae, live bass, warm guitar skank' },
    ],
    colori: ['#1d3324', '#4f9a52', '#f2c94c'],
  },
  {
    name: 'Jazz-lounge',
    energia: 2,
    bpm: [80, 96],
    attivita: 'rilassamento e respiro lento con musica suonata',
    strutture: ['arco', 'onda'],
    genere: 'Jazz lounge',
    stile: 'jazz lounge trio, played by musicians, upright bass, brushed drums, piano, relaxed and intimate',
    strumenti: ['pianoforte', 'contrabbasso', 'batteria con spazzole', 'sassofono morbido', 'vibrafono'],
    vietati: ['synth', 'drum machine', 'voce', 'distorsione'],
    influenze: [{ genere: 'jazz', peso: 3 }, { genere: 'bossa nova', peso: 1 }, { genere: 'musica da camera', peso: 1 }],
    enfasi: 'improvvisazione misurata, respiri tra le frasi, dinamica naturale',
    melodia: 'frase jazz corta con abbellimenti, modo dorico o misolidio',
    accordi: 'ii-V-I con settime e none, cambi lenti',
    ritmica: 'swing leggero in 4/4, walking bass, spazzole sulla batteria',
    tonalita: ['Do maggiore', 'Fa maggiore', 'Re minore'],
    varianti: [
      { nome: 'trio', keywords: 'piano trio, upright bass, brushed drums' },
      { nome: 'sax', keywords: 'soft tenor sax, piano, walking bass' },
    ],
    colori: ['#2a2238', '#8b5e83', '#f4d6a0'],
  },
  {
    name: 'Folk-strumming',
    energia: 3,
    bpm: [90, 106],
    attivita: 'hatha con ritmo accompagnato, vinyasa lento',
    strutture: ['arco', 'loop'],
    genere: 'Folk strumming',
    stile: 'acoustic folk strumming, played guitars, banjo, light percussion, warm and honest, human feel',
    strumenti: ['chitarra acustica strumming', 'banjo', 'armonica', 'basso acustico', 'shaker e cajon'],
    vietati: ['synth', 'drum machine', 'voce', 'distorsione'],
    influenze: [{ genere: 'folk', peso: 3 }, { genere: 'country leggero', peso: 1 }, { genere: 'americana', peso: 1 }],
    enfasi: 'crescita a ripresa, ritornelli più aperti, poi ritorno intimo',
    melodia: 'motivo semplice in do maggiore o sol maggiore, intervalli di terza',
    accordi: 'I-IV-V-I con varianti sus, giro in quattro battute',
    ritmica: 'strumming in ottavi in 4/4, cajon sul battere',
    tonalita: ['Do maggiore', 'Sol maggiore', 'La minore'],
    varianti: [
      { nome: 'banjo', keywords: 'banjo picking, acoustic strumming, bright' },
      { nome: 'armonica', keywords: 'harmonica, acoustic guitar strumming, warm' },
    ],
    colori: ['#3b2f1e', '#b7845a', '#f7e3b5'],
  },
];

let aggiunti = 0;
for (const g of nuovi) {
  if (nomi.has(g.name)) continue;
  cat.categories.push(g);
  aggiunti++;
}
fs.writeFileSync(file, JSON.stringify(cat, null, 2));
console.log('generi aggiunti:', aggiunti, '| totale:', cat.categories.length);
