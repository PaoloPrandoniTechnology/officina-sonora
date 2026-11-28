// Ascolto e voto dei brani. L'unica fonte dei voti e' il .json del brano, identificato da numero_traccia.
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { scriviAtomico } = require('./disco');
const libreria = require('./libreria');

const LIBRERIA = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
const ATTESA_MS = 15 * 60 * 1000; // i brani appena generati sono ancora in lavorazione nei blocchi
const TIPI_AUDIO = { mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg' };

// Schede con titolo e numero di traccia, esclusi i brani scartati
const schede = () => libreria.schede(LIBRERIA).filter((s) => !s.scartato && Number.isInteger(s.meta.numero_traccia));

const trova = (numero) => schede().find((s) => s.meta.numero_traccia === numero);
const votoValido = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

// Senza voto si salva solo la nota, su un brano gia' votato: voto, fonte e data restano quelli della scheda
function vota({ numero, voto, nota, fonte }) {
  const soloNota = voto === undefined || voto === null;
  const conNota = nota !== undefined && nota !== null;
  if (soloNota ? !conNota : !votoValido(voto)) throw new Error('voto: un numero intero da 1 a 5');
  if (conNota && (typeof nota !== 'string' || nota.length > 300 || /[<>]/.test(nota))) {
    throw new Error('nota: massimo 300 caratteri, senza < o >');
  }
  const s = Number.isInteger(numero) ? trova(numero) : null;
  if (!s) throw new Error(`brano non trovato: ${numero}`);
  // rilettura subito prima di scrivere: i blocchi possono aver aggiornato la scheda durante la ricerca
  const meta = JSON.parse(fs.readFileSync(s.file, 'utf8'));
  const prima = { voto: meta.voto ?? null, nota: meta.nota_utente ?? null };
  if (soloNota) {
    if (!votoValido(meta.voto)) throw new Error('nota: il brano non ha ancora un voto');
  } else {
    meta.voto = voto;
    meta.voto_fonte = fonte === 'telegram' ? 'telegram' : 'dashboard';
    meta.voto_il = new Date().toISOString();
  }
  if (conNota) meta.nota_utente = nota.trim();
  scriviAtomico(s.file, JSON.stringify(meta, null, 2), '.voto.tmp'); // suffisso diverso da quello dei blocchi (.tmp)
  return { ok: true, numero, titolo: meta.titolo, prima, dopo: { voto: meta.voto, nota: meta.nota_utente ?? null } };
}

function elenco(oraMs) {
  const brani = schede().map(({ meta }) => ({
    numero: meta.numero_traccia,
    titolo: meta.titolo,
    categoria: meta.categoria ?? null,
    durata_s: meta.durata_s ?? null,
    generato_il: meta.generato_il ?? null,
    voto: votoValido(meta.voto) ? meta.voto : null,
    nota: meta.nota_utente ?? null,
    voto_il: meta.voto_il ?? null,
  }));
  const votati = brani.filter((b) => b.voto !== null);
  const perGenere = {};
  for (const b of votati) perGenere[b.categoria] = (perGenere[b.categoria] || 0) + 1;
  const recente = (campo) => (a, b) => String(b[campo] || '').localeCompare(String(a[campo] || ''));
  const coda = brani
    .filter((b) => b.voto === null && oraMs - Date.parse(b.generato_il) >= ATTESA_MS)
    .sort((a, b) => (perGenere[a.categoria] || 0) - (perGenere[b.categoria] || 0) || recente('generato_il')(a, b));
  return { coda, votati: votati.sort(recente('voto_il')).slice(0, 20) };
}

// Intervallo richiesto da un'intestazione Range semplice: null = file intero (assente o non valida),
// false = fuori dal file. Gli intervalli multipli non sono gestiti: si invia il file intero.
function intervallo(range, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) { // "bytes=-n": gli ultimi n byte
    const n = Number(m[2]);
    return n && size ? { start: Math.max(0, size - n), end: size - 1 } : false;
  }
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : Infinity;
  if (end < start) return null;
  return start < size ? { start, end: Math.min(end, size - 1) } : false;
}

const audioDi = (s) => s && Object.keys(TIPI_AUDIO).map((e) => s.file.replace(/json$/, e)).find((f) => fs.existsSync(f));

// Tutto cio' che la pagina mostra di un brano
function scheda(numero) {
  const s = Number.isInteger(numero) ? trova(numero) : null;
  if (!s) return null;
  const m = s.meta;
  const ib = m.ibroadcast || {};
  const file = audioDi(s);
  return {
    numero, titolo: m.titolo, descrizione: m.descrizione || '', categoria: m.categoria || null, genere: m.genere || null,
    variante: m.variante || null, tipo: m.tipo || null, struttura: m.struttura || null, sezioni: m.sezioni || [],
    strumenti: [].concat(m.strumenti || []), influenza: m.influenza || null, bpm: m.bpm ?? null, tonalita: m.tonalita || null,
    energia: m.energia ?? null, attivita: m.attivita || '', durata_s: (m.qualita && m.qualita.durata_reale_s) || m.durata_s || null,
    richiesta_s: m.durata_s ?? null, render_s: m.render_s ?? null, generato_il: m.generato_il || null, stile: m.style || '',
    modello_testo: m.modello_testo || null, modello_musica: m.modello_musica || null,
    score_fonte: m.score_fonte || null, lora: (m.lora || []).map((l) => (typeof l === 'string' ? l : l.name)),
    qualita: m.qualita ? { esito: m.qualita.esito, problemi: m.qualita.problemi || [], bitrate: m.qualita.bitrate_medio_kbps ?? null, audio: m.qualita.audio || null } : null,
    voto: votoValido(m.voto) ? m.voto : null, nota: m.nota_utente ?? null, voto_fonte: m.voto_fonte || null,
    caricato: !!ib.track_id, ascolti: ib.ascolti ?? m.ascolti ?? 0,
    file: file ? path.relative(LIBRERIA, file) : null, score: fs.existsSync(s.file.replace(/json$/, 'abc')),
  };
}

// Il file si ricava solo dal numero di traccia: nessun percorso arriva dalla richiesta.
function inviaAudio(req, res, numero, scarica) {
  const s = Number.isInteger(numero) ? trova(numero) : null;
  const file = audioDi(s);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'brano non trovato' }));
  }
  const { size } = fs.statSync(file);
  const r = intervallo(req.headers.range, size);
  if (r === false) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    return res.end();
  }
  const testa = { 'Content-Type': TIPI_AUDIO[path.extname(file).slice(1)], 'Accept-Ranges': 'bytes', 'Content-Length': r ? r.end - r.start + 1 : size };
  if (scarica) testa['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`;
  if (r) testa['Content-Range'] = `bytes ${r.start}-${r.end}/${size}`;
  res.writeHead(r ? 206 : 200, testa);
  // pipeline chiude il file se il lettore interrompe; un errore di lettura chiude solo questa risposta
  pipeline(fs.createReadStream(file, r || {}), res, () => {});
}

// File audio dei brani chiesti, nello stesso ordine; quelli che non ci sono più si saltano
function percorsi(numeri) {
  const per = new Map(schede().map((s) => [s.meta.numero_traccia, s]));
  return numeri.flatMap((n) => {
    const s = per.get(n), file = audioDi(s);
    return file ? [{ titolo: s.meta.titolo, durata_s: s.meta.durata_s, percorso: file }] : [];
  });
}

module.exports = { vota, elenco, inviaAudio, scheda, trova, audioDi, percorsi };
