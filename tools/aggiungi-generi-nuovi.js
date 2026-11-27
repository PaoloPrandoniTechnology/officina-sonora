// Aggiunge i generi proposti (strumentali e vocali senza parole) e alcuni piu' intensi.
// I generi vocali hanno vocale_senza_parole: niente "senza voce" e niente LoRA strumentale.
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/config/catalogo.json';
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const nomi = new Set(cat.categories.map((c) => c.name));

function gen(o) {
  return Object.assign({
    ambito: 'musica', strutture: ['arco', 'loop'], vietati: ['batteria rock'], influenze: [{ genere: o.genere, peso: 3 }],
    enfasi: 'costruzione graduale e ritorno al tema', melodia: 'tema semplice ripetuto',
    accordi: 'progressione ciclica', tonalita: ['La minore', 'Do maggiore'],
    varianti: [{ nome: 'base', keywords: o.stile }, { nome: 'variante', keywords: o.stile }],
  }, o);
}

const nuovi = [
  gen({ name: 'Synthwave', famiglia: 'elettronico', energia: 3, bpm: [100, 118], attivita: 'studio e lavoro, sottofondo retro', genere: 'Synthwave strumentale',
    stile: 'instrumental synthwave, retro analog synths, gated reverb drums, arpeggiated bass, nostalgic and bright', strumenti: ['synth analogico', 'arpeggiatore', 'batteria elettronica con reverb', 'basso sintetico', 'pad analogico'],
    vietati: ['voce', 'chitarra acustica', 'archi'], colori: ['#1a0b2e', '#ff2e88', '#00e5ff'], strutture: ['loop', 'arco'] }),
  gen({ name: 'Flamenco-chitarra', famiglia: 'world', energia: 4, bpm: [110, 130], attivita: 'sottofondo vivo e ritmato', genere: 'Flamenco chitarra',
    stile: 'instrumental flamenco guitar, rasgueado and palmas, passionate and rhythmic, played by a guitarist', strumenti: ['chitarra flamenca', 'palmas', 'cajon', 'basso acustico'],
    vietati: ['voce', 'synth', 'batteria elettronica'], colori: ['#3d0c02', '#c62828', '#ffd54f'], strutture: ['loop', 'crescendo'] }),
  gen({ name: 'Celtic-arpa-whistle', famiglia: 'world', energia: 2, bpm: [80, 100], attivita: 'lettura e pausa narrativa', genere: 'Celtic arpa e whistle',
    stile: 'instrumental celtic folk, harp arpeggios, tin whistle melody, soft bodhran, gentle and storytelling', strumenti: ['arpa celtica', 'tin whistle', 'bodhran leggero', 'violino celtico'],
    vietati: ['voce', 'synth', 'batteria rock'], colori: ['#1f3d2b', '#5fa776', '#e9f5c9'], strutture: ['arco', 'onda'] }),
  gen({ name: 'Drum-and-bass-soft', famiglia: 'elettronico', energia: 5, bpm: [160, 172], attivita: 'sottofondo intenso per sessioni brevi', genere: 'Drum and bass morbido',
    stile: 'soft drum and bass, fast breakbeat, deep sub bass, airy pads, energetic but smooth', strumenti: ['breakbeat', 'basso sub', 'pad aereo', 'hi-hat veloci', 'stab di sintetizzatore'],
    vietati: ['voce', 'chitarra distorta', 'pianoforte'], colori: ['#0d1b2a', '#1b98e0', '#f1faee'], strutture: ['loop', 'crescendo'] }),
  gen({ name: 'Gamelan-ambient', famiglia: 'world', energia: 1, bpm: [60, 75], attivita: 'meditazione e concentrazione', genere: 'Gamelan ambient',
    stile: 'gamelan ambient, interlocking metallophones, shimmering textures, slow and cyclical', strumenti: ['metallofoni gamelan', 'gong sospeso', 'bambu', 'drone leggero'],
    vietati: ['batteria', 'synth', 'voce'], colori: ['#2e1a05', '#b8860b', '#fff1c1'], strutture: ['piatto', 'onda'] }),
  gen({ name: 'Bossa-nova-chitarra', famiglia: 'jazz', energia: 2, bpm: [90, 110], attivita: 'pranzo, lettura, sottofondo rilassato', genere: 'Bossa nova chitarra',
    stile: 'instrumental bossa nova, nylon guitar, soft bass, light percussion, warm and airy', strumenti: ['chitarra classica', 'basso acustico', 'shaker', 'flauto morbido'],
    vietati: ['batteria rock', 'synth', 'voce'], colori: ['#2b3a2e', '#9ec5a0', '#fdf6e3'], strutture: ['arco', 'onda'] }),
  gen({ name: 'Vocalise-coro', famiglia: 'meditativo', energia: 1, bpm: [60, 75], attivita: 'meditazione con voci', genere: 'Vocalise coro',
    stile: 'wordless choral vocalise, ah and oh vowels, soft choir, no lyrics, no words, sacred and calm', strumenti: ['coro di voci su vocali', 'pad morbido', 'campane leggere'],
    vietati: ['batteria', 'parole', 'testo cantato'], colori: ['#2c2140', '#8e7cc3', '#f4ecff'], strutture: ['piatto', 'onda'], vocale_senza_parole: true }),
  gen({ name: 'Overtone-canto', famiglia: 'meditativo', energia: 1, bpm: [50, 65], attivita: 'meditazione profonda', genere: 'Canto armonico overtone',
    stile: 'overtone singing, harmonic voice, hypnotic and deep, no words, sustained tones', strumenti: ['voce armonica', 'drone di tanpura', 'campane'],
    vietati: ['batteria', 'parole', 'synth'], colori: ['#101418', '#4a6670', '#d6e6e8'], strutture: ['piatto'], vocale_senza_parole: true }),
  gen({ name: 'Canto-gregoriano-moderno', famiglia: 'meditativo', energia: 1, bpm: [60, 72], attivita: 'raccoglimento e silenzio', genere: 'Canto monodico moderno',
    stile: 'modern monodic chant, male and female voices on vowels, church bells and soft pads, no words, reverent', strumenti: ['voci monodiche su vocali', 'campane', 'organo', 'pad'],
    vietati: ['batteria', 'parole', 'synth ritmico'], colori: ['#1e1b16', '#7a6a4f', '#f5ecd6'], strutture: ['piatto', 'arco'], vocale_senza_parole: true }),
  gen({ name: 'Soul-vocalise', famiglia: 'ritmico', energia: 3, bpm: [85, 100], attivita: 'sottofondo caldo con groove', genere: 'Soul vocalise',
    stile: 'soul vocalise, improvised wordless vocals on vowels, warm bass and drums, groove, no lyrics', strumenti: ['voce soul su vocali', 'basso groove', 'batteria soul', 'rhodes', 'fiati leggeri'],
    vietati: ['parole', 'testo cantato', 'drop elettronico'], colori: ['#3b1d2a', '#d1607a', '#ffd6a5'], strutture: ['loop', 'arco'], vocale_senza_parole: true }),
  // Piu' intensi
  gen({ name: 'Metal-strumentale', famiglia: 'rock', energia: 5, bpm: [130, 150], attivita: 'sessioni intense di allenamento', genere: 'Metal strumentale',
    stile: 'instrumental heavy metal, distorted guitars, double bass drums, aggressive riffs, played by a band', strumenti: ['chitarra distorta', 'batteria a doppio pedale', 'basso distorto', 'chitarra solista', 'tastiera di sfondo'],
    vietati: ['voce', 'pad morbidi', 'archi'], colori: ['#050505', '#a4161a', '#e5e5e5'], strutture: ['loop', 'crescendo'] }),
  gen({ name: 'Industrial-techno', famiglia: 'elettronico', energia: 5, bpm: [132, 145], attivita: 'concentrazione intensa e ritmo forte', genere: 'Industrial techno',
    stile: 'industrial techno, heavy kick, metallic percussion, distorted synths, dark and driving', strumenti: ['kick potente', 'percussione metallica', 'synth distorto', 'basso industriale', 'rumore'],
    vietati: ['voce', 'chitarra acustica', 'pad caldi'], colori: ['#0b0b0b', '#5b5b5b', '#c0ff3e'], strutture: ['loop', 'crescendo'] }),
  gen({ name: 'Trap-strumentale', famiglia: 'elettronico', energia: 4, bpm: [136, 150], attivita: 'sottofondo ritmico e moderno', genere: 'Trap strumentale',
    stile: 'instrumental trap beat, rolling hi-hats, booming 808 bass, dark melodies, modern and punchy', strumenti: ['808', 'hi-hat rapidi', 'kick', 'campana melodica', 'pad scuro'],
    vietati: ['voce', 'chitarra acustica', 'archi'], colori: ['#121212', '#7b2cbf', '#f72585'], strutture: ['loop', 'arco'] }),
  gen({ name: 'Hard-rock-strumentale', famiglia: 'rock', energia: 5, bpm: [120, 138], attivita: 'energia alta e sottofondo grintoso', genere: 'Hard rock strumentale',
    stile: 'instrumental hard rock, overdriven guitars, powerful drums, big riffs and solos, played by a band', strumenti: ['chitarra overdrive', 'batteria potente', 'basso rock', 'chitarra solista', 'organo'],
    vietati: ['voce', 'synth', 'pad lunghi'], colori: ['#2a0a0a', '#d62828', '#f7b267'], strutture: ['arco', 'loop'] }),
];

let aggiunti = 0;
for (const g of nuovi) {
  if (nomi.has(g.name)) continue;
  cat.categories.push(g);
  aggiunti++;
}
fs.writeFileSync(file, JSON.stringify(cat, null, 2));
console.log('generi aggiunti:', aggiunti, '| totale:', cat.categories.length);
