// Score per la dashboard: archivio dei brani fatti, bozze dell'editor, score scelti per i brani da produrre,
// impostazioni di scrittura. Il gateway scrive solo state\score.json e config\score.json; i blocchi li leggono.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Abc = require('../src/compositore/abc.js');
const Compositore = require('../src/compositore/compositore.js');
const Estro = require('../src/compositore/estro.js');
const Materiale = require('../src/compositore/materiale.js');
const libreria = require('./libreria');
const { scriviAtomico } = require('./disco');

const BASE = path.join(__dirname, '..');
const LIBRERIA = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
const percorsi = (base) => ({
  archivio: process.env.OFS_SCORE || path.join(base, 'state', 'score.json'),
  conf: process.env.OFS_SCORE_CONF || path.join(base, 'config', 'score.json'),
  stato: path.join(base, 'state', 'state.json'),
  scartati: path.join(base, 'state', 'score-scartati'),
  catalogo: path.join(base, 'config', 'catalogo.json'),
  memoria: path.join(base, 'state', 'memoria-composizione.json'),
  composizione: process.env.OFS_COMPOSIZIONE || path.join(base, 'config', 'composizione.json'),
  storico: process.env.OFS_STORICO || path.join(base, 'config', 'history', 'controllo.jsonl'), // lo stesso Storico del Controllo
});
const MAX_BOZZE = 200;
const MAX_RICHIESTE = 20;
const MAX_ABC = 200000;

// Un file illeggibile non vale come vuoto: salvando si perderebbe il contenuto
function daFile(file, vuoto) {
  let testo;
  try { testo = fs.readFileSync(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return vuoto; throw e; }
  try { const d = JSON.parse(testo); if (d && typeof d === 'object' && !Array.isArray(d)) return d; } catch (e) { /* sotto */ }
  throw new Error(`file illeggibile: ${file}`);
}
const facoltativo = (file, vuoto) => { try { return daFile(file, vuoto); } catch (e) { return vuoto; } };
const scrivi = (file, dati) => { fs.mkdirSync(path.dirname(file), { recursive: true }); scriviAtomico(file, JSON.stringify(dati, null, 2)); };
const catalogo = (p) => facoltativo(p.catalogo, { categories: [] }).categories || [];

function categoria(p, nome) {
  const c = catalogo(p).find((x) => x.name === nome);
  if (!c) throw new Error('genere sconosciuto');
  return c;
}
function testoAbc(v) {
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_ABC) throw new Error('score mancante o troppo lungo');
  return v.replace(/\r\n/g, '\n');
}
const nomeBreve = (v) => String(v || '').trim().slice(0, 80) || 'Score senza nome';
const abcDi = (file) => file.replace(/json$/, 'abc');

// ---- archivio dei brani fatti ----
const misure = new Map(); // percorso -> { firma, dati }
function misura(file) {
  let st;
  try { st = fs.statSync(file); } catch (e) { return null; }
  const firma = `${st.mtimeMs}:${st.size}`;
  let v = misure.get(file);
  if (!v || v.firma !== firma) {
    const { score, errori, ...dati } = Abc.analizza(fs.readFileSync(file, 'utf8'));
    v = { firma, dati: score ? { valido: true, ...dati } : { valido: false, errore: errori[0] || '' } };
    misure.set(file, v);
  }
  return v.dati;
}

function brani(radice = LIBRERIA) {
  return libreria.schede(radice).flatMap(({ file, meta, scartato }) => {
    const m = misura(abcDi(file));
    if (!m) return [];
    return [{
      numero: Number.isInteger(meta.numero_traccia) ? meta.numero_traccia : null, titolo: meta.titolo, categoria: meta.categoria || null,
      generato_il: meta.generato_il || null, fonte: meta.score_fonte || null, riparato: !!meta.score_riparato, scartato,
      voto: Number.isInteger(meta.voto) ? meta.voto : null, punteggio: meta.score ? meta.score.punteggio : null,
      durata_audio: (meta.qualita && meta.qualita.durata_reale_s) || null, ...m, sezioni: m.sezioni ? m.sezioni.length : 0,
    }];
  }).sort((a, b) => String(b.generato_il || '').localeCompare(String(a.generato_il || '')));
}

function brano(numero, radice = LIBRERIA) {
  const s = libreria.schede(radice).find((x) => x.meta.numero_traccia === numero && fs.existsSync(abcDi(x.file)));
  if (!s) return null;
  return { numero, titolo: s.meta.titolo, categoria: s.meta.categoria || null, fonte: s.meta.score_fonte || null, abc: fs.readFileSync(abcDi(s.file), 'utf8') };
}

