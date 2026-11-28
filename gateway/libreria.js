// Indice delle schede dei brani. Una scheda si rilegge solo se il file è cambiato: la dashboard e il
// lettore audio interrogano la libreria in continuazione.
const fs = require('fs');
const path = require('path');

const cache = new Map(); // percorso -> { firma, meta }

function leggi(file) {
  let st;
  try { st = fs.statSync(file); } catch (e) { return null; }
  const firma = `${st.mtimeMs}:${st.ctimeMs}:${st.size}`;
  let voce = cache.get(file);
  if (!voce || voce.firma !== firma) {
    let meta;
    try { meta = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } // a metà scrittura: al prossimo giro
    voce = { firma, meta };
    cache.set(file, voce);
  }
  return voce.meta;
}

// Tutte le schede con un titolo: { file, meta, scartato }. meta è condiviso: chi vuole modificarlo lo rilegge.
function schede(radice) {
  const out = [];
  const visita = (dir, scartato) => {
    let voci = [];
    try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const v of voci) {
      const file = path.join(dir, v.name);
      if (v.isDirectory()) visita(file, scartato || (dir === radice && v.name === '_scartati'));
      else if (v.name.endsWith('.json') && v.name !== 'feedback.json') {
        const meta = leggi(file);
        if (meta && meta.titolo) out.push({ file, meta, scartato });
      }
    }
  };
  visita(radice, false);
  return out;
}

// Il modello che ha scritto titolo e descrizione; null nei brani senza il dato
const modelloTesto = (meta) => (meta.modello_testo && meta.modello_testo.modello) || null;

module.exports = { schede, modelloTesto };
