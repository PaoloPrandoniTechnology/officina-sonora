// Migrazione al modello unico dei generi: 'ambito' diventa 'raccolta', 'vocale_senza_parole' diventa 'voce',
// il carattere del compositore si scrive in ogni genere. Aggiunge raccolte, lingue e due generi cantati di
// esempio, sospesi. Si puo' rilanciare: non tocca cio' che c'e' gia'. Con la produzione accesa: prima
// `node tools/migra-generi.js --tieni` (restano anche i campi vecchi), poi pubblica il workflow e rilancia senza.
const fs = require('fs');
const path = require('path');
const { scriviAtomico } = require('../gateway/disco');

// carattere che il compositore dava a ogni genere per nome, prima di scriverlo nel catalogo
const CARATTERI = {
  Meditazione: 'drone', 'Pranayama-respiro': 'drone', 'Yin-Savasana': 'drone', Restorative: 'drone', 'Sound-bath-rilassamento': 'drone',
  'Hatha-base': 'folk', 'Vinyasa-dinamico': 'elettro', 'Power-yoga': 'elettro', 'Funk-groove': 'funk', 'Afro-latin-groove': 'funk',
  'Trip-hop-dolce': 'funk', 'Reggae-dub-morbido': 'funk', 'Jazz-lounge': 'jazz', 'Folk-strumming': 'folk', 'Surf-rock-strumentale': 'rock',
  'Post-rock-strumentale': 'cine', 'Blues-shuffle-strumentale': 'blues', 'Indie-rock-strumentale': 'rock', 'Rockabilly-strumentale': 'blues',
  'Techno-minimale': 'elettro', 'Piano-minimalista': 'cine', 'Score-cinematico': 'cine', 'Folk-balcanico': 'balcanico', 'Beat-hip-hop': 'funk',
  'Manouche-swing': 'jazz', Synthwave: 'elettro', 'Flamenco-chitarra': 'flamenco', 'Celtic-arpa-whistle': 'folk', 'Drum-and-bass-soft': 'elettro',
  'Gamelan-ambient': 'drone', 'Bossa-nova-chitarra': 'jazz', 'Vocalise-coro': 'drone', 'Overtone-canto': 'drone', 'Canto-gregoriano-moderno': 'drone',
  'Soul-vocalise': 'elettro', 'Metal-strumentale': 'rock', 'Industrial-techno': 'elettro', 'Trap-strumentale': 'elettro', 'Hard-rock-strumentale': 'rock',
};

