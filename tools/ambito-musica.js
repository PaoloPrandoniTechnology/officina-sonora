// Ambito dei generi: "yoga" per i generi di pratica, "musica" per i generi non yoga.
// Cambia il nome delle playlist (Musica - ...) e il tag applicato su iBroadcast, e lo usa anche il controllo dei voti.
const fs = require('fs');
const base = 'E:/n8n/officina-sonora/';

// 1) Catalogo: ambito per ogni genere
const cat = JSON.parse(fs.readFileSync(base + 'config/catalogo.json', 'utf8'));
const musica = new Set(['Surf-rock-strumentale', 'Post-rock-strumentale', 'Blues-shuffle-strumentale', 'Indie-rock-strumentale', 'Rockabilly-strumentale']);
for (const c of cat.categories) c.ambito = musica.has(c.name) ? 'musica' : 'yoga';
fs.writeFileSync(base + 'config/catalogo.json', JSON.stringify(cat, null, 2));

// 2) Playlist e tag su iBroadcast (libreria condivisa dei nodi di caricamento)
const f = base + 'src/lib-ibroadcast.js';
let s = fs.readFileSync(f, 'utf8');
function sost(da, a) {
  if (!s.includes(da)) throw new Error('non trovato: ' + da.slice(0, 70));
  s = s.replace(da, a);
}
sost("      name: `Yoga - ${meta.categoria}`,",
  "      name: `${ambitoDi(meta) === 'musica' ? 'Musica' : 'Yoga'} - ${meta.categoria}`,");
sost("  const names = ['yoga', `categoria-${slug(meta.categoria)}`",
  "  const names = [ambitoDi(meta) === 'musica' ? 'musica' : 'yoga', `categoria-${slug(meta.categoria)}`");
// funzione di supporto, definita una volta in testa alla libreria
sost("// Chiamata all'API iBroadcast tramite il gateway locale",
  "// Ambito del brano (yoga o musica), dal catalogo\nfunction ambitoDi(meta) {\n  const c = (CFG.categories || []).find((x) => x.name === meta.categoria);\n  return (c && c.ambito) || 'yoga';\n}\n\n// Chiamata all'API iBroadcast tramite il gateway locale");
fs.writeFileSync(f, s);

// 3) Voti da iBroadcast: le playlist e i tag Musica sono di sistema, non segnali di voto
const v = base + 'src/blocks/10-voti-ibroadcast.js';
let t = fs.readFileSync(v, 'utf8');
const vecchio = "const mai = (nome) => /^(yoga|categoria-|energia-|struttura-|tipo-|Yoga - |Recently|Most Recent)/i.test(nome || '');";
if (!t.includes(vecchio)) throw new Error('regex voti non trovata');
t = t.replace(vecchio, "const mai = (nome) => /^(yoga|musica|categoria-|energia-|struttura-|tipo-|Yoga - |Musica - |Recently|Most Recent)/i.test(nome || '');");
fs.writeFileSync(v, t);
console.log('ambito impostato su tutti i generi; playlist e tag aggiornati');
