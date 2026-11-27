// Tassonomia dei generi e meccanismo di voto per tutti i generi (yoga e musica).
// - Ogni genere ha: ambito (yoga | musica), famiglia (meditativo | ritmico | rock), categoria.
// - Tag su iBroadcast: ambito-*, famiglia-*, categoria-*, energia-*, voto tag/playlist.
// - Parole di voto valide per ogni genere, e tag di tempo che regolano il bpm del genere (entro limiti fissi).
const fs = require('fs');
const base = 'E:/n8n/officina-sonora/';

// 1) Famiglia per ogni categoria
const cat = JSON.parse(fs.readFileSync(base + 'config/catalogo.json', 'utf8'));
const famiglie = {
  'Meditazione': 'meditativo', 'Pranayama-respiro': 'meditativo', 'Yin-Savasana': 'meditativo',
  'Restorative': 'meditativo', 'Sound-bath-rilassamento': 'meditativo', 'Reggae-dub-morbido': 'meditativo', 'Jazz-lounge': 'meditativo',
  'Hatha-base': 'ritmico', 'Vinyasa-dinamico': 'ritmico', 'Power-yoga': 'ritmico', 'Funk-groove': 'ritmico',
  'Afro-latin-groove': 'ritmico', 'Trip-hop-dolce': 'ritmico', 'Folk-strumming': 'ritmico',
  'Surf-rock-strumentale': 'rock', 'Post-rock-strumentale': 'rock', 'Blues-shuffle-strumentale': 'rock',
  'Indie-rock-strumentale': 'rock', 'Rockabilly-strumentale': 'rock',
};
for (const c of cat.categories) c.famiglia = famiglie[c.name] || 'generale';
fs.writeFileSync(base + 'config/catalogo.json', JSON.stringify(cat, null, 2));

// 2) Tassonomia e parole di voto: nel catalogo, cosi' i generi futuri le ereditano
const tass = {
  voto: {
    preferito: 'preferit|fav|like|top|\\bok\\b|mi.?piace|da.?sottofondo|bello|perfetto',
    scartato: 'scart|skip|brutt|\\bno\\b|delete|noios|non.?mi.?piace',
  },
  tempo: {
    'piu-veloce': 'piu.?veloce|più.?veloce|veloce|ritmo.?alto',
    'piu-lento': 'piu.?lento|più.?lento|lento|rilassat',
  },
  passoBpm: 6,
  limiteBpm: 15,
  nota: 'Per un nuovo genere basta aggiungerlo a config/catalogo.json con ambito, famiglia, colori e varianti: tag, playlist, voti e tempo funzionano da soli.',
};
cat.tassonomia = tass;
fs.writeFileSync(base + 'config/catalogo.json', JSON.stringify(cat, null, 2));
console.log('famiglie assegnate; tassonomia e parole di voto scritte nel catalogo');