const cantato = (name, genere, extra) => ({
  name, genere, raccolta: 'Canzoni', famiglia: 'canzone', voce: 'testo', testi: 'approvazione', energia: 3, estro: 0, strutture: ['arco', 'onda'],
  vietati: [], influenze: [], enfasi: 'ritornello cantabile e memorabile', melodia: 'linea vocale chiara', accordi: 'giri semplici e caldi',
  varianti: [{ nome: 'base', keywords: extra.stile }], ...extra,
});
const NUOVI = [
  cantato('Canzone-italiana', 'Canzone italiana', {
    lingua: 'it', timbro: 'maschile', temi: 'amore, ricordi, il mare d’estate, la propria città', carattere: 'cine', bpm: [70, 95], durata: '180-240',
    attivita: 'ascolto', stile: 'Italian pop ballad, piano and strings, sweeping chorus', ritmica: '4/4 lento', tonalita: ['La minore', 'Do maggiore', 'Fa maggiore'],
    strumenti: ['pianoforte', 'archi', 'basso elettrico', 'batteria morbida', 'chitarra classica'], organico: { fissi: ['pianoforte', 'archi', 'basso elettrico'], scelta: ['batteria morbida', 'chitarra classica'] },
    lora: [{ name: 'yue2-canzone-italiana', scale: 1, ar_scale: 1, nar_scale: 0, innesco: 'cnzn' }],
    colori: ['#3a1f1f', '#c0504d', '#f6e7c9'], copertina: { etichetta: 'Canzone', prompt: 'Italian seaside town at golden hour, vintage film photograph, warm red and cream', font: 'Georgia', corsivo: true },
    en: { genre: 'Italian pop ballad', instruments: { pianoforte: 'expressive piano', archi: 'sweeping strings', 'basso elettrico': 'warm electric bass', 'batteria morbida': 'soft brushed drums', 'chitarra classica': 'nylon string guitar' }, rhythm: 'slow steady beat', mood: 'warm, nostalgic, sweeping chorus', space: 'close warm vocal with natural reverb', influences: {} },
  }),
  cantato('Pop-inglese', 'Pop inglese', {
    lingua: 'en', timbro: 'femminile', temi: 'new beginnings, city nights, friendship', carattere: 'folk', bpm: [92, 118], durata: '160-220',
    attivita: 'ascolto', stile: 'modern acoustic pop, catchy chorus', ritmica: '4/4', tonalita: ['Do maggiore', 'Sol maggiore', 'La minore'],
    strumenti: ['chitarra acustica', 'basso', 'batteria pop', 'pianoforte', 'pad'], organico: { fissi: ['chitarra acustica', 'basso', 'batteria pop'], scelta: ['pianoforte', 'pad'] },
    colori: ['#14213d', '#fca311', '#e5e5e5'], copertina: { etichetta: 'Pop', prompt: 'city street at dusk with soft bokeh lights, modern editorial photograph, navy and amber', font: 'Bahnschrift', corsivo: false },
    en: { genre: 'modern acoustic pop', instruments: { 'chitarra acustica': 'strummed acoustic guitar', basso: 'round electric bass', 'batteria pop': 'tight pop drums', pianoforte: 'bright piano', pad: 'soft synth pad' }, rhythm: 'steady mid tempo beat', mood: 'uplifting, catchy chorus', space: 'clean modern mix with the vocal up front', influences: {} },
  }),
];

function migra(cat, { tieni = false } = {}) {
  cat.raccolte = cat.raccolte || [{ nome: 'Yoga', playlist: 'Yoga' }, { nome: 'Sottofondo', playlist: 'Musica' }, { nome: 'Canzoni', playlist: 'Canzoni' }];
  cat.lingue = cat.lingue || [{ codice: 'it', nome: 'Italiano', en: 'Italian', id3: 'ita' }, { codice: 'en', nome: 'Inglese', en: 'English', id3: 'eng' }];
  for (const c of cat.categories) {
    if (!c.raccolta) c.raccolta = c.ambito === 'yoga' ? 'Yoga' : 'Sottofondo';
    if (!c.voce) c.voce = c.vocale_senza_parole ? 'vocalizzi' : 'strumentale';
    if (!c.carattere && CARATTERI[c.name]) c.carattere = CARATTERI[c.name];
    if (!tieni) { delete c.ambito; delete c.vocale_senza_parole; }
  }
  const aggiunti = NUOVI.filter((n) => !cat.categories.some((c) => c.name === n.name));
  cat.categories.push(...aggiunti);
  return aggiunti.map((n) => n.name);
}

function main(base = path.join(__dirname, '..'), opzioni = { tieni: process.argv.includes('--tieni') }) {
  const file = path.join(base, 'config', 'catalogo.json');
  const parametri = path.join(base, 'config', 'parametri.json');
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
  const aggiunti = migra(cat, opzioni);
  // prima si sospendono i generi nuovi, poi compaiono nel catalogo: la produzione non li prende per sbaglio
  if (aggiunti.length) {
    const p = JSON.parse(fs.readFileSync(parametri, 'utf8'));
    p.generi = p.generi || {};
    for (const n of aggiunti) p.generi[n] = { peso: 1, attivo: false, note: [] };
    scriviAtomico(parametri, JSON.stringify(p, null, 2));
  }
  scriviAtomico(file, JSON.stringify(cat, null, 2));
  console.log(`generi ${cat.categories.length}, aggiunti e sospesi: ${aggiunti.join(', ') || 'nessuno'}`);
}

module.exports = { migra, CARATTERI };
if (require.main === module) main();