// ---- quadro per la pagina: impostazioni, bozze, brani in arrivo, score rifiutati ----
function scartati(p) {
  let nomi = [];
  try { nomi = fs.readdirSync(p.scartati).filter((n) => /^\d+\.json$/.test(n)).sort().reverse(); } catch (e) { return []; }
  return nomi.flatMap((n) => { const d = facoltativo(path.join(p.scartati, n), null); return d ? [{ id: n.slice(0, -5), ...d }] : []; });
}

function lettura(base = BASE) {
  const p = percorsi(base);
  const archivio = daFile(p.archivio, {});
  const conf = daFile(p.conf, {});
  const stato = facoltativo(p.stato, {});
  const usati = stato.scoreUsati || {};
  const concept = (c, dove) => ({ dove, titolo: c.titolo, categoria: c.categoria, durata_s: c.durata_s, bpm: c.bpm, tonalita: c.tonalita, sezioni: c.sezioni, abc: c.abc || null, manuale: !!c.scoreManuale, vocale: !!c.vocale });
  const inCorso = stato.job && stato.job.concept;
  return {
    definizioni: Abc.IMPOSTAZIONI,
    impostazioni: { generale: conf.generale || {}, generi: conf.generi || {} },
    generi: catalogo(p).map((c) => ({ nome: c.name, etichetta: c.genere || c.name, bpm: c.bpm, estro: c.estro, raccolta: c.raccolta, tonalita: c.tonalita || [], vocale: Boolean(c.voce) && c.voce !== 'strumentale', strutture: c.strutture || [] })),
    bozze: (archivio.bozze || []).slice().reverse(),
    richieste: (archivio.richieste || []).map((r) => ({ ...r, usata: usati[r.id] || null })).reverse(),
    inArrivo: [
      ...(inCorso ? [{ ...concept(stato.job.concept, stato.job.fase === 'piano' ? 'spartito' : 'render'), fonte: stato.job.fase === 'piano' ? 'modello' : stato.job.scoreFonte || (stato.job.abcNostro ? 'compositore' : 'motore') }] : []),
      ...(stato.queue || []).map((c) => concept(c, 'coda')),
    ],
    scartati: scartati(p).map(({ abc, ...d }) => d),
  };
}

const scartato = (id, base = BASE) => (/^\d+$/.test(id || '') ? facoltativo(path.join(percorsi(base).scartati, id + '.json'), null) : null);

// ---- scritture ----
function registra(p, chiave, prima, dopo) {
  try { fs.mkdirSync(path.dirname(p.storico), { recursive: true }); fs.appendFileSync(p.storico, JSON.stringify({ ts: new Date().toISOString(), sezione: 'score', chiave, prima, dopo }) + '\n'); }
  catch (e) { /* lo storico non blocca la modifica */ }
}

function impostazioni(p, { ambito, valori }) {
  if (ambito !== 'generale') categoria(p, ambito);
  if (!valori || typeof valori !== 'object') throw new Error('valori mancanti');
  const conf = daFile(p.conf, {});
  const prima = ambito === 'generale' ? conf.generale || {} : (conf.generi || {})[ambito] || {};
  const dopo = { ...prima };
  for (const [k, v] of Object.entries(valori)) {
    const def = Abc.IMPOSTAZIONI.find((d) => d.chiave === k);
    if (!def) throw new Error(`impostazione sconosciuta: ${k}`);
    // null: torna a ereditare (dal generale, o dal predefinito)
    if (v === null) delete dopo[k];
    else if (!Abc.valoreValido(def, v)) throw new Error(`${def.etichetta}: valore non ammesso`);
    else dopo[k] = v;
  }
  if (ambito === 'generale') conf.generale = dopo;
  else {
    conf.generi = conf.generi || {};
    if (Object.keys(dopo).length) conf.generi[ambito] = dopo; else delete conf.generi[ambito];
  }
  scrivi(p.conf, conf);
  registra(p, ambito, prima, dopo);
  return {};
}

// Un nuovo score del compositore, con il materiale del genere: non tocca la memoria della produzione
function componi(p, r) {
  const cat = categoria(p, r.categoria);
  const bpm = Number(r.bpm), durata = Number(r.durata_s);
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 220) throw new Error('velocità: da 30 a 220 bpm');
  if (!Number.isFinite(durata) || durata < Abc.SECONDI_MANUALE[0] || durata > Abc.SECONDI_MANUALE[1]) throw new Error(`durata: da ${Abc.SECONDI_MANUALE[0]} a ${Abc.SECONDI_MANUALE[1]} secondi`);
  const sezioni = Array.isArray(r.sezioni) && r.sezioni.length >= 1 && r.sezioni.length <= 16 && r.sezioni.every((s) => Abc.TAG.includes(s))
    ? r.sezioni : ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro'];
  const seed = Number.isInteger(r.seed) ? r.seed : crypto.randomInt(2147483647);
  const imp = Abc.risolvi(Abc.impostazioni(facoltativo(p.conf, {}), cat.name), cat);
  const g = (facoltativo(p.memoria, { generi: {} }).generi || {})[cat.name] || {};
  const richiesta = { cat, bpm, tonalita: String(r.tonalita || (cat.tonalita || [])[0] || ''), durata_s: durata, sezioni, seed, precedenti: (g.brani || []).map((b) => b.firma), candidati: imp.candidati, metri: imp.metri };
  const materiale = Materiale.pronto(facoltativo(p.composizione, {}));
  const c = imp.livello ? Estro.componi({ ...richiesta, estro: imp.livello, materiale })
    : Compositore.componi({ ...richiesta, identita: Compositore.identita(cat, g.identita, {}, seed) });
  return { abc: c.abc, punteggio: c.punteggio, seed };
}

