// Pagina Composizione: il materiale musicale del compositore (accordi, motivi, assoli, richiami, forme).
// I valori di serie stanno nel codice; il gateway scrive solo config\composizione.json con le tue modifiche.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Abc = require('../src/compositore/abc.js');
const Base = require('../src/compositore/compositore.js');
const Armonia = require('../src/compositore/armonia.js');
const Melodia = require('../src/compositore/melodia.js');
const Materiale = require('../src/compositore/materiale.js');
const Estro = require('../src/compositore/estro.js');
const { scriviAtomico } = require('./disco');

const BASE = path.join(__dirname, '..');
const MAX_NUOVE = 500;
const percorsi = (base) => ({
  file: process.env.OFS_COMPOSIZIONE || path.join(base, 'config', 'composizione.json'),
  catalogo: path.join(base, 'config', 'catalogo.json'),
  storico: process.env.OFS_STORICO || path.join(base, 'config', 'history', 'controllo.jsonl'),
});

// Un file illeggibile non vale come vuoto: salvando si perderebbe il lavoro
function utente(p) {
  let t;
  try { t = fs.readFileSync(p.file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return { modifiche: {}, nuove: [] }; throw e; }
  try { const d = JSON.parse(t); if (d && typeof d === 'object') return { modifiche: d.modifiche || {}, nuove: d.nuove || [] }; } catch (e) { /* sotto */ }
  throw new Error(`file illeggibile: ${p.file}`);
}
const catalogo = (p) => { try { return JSON.parse(fs.readFileSync(p.catalogo, 'utf8')).categories || []; } catch (e) { return []; } };
// generi che usano ogni stile (solo quelli del compositore estro)
function generiPerStile(p) {
  const out = {};
  for (const c of catalogo(p)) {
    if (c.vocale_senza_parole || !(c.estro ?? (c.ambito === 'musica' ? 2 : 0))) continue;
    (out[Estro.stileDi(c)] ||= []).push({ nome: c.name, etichetta: c.genere || c.name });
  }
  return out;
}

function lettura(base = BASE) {
  const p = percorsi(base);
  const generi = generiPerStile(p);
  return {
    stili: Object.entries(Materiale.STILI).map(([id, nome]) => ({ id, nome, andamento: Estro.FEEL[id], generi: generi[id] || [] })),
    andamenti: Materiale.ANDAMENTI, ruoli: Materiale.RUOLI, sezioni: Materiale.SEZIONI, gesti: Materiale.GESTI,
    voci: Materiale.unisci(utente(p)),
  };
}

function registra(p, chiave, prima, dopo) {
  try { fs.mkdirSync(path.dirname(p.storico), { recursive: true }); fs.appendFileSync(p.storico, JSON.stringify({ ts: new Date().toISOString(), sezione: 'composizione', chiave, prima, dopo }) + '\n'); }
  catch (e) { /* lo storico non blocca la modifica */ }
}
function scrivi(p, d) {
  fs.mkdirSync(path.dirname(p.file), { recursive: true });
  scriviAtomico(p.file, JSON.stringify(d, null, 2));
}

// ---- prova: uno score ABC che fa sentire la voce ----
const NOMI = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const sigla = (g, tonica) => NOMI[(tonica + g.semi) % 12] + g.tipo + (g.basso === null ? '' : `/${NOMI[(tonica + g.basso) % 12]}`);
const accordiDi = (periodo, tonica) => periodo.map((b) => b.map((g, i) => ({ pos: i * 16, sigla: sigla(g, tonica), pcs: Abc.noteAccordo(NOMI[(tonica + g.semi) % 12] + g.tipo).note })));
const scoreDi = (battute, tonalita, bpm) => Abc.scriviAbc({ bpm, metro: '4/4', tonalita, sezioni: [{ nome: 'verse', battute: battute.map((b) => ({ accordi: b.accordi.map(({ pos, sigla: s }) => ({ pos, sigla: s })), vocal: null, ins: b.ins })) }] });
const BPM = { dritto: 116, swing: 108, sincopato: 100, ampio: 80, danza: 112 };
const GIRO_PROVA = { dritto: 'i | bVI | bIII | bVII', swing: 'i7 | iv7 | iiø | V7', sincopato: 'i7 | IV7 | bVImaj7 | V7', ampio: 'i | bVI | iv | V', danza: 'i | bVII | bVI | V' };

function prova(campi, tipo) {
  const r = Base.casuale(7);
  if (tipo === 'armonia') {
    const minore = campi.modo === 'm';
    const accordi = accordiDi(Materiale.periodoDi(campi.testo, campi.ruolo === 'pre' ? 4 : 8), minore ? 9 : 0);
    const andamento = Estro.FEEL[campi.stile];
    // due passaggi: i soli accordi, poi con una melodia scritta sopra
    const m = Melodia.motivo(r, Melodia.MOTIVI[andamento][0]);
    const arrivi = Melodia.scheletro(r, { battute: accordi, centro: 69, basso: 55, alto: 84 });
    const righe = [];
    for (let i = 0; i < accordi.length; i += 2) righe.push(...Melodia.frase({ battute: accordi.slice(i, i + 2), m, arrivi: arrivi.slice(i * 2, i * 2 + 4), dopo: arrivi[i * 2 + 4], scala: minore ? Base.SCALE.minore : Base.SCALE.maggiore, tonica: minore ? 9 : 0, basso: 55, alto: 84 }));
    const battute = Melodia.salda([...accordi.map((a) => ({ accordi: a, ins: null })), ...accordi.map((a, i) => ({ accordi: a, ins: righe[i] }))]);
    return scoreDi(battute, minore ? 'Am' : 'C', BPM[andamento]);
  }
  if (tipo === 'motivo' || tipo === 'cadenza' || tipo === 'assolo') {
    const andamento = campi.andamento || 'dritto';
    const accordi = accordiDi(Materiale.periodoDi(`${GIRO_PROVA[andamento]} | ${GIRO_PROVA[andamento]}`, 8), 9);
    const testo = tipo === 'assolo' ? `${campi.ritmo} | ${campi.ritmo}` : campi.testo;
    const m = Melodia.motivo(r, testo);
    if (tipo === 'assolo') m.gesti = [...campi.gesti, ...campi.gesti];
    const arrivi = Melodia.scheletro(r, { battute: accordi, centro: 70, basso: 55, alto: 84 });
    const righe = [];
    for (let i = 0; i < accordi.length; i += 2) righe.push(...Melodia.frase({ battute: accordi.slice(i, i + 2), m, arrivi: arrivi.slice(i * 2, i * 2 + 4), dopo: arrivi[i * 2 + 4], scala: Base.SCALE.minore, tonica: 9, basso: 55, alto: 84 }));
    return scoreDi(Melodia.salda(accordi.map((a, i) => ({ accordi: a, ins: righe[i] }))), 'Am', BPM[andamento]);
  }
  if (tipo === 'richiamo') {
    const note = Materiale.noteDi(campi.note);
    const accordi = accordiDi(Materiale.periodoDi(campi.accordi, note.length), 0);
    return scoreDi(note.map((b, i) => ({ accordi: accordi[i], ins: b.map(([x, durata]) => ({ midi: x === null ? null : 60 + x, durata })) })), campi.modo === 'm' ? 'Cm' : 'C', 104);
  }
  throw new Error('niente da ascoltare per questo tipo');
}

// Un brano intero di un genere con la forma indicata (le forme si giudicano così)
function provaForma(p, campi, genere) {
  const adatti = campi.stili.flatMap((s) => generiPerStile(p)[s] || []);
  const scelto = adatti.find((g) => g.nome === genere) || adatti[0];
  if (!scelto) throw new Error('nessun genere usa questi stili');
  const cat = catalogo(p).find((c) => c.name === scelto.nome);
  const materiale = Materiale.pronto(utente(p));
  materiale.forme.prova = Materiale.formaDi(campi.testo);
  const r = Estro.componi({ cat, bpm: Math.round((cat.bpm[0] + cat.bpm[1]) / 2), tonalita: cat.tonalita[0], durata_s: 180, estro: cat.estro, seed: crypto.randomInt(1e9), materiale, formaForzata: 'prova', candidati: 8 });
  return { abc: r.abc, genere: scelto.etichetta };
}

function gestisci(azione, richiesta, base = BASE) {
  const p = percorsi(base);
  const r = richiesta || {};
  if (azione === 'prova') {
    const campi = Materiale.controlla(r);
    return { ok: true, ...(r.tipo === 'forma' ? provaForma(p, campi, r.genere) : { abc: prova(campi, r.tipo) }) };
  }
  const d = utente(p);
  const voce = Materiale.unisci(d).find((v) => v.id === r.id);
  if (azione === 'salva') {
    if (r.id && !voce) throw new Error('voce non trovata');
    const tipo = voce ? voce.tipo : r.tipo;
    const campi = Materiale.controlla({ ...r, tipo });
    let id = r.id;
    if (voce && voce.serie) {
      d.modifiche[id] = { ...campi, ...(voce.attivo ? {} : { attivo: false }) };
    } else if (voce) {
      Object.assign(d.nuove.find((v) => v.id === id), campi);
    } else {
      if (d.nuove.length >= MAX_NUOVE) throw new Error(`massimo ${MAX_NUOVE} voci tue: eliminane qualcuna`);
      id = `${tipo}:tua-${crypto.randomBytes(5).toString('hex')}`;
      d.nuove.push({ id, tipo, ...campi, attivo: true });
    }
    scrivi(p, d);
    registra(p, id, voce ? Materiale.controlla(voce.errore ? { ...campi, tipo } : voce) : null, campi);
    return { ok: true, id };
  }
  if (!voce) throw new Error('voce non trovata');
  if (azione === 'attiva') {
    const attivo = r.attivo === true;
    if (voce.serie) {
      const m = { ...(d.modifiche[voce.id] || {}) };
      if (attivo) delete m.attivo; else m.attivo = false;
      if (Object.keys(m).length) d.modifiche[voce.id] = m; else delete d.modifiche[voce.id];
    } else d.nuove.find((v) => v.id === voce.id).attivo = attivo;
  } else if (azione === 'ripristina') {
    if (!voce.serie) throw new Error('solo le voci di serie si ripristinano');
    delete d.modifiche[voce.id];
  } else if (azione === 'elimina') {
    if (voce.serie) throw new Error('le voci di serie non si eliminano: si spengono');
    d.nuove = d.nuove.filter((v) => v.id !== voce.id);
  } else throw new Error('azione sconosciuta');
  scrivi(p, d);
  registra(p, voce.id, voce.attivo ? 'attiva' : 'spenta', azione === 'attiva' ? (r.attivo ? 'attiva' : 'spenta') : azione);
  return { ok: true };
}

module.exports = { lettura, gestisci };
