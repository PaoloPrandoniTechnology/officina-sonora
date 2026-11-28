// Playlist e preferiti: un unico file in state\, brani identificati dal numero di traccia.
// I brani scartati o cancellati restano nell'elenco ma la dashboard non li mostra.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scriviAtomico } = require('./disco');

const FILE = process.env.OFS_PLAYLIST || path.join(__dirname, '..', 'state', 'playlist.json');
const MAX_PLAYLIST = 200;
const MAX_BRANI = 5000;

// Un file illeggibile non vale come vuoto: salvando si perderebbero le playlist
function leggi(file = FILE) {
  let testo;
  try { testo = fs.readFileSync(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return { preferiti: [], playlist: [] }; throw e; }
  let d;
  try { d = JSON.parse(testo); } catch (e) { d = null; }
  if (!d || !Array.isArray(d.preferiti) || !Array.isArray(d.playlist)) throw new Error(`il file delle playlist è illeggibile: ${file}`);
  return d;
}

function numeri(v) {
  if (!Array.isArray(v) || v.length > MAX_BRANI || !v.every((n) => Number.isInteger(n) && n >= 0 && n < 1e9)) throw new Error('elenco di brani non valido');
  return [...new Set(v)];
}
function nome(v) {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t || t.length > 80) throw new Error('il nome va da 1 a 80 caratteri');
  return t;
}
function descrizione(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.length > 300) throw new Error('descrizione: massimo 300 caratteri');
  return v.trim();
}
const entroLimite = (brani) => { if (brani.length > MAX_BRANI) throw new Error(`una playlist contiene al massimo ${MAX_BRANI} brani`); return brani; };

// Ritorna { dati, ... }: la pagina ridisegna da «dati», senza una seconda lettura
function gestisci(azione, richiesta, file = FILE) {
  const r = richiesta || {};
  const d = leggi(file);
  const ora = new Date().toISOString();
  const esito = {};
  const trova = () => {
    const p = d.playlist.find((x) => x.id === r.id);
    if (!p) throw new Error('playlist non trovata');
    return p;
  };
  if (azione === 'crea') {
    if (d.playlist.length >= MAX_PLAYLIST) throw new Error(`massimo ${MAX_PLAYLIST} playlist`);
    const p = { id: crypto.randomBytes(6).toString('hex'), nome: nome(r.nome), descrizione: descrizione(r.descrizione), brani: numeri(r.brani || []), creata: ora, modificata: ora };
    d.playlist.push(p);
    esito.id = p.id;
  } else if (azione === 'preferito') {
    const scelti = numeri(r.brani);
    d.preferiti = r.si ? entroLimite([...scelti.filter((n) => !d.preferiti.includes(n)), ...d.preferiti]) : d.preferiti.filter((n) => !scelti.includes(n));
  } else if (azione === 'elimina') {
    trova();
    d.playlist = d.playlist.filter((x) => x.id !== r.id);
  } else {
    const p = trova();
    if (azione === 'modifica') { p.nome = nome(r.nome); p.descrizione = descrizione(r.descrizione); }
    else if (azione === 'aggiungi') {
      const nuovi = numeri(r.brani).filter((n) => !p.brani.includes(n));
      p.brani = entroLimite(p.brani.concat(nuovi));
      esito.aggiunti = nuovi.length;
    } else if (azione === 'togli') { const via = numeri(r.brani); p.brani = p.brani.filter((n) => !via.includes(n)); }
    else if (azione === 'ordina') {
      // solo un riordino: un elenco vecchio (altra scheda aperta) non deve cancellare brani
      const nuovo = numeri(r.brani);
      if (nuovo.length !== p.brani.length || !nuovo.every((n) => p.brani.includes(n))) throw new Error('la playlist è cambiata: ricarica la pagina');
      p.brani = nuovo;
    } else throw new Error('azione sconosciuta');
    p.modificata = ora;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  scriviAtomico(file, JSON.stringify(d, null, 2));
  return { ok: true, ...esito, dati: d };
}

// Elenco M3U con i percorsi dei file, per VLC e altri lettori. brani: [{ titolo, durata_s, percorso }]
function m3u(brani) {
  return ['#EXTM3U', ...brani.flatMap((b) => [`#EXTINF:${Math.round(b.durata_s || -1)},${String(b.titolo).replace(/[\r\n]+/g, ' ')}`, b.percorso])].join('\r\n') + '\r\n';
}

module.exports = { leggi, gestisci, m3u };