function gestisci(azione, richiesta, base = BASE) {
  const p = percorsi(base);
  const r = richiesta || {};
  if (azione === 'impostazioni') return { ok: true, ...impostazioni(p, r) };
  if (azione === 'componi') return { ok: true, ...componi(p, r) };
  const archivio = daFile(p.archivio, {});
  archivio.bozze = archivio.bozze || [];
  archivio.richieste = archivio.richieste || [];
  const ora = new Date().toISOString();
  const usati = facoltativo(p.stato, {}).scoreUsati || {};
  const esito = {};
  if (azione === 'salva') {
    const abc = testoAbc(r.abc);
    if (r.categoria) categoria(p, r.categoria);
    let b = archivio.bozze.find((x) => x.id === r.id);
    if (!b) {
      if (archivio.bozze.length >= MAX_BOZZE) throw new Error(`massimo ${MAX_BOZZE} bozze: eliminane qualcuna`);
      archivio.bozze.push((b = { id: crypto.randomBytes(6).toString('hex'), creata: ora }));
    }
    Object.assign(b, { nome: nomeBreve(r.nome), categoria: r.categoria || null, abc, modificata: ora });
    esito.id = b.id;
  } else if (azione === 'elimina') {
    if (!archivio.bozze.some((x) => x.id === r.id)) throw new Error('bozza non trovata');
    archivio.bozze = archivio.bozze.filter((x) => x.id !== r.id);
  } else if (azione === 'produci') {
    const cat = categoria(p, r.categoria);
    const abc = testoAbc(r.abc);
    const a = Abc.analizza(abc);
    if (!a.score) throw new Error(`score non valido: ${a.errori.slice(0, 2).join('; ')}`);
    const [min, max] = Abc.SECONDI_MANUALE;
    if (a.secondi < min || a.secondi > max) throw new Error(`lo score dura ${a.secondi} secondi: ne servono da ${min} a ${max}`);
    // le richieste consumate non occupano posti
    archivio.richieste = archivio.richieste.filter((x) => !usati[x.id]).concat(archivio.richieste.filter((x) => usati[x.id]).slice(-10));
    if (archivio.richieste.filter((x) => !usati[x.id]).length >= MAX_RICHIESTE) throw new Error(`massimo ${MAX_RICHIESTE} score in attesa`);
    const titolo = typeof r.titolo === 'string' && r.titolo.trim() ? r.titolo.trim().slice(0, 200) : null;
    // per uno stesso brano vale solo l'ultima scelta
    if (titolo) archivio.richieste = archivio.richieste.filter((x) => usati[x.id] || x.titolo !== titolo || x.categoria !== cat.name);
    const id = crypto.randomBytes(6).toString('hex');
    archivio.richieste.push({ id, nome: nomeBreve(r.nome), categoria: cat.name, titolo, abc, secondi: a.secondi, bpm: a.bpm, tonalita: a.tonalita, creata: ora });
    registra(p, `da produrre: ${cat.name}`, null, nomeBreve(r.nome));
    esito.id = id;
  } else if (azione === 'annulla') {
    if (usati[r.id]) throw new Error('lo score è già stato usato');
    if (!archivio.richieste.some((x) => x.id === r.id)) throw new Error('richiesta non trovata');
    archivio.richieste = archivio.richieste.filter((x) => x.id !== r.id);
  } else throw new Error('azione sconosciuta');
  scrivi(p.archivio, archivio);
  return { ok: true, ...esito };
}

// abc.js per il browser: la pagina controlla gli score con lo stesso codice della produzione
const perBrowser = () => `window.ScoreAbc = (() => { const module = { exports: {} };\n${fs.readFileSync(path.join(BASE, 'src', 'compositore', 'abc.js'), 'utf8')}\nreturn module.exports; })();\n`;

module.exports = { brani, brano, lettura, scartato, gestisci, perBrowser };
