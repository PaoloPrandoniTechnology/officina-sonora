// Riorganizza la libreria per il nuovo target (musica di sottofondo generale).
// Nuova radice: E:\Musica di sottofondo\<ambito>\<famiglia>\<categoria>\<tipo>\
//   ambito: Yoga (generi di pratica) | Sottofondo (tutti gli altri generi)
// Sposta solo file locali: iBroadcast usa gli id, non i percorsi.
const fs = require('fs');
const path = require('path');

const vecchiaRadice = 'E:/libreria-storica';
const nuovaRadice = 'E:/Musica di sottofondo';
const cat = JSON.parse(fs.readFileSync('E:/n8n/officina-sonora/config/catalogo.json', 'utf8'));
const infoCat = Object.fromEntries(cat.categories.map((c) => [c.name, c]));
const etichetta = (ambito) => (ambito === 'yoga' ? 'Yoga' : 'Sottofondo');

fs.mkdirSync(nuovaRadice, { recursive: true });
let spostati = 0, saltati = 0;

// Brani (mp3 + json) della vecchia radice, con categoria e tipo
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    if (!fs.existsSync(path.join(dir, n))) continue; // gia' spostato
    const f = path.join(dir, n);
    if (fs.statSync(f).isDirectory()) { if (n !== '_scartati') walk(f); continue; }
    if (!n.endsWith('.json') || n === 'feedback.json') continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!m.titolo) continue;
    const c = infoCat[m.categoria] || {};
    const dest = path.join(nuovaRadice, etichetta(c.ambito || 'musica'), c.famiglia || 'generale', m.categoria || 'senza-categoria', m.tipo || 'senza-tipo');
    fs.mkdirSync(dest, { recursive: true });
    for (const estensione of ['.json', '.mp3']) {
      const src = f.replace(/\.json$/, estensione);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(dest, path.basename(src));
      if (fs.existsSync(dst)) { saltati++; continue; }
      fs.renameSync(src, dst);
      spostati++;
    }
  }
})(vecchiaRadice);

// Feedback e scartati seguono la nuova radice
for (const f of ['feedback.csv']) {
  if (fs.existsSync(path.join(vecchiaRadice, f)) && !fs.existsSync(path.join(nuovaRadice, f))) fs.renameSync(path.join(vecchiaRadice, f), path.join(nuovaRadice, f));
}
if (fs.existsSync(path.join(vecchiaRadice, '_scartati'))) {
  if (!fs.existsSync(path.join(nuovaRadice, '_scartati'))) fs.renameSync(path.join(vecchiaRadice, '_scartati'), path.join(nuovaRadice, '_scartati'));
}
console.log('file spostati:', spostati, '| gia presenti (saltati):', saltati);
