// Segna sui brani già fatti il modello che ne ha scritto titolo e descrizione, ricavandolo dal log di produzione:
// "testo scritto da X" subito prima di "concept pronto" indica un servizio in rete; altrimenti era gemma.
// Uso: node tools/modelli-brani.js            (mostra cosa farebbe)
//      node tools/modelli-brani.js --applica  (copia le schede in state\backup e le aggiorna)
const fs = require('fs');
const path = require('path');
const libreria = require('../gateway/libreria');
const { scriviAtomico } = require('../gateway/disco');

const RADICE = path.join(__dirname, '..');
const LOCALE = 'google/gemma-4-e4b';

// titolo -> [{ quando, servizio }] dei concept scritti da un servizio in rete
function scrittori(log) {
  const out = new Map();
  let ultimo = null;
  for (const riga of log.split('\n')) {
    const quando = Date.parse(riga.slice(0, 24));
    const chi = /^\S+ testo scritto da (\S+)\s*$/.exec(riga);
    if (chi) { ultimo = { servizio: chi[1], quando }; continue; }
    const concept = /^\S+ concept pronto: "(.*)" \(/.exec(riga);
    if (!concept) continue;
    // le due righe sono scritte dallo stesso blocco, una dopo l'altra
    if (ultimo && quando - ultimo.quando < 2000) {
      if (!out.has(concept[1])) out.set(concept[1], []);
      out.get(concept[1]).push({ quando, servizio: ultimo.servizio });
    }
    ultimo = null;
  }
  return out;
}

// Il modello di un brano: l'ultimo concept con quel titolo nato nelle 12 ore prima del file
function modelloDi(meta, daRete, modelli) {
  const nato = Date.parse(meta.generato_il);
  const voce = (daRete.get(meta.titolo) || []).filter((x) => x.quando <= nato && nato - x.quando < 12 * 3600000).pop();
  const servizio = voce ? voce.servizio : 'locale';
  return { servizio, modello: servizio === 'locale' ? LOCALE : modelli[servizio] || servizio, ricostruito: true };
}

function principale(applica) {
  const log = fs.readFileSync(path.join(RADICE, 'state', 'tick.log'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(RADICE, 'config', 'servizi.json'), 'utf8'));
  const modelli = Object.fromEntries(config.testi.map((s) => [s.nome, s.modello]));
  const libreriaDir = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
  const copie = path.join(RADICE, 'state', 'backup', new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15), 'schede');
  const daRete = scrittori(log);
  const conto = {};
  for (const { file, meta } of libreria.schede(libreriaDir)) {
    if (meta.modello_testo || !meta.generato_il) continue;
    const m = modelloDi(meta, daRete, modelli);
    conto[m.modello] = (conto[m.modello] || 0) + 1;
    if (!applica) continue;
    const copia = path.join(copie, path.relative(libreriaDir, file));
    fs.mkdirSync(path.dirname(copia), { recursive: true });
    fs.copyFileSync(file, copia);
    // rilettura subito prima di scrivere: un voto può essere arrivato nel frattempo
    const attuale = JSON.parse(fs.readFileSync(file, 'utf8'));
    scriviAtomico(file, JSON.stringify({ ...attuale, modello_testo: m }, null, 2), '.modello.tmp');
  }
  console.log(applica ? `schede aggiornate (copie in ${copie}):` : 'a vuoto, schede da aggiornare:', conto);
}

if (require.main === module) principale(process.argv.includes('--applica'));
module.exports = { scrittori, modelloDi };
