// Pulizia una tantum dei voti: toglie quelli copiati tra brani omonimi, segna quelli arrivati da iBroadcast
// e mette da parte feedback.csv.
//   node tools/pulisci-voti.js             prova a vuoto, non scrive nulla
//   node tools/pulisci-voti.js --applica   copia in state/backup/voti-<data>/ e poi modifica (a produzione ferma)
const fs = require('fs');
const path = require('path');

const LIBRERIA = process.env.YMF_LIBRERIA || 'E:\\Musica di sottofondo';
const COPIE = process.env.YMF_BACKUP || path.join(__dirname, '..', 'state', 'backup');
const DA_IBROADCAST = /^(valutazione iBroadcast$|tag|playlist|cestino)/;

// Modifica meta; ritorna 'rimosso', 'ibroadcast' o null (niente da fare)
function pulisci(meta, oraIso) {
  if (meta.voto === null || meta.voto === undefined) return null;
  if (!meta.voto_fonte) {
    meta.voto = null;
    delete meta.nota_utente;
    delete meta.voto_ib; // altrimenti il blocco 10 non riapplicherebbe un segnale vero uguale al voto copiato
    return 'rimosso';
  }
  // voto_ib gia' presente: la scheda e' gia' a posto, la data del voto non va spostata
  if (meta.voto_ib !== undefined || !DA_IBROADCAST.test(meta.voto_fonte)) return null;
  meta.voto_ib = meta.voto;
  meta.voto_il = oraIso;
  if (meta.nota_utente === meta.voto_fonte) delete meta.nota_utente;
  return 'ibroadcast';
}

function schede(dir, out = []) {
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, v.name);
    if (v.name === '_scartati') continue;
    if (v.isDirectory()) schede(file, out);
    else if (v.name.endsWith('.json') && v.name !== 'feedback.json') out.push(file);
  }
  return out;
}

const leggi = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function main(applica) {
  const ora = new Date().toISOString();
  const daFare = [];
  const numeri = { rimosso: [], ibroadcast: [] };
  const saltate = [];
  for (const file of schede(LIBRERIA)) {
    try {
      const meta = leggi(file);
      const esito = meta && meta.titolo ? pulisci(meta, ora) : null;
      if (!esito) continue;
      daFare.push(file);
      numeri[esito].push(meta.numero_traccia ?? path.basename(file));
    } catch (e) {
      saltate.push(`${file}: ${e.message}`);
    }
  }
  const elenco = (l) => `${l.length}${l.length ? ` (${l.sort((a, b) => a - b).join(', ')})` : ''}`;
  console.log(`Libreria: ${LIBRERIA}`);
  console.log(`Voti copiati da rimuovere: ${elenco(numeri.rimosso)}`);
  console.log(`Voti di iBroadcast da segnare: ${elenco(numeri.ibroadcast)}`);
  for (const s of saltate) console.log(`Scheda illeggibile, saltata: ${s}`);

  const csv = path.join(LIBRERIA, 'feedback.csv');
  const conCsv = fs.existsSync(csv);
  console.log(`feedback.csv: ${conCsv ? 'presente, da rinominare in feedback.csv.vecchio' : 'assente'}`);
  if (!applica) return console.log('Prova a vuoto: nessun file modificato. Per applicare: --applica');
  if (!daFare.length && !conCsv) return console.log('Niente da fare.');

  // Tutte le copie prima della prima scrittura: se una fallisce lo script si ferma senza aver cambiato nulla
  const copia = path.join(COPIE, `voti-${ora.replace(/[:.]/g, '-')}`);
  try {
    fs.mkdirSync(copia, { recursive: true });
    for (const file of conCsv ? [...daFare, csv] : daFare) {
      const dest = path.join(copia, path.relative(LIBRERIA, file)); // stesso percorso relativo: ci sono omonimi
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest, fs.constants.COPYFILE_EXCL);
    }
  } catch (e) {
    process.exitCode = 1;
    return console.log(`Copia di sicurezza non riuscita: ${e.message} - nessuna modifica`);
  }
  console.log(`Copia di sicurezza: ${copia}`);

  let scritte = 0;
  let errori = 0;
  for (const file of daFare) {
    try {
      const meta = leggi(file); // rilettura: un voto arrivato nel frattempo resta
      if (!pulisci(meta, ora)) continue;
      const tmp = file + '.pulizia.tmp';
      fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
      fs.renameSync(tmp, file);
      scritte++;
    } catch (e) {
      errori++;
      console.log(`Scheda non aggiornata: ${file}: ${e.message}`);
    }
  }
  console.log(`Schede aggiornate: ${scritte}`);
  if (errori) {
    process.exitCode = 1;
    return console.log(`Errori: ${errori}. feedback.csv non rinominato: ripetere dopo aver risolto.`);
  }
  if (!conCsv) return;
  if (fs.existsSync(csv + '.vecchio')) return console.log('feedback.csv.vecchio esiste gia\': feedback.csv lasciato dov\'e\'.');
  fs.renameSync(csv, csv + '.vecchio');
  console.log('feedback.csv rinominato in feedback.csv.vecchio');
}

if (require.main === module) main(process.argv.includes('--applica'));

module.exports = { pulisci };
