// Editor dei generi: crea e modifica le schede di config\catalogo.json, raccolte e lingue comprese.
// Vale per qualsiasi genere: nessuno ha regole proprie nel codice. I campi non mostrati restano come sono.
const fs = require('fs');
const path = require('path');
const { scriviAtomico } = require('./disco');

const BASE = path.join(__dirname, '..');
const ADATTATORI = 'E:\\MusicAI\\YuE2 Studio\\data\\adapters';

const CARATTERI = { drone: 'Quiete e bordoni', cine: 'Cinematico', folk: 'Folk', rock: 'Rock', blues: 'Blues', jazz: 'Jazz', funk: 'Funk e groove', elettro: 'Elettronica', balcanico: 'Balcanico', flamenco: 'Flamenco' };
const VOCI = { strumentale: 'Strumentale', vocalizzi: 'Vocalizzi senza parole', testo: 'Testo cantato' };
const TIMBRI = { femminile: 'Voce femminile', maschile: 'Voce maschile', duetto: 'Duetto', coro: 'Voce e coro' };
const MODI_TESTI = { auto: 'Automatico', approvazione: 'Automatico con approvazione', miei: 'Solo parole mie' };
const RUOLI = ['fisso', 'scelta', 'riserva'];
const TONALITA = ['Do', 'Re bemolle', 'Re', 'Mi bemolle', 'Mi', 'Fa', 'Fa diesis', 'Sol', 'La bemolle', 'La', 'Si bemolle', 'Si'].flatMap((n) => [`${n} maggiore`, `${n} minore`]);

const testo = (v, n, nome, obbligatorio = false) => {
  const t = String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (obbligatorio && !t) throw new Error(`${nome}: campo obbligatorio`);
  if (t.length > n) throw new Error(`${nome}: al massimo ${n} caratteri`);
  return t;
};
const elenco = (v, max, n, nome) => {
  const out = [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map((x) => testo(x, n, nome)).filter(Boolean))];
  if (out.length > max) throw new Error(`${nome}: al massimo ${max} voci`);
  return out;
};
const scelta = (v, ammessi, nome) => { if (!ammessi.includes(v)) throw new Error(`${nome}: scelta non valida`); return v; };
const intero = (v, min, max, nome) => { const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${nome}: un numero tra ${min} e ${max}`); return n; };
// nomi che diventano cartelle e playlist
const cartella = (v, nome) => { const t = testo(v, 40, nome, true); if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(t) || /[ .]$/.test(t) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) throw new Error(`${nome}: solo lettere, numeri, spazi e trattini`); return t; };
const idDi = (nome) => String(nome || '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

function crea({ base = BASE, adattatori = ADATTATORI, testi, brani = () => ({}), adesso = () => new Date() } = {}) {
  const FILE = path.join(base, 'config', 'catalogo.json');
  const PARAMETRI = path.join(base, 'config', 'parametri.json');
  const STORICO = path.join(base, 'config', 'history', 'controllo.jsonl');
  const leggiJson = (file, f) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return f; } };
  const catalogo = () => {
    const c = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(c.categories)) throw new Error('catalogo non leggibile');
    return c;
  };
  function scrivi(cat, chiave, prima, dopo) {
    // copia del catalogo prima di ogni modifica: l'ultima resta recuperabile
    const copia = path.join(base, 'state', 'catalogo-precedente.json');
    fs.mkdirSync(path.dirname(copia), { recursive: true });
    fs.copyFileSync(FILE, copia);
    scriviAtomico(FILE, JSON.stringify(cat, null, 2));
    try { fs.mkdirSync(path.dirname(STORICO), { recursive: true }); fs.appendFileSync(STORICO, JSON.stringify({ ts: adesso().toISOString(), sezione: 'schede genere', chiave, prima, dopo }) + '\n'); }
    catch (e) { /* lo storico non blocca la modifica */ }
  }
  function loraInstallate() {
    let cartelle = [];
    try { cartelle = fs.readdirSync(adattatori); } catch (e) { return []; }
    return cartelle.map((id) => {
      const a = leggiJson(path.join(adattatori, id, 'adapter.json'), null);
      return a && { nome: id, etichetta: (a.name || {}).en || id, descrizione: (a.description || {}).en || '', innesco: a.trigger || '' };
    }).filter(Boolean);
  }

  function lettura() {
    const cat = catalogo();
    const sospesi = leggiJson(PARAMETRI, {}).generi || {};
    const conta = brani();
    return {
      generi: cat.categories.map((c) => ({ ...c, attivo: (sospesi[c.name] || {}).attivo !== false, brani: conta[c.name] || 0 })),
      raccolte: cat.raccolte || [], lingue: cat.lingue || [], strutture: cat.strutture || {},
      famiglie: [...new Set(cat.categories.map((c) => c.famiglia).filter(Boolean))].sort(),
      caratteri: CARATTERI, voci: VOCI, timbri: TIMBRI, modiTesti: MODI_TESTI, tonalita: TONALITA, lora: loraInstallate(),
    };
  }

  // Controlla i campi del modulo e li traduce nella scheda del catalogo
  function scheda(cat, vecchia, d) {
    const nome = 'genere';
    const bpm = [intero((d.bpm || [])[0], 30, 220, 'velocità minima'), intero((d.bpm || [])[1], 30, 220, 'velocità massima')];
    if (bpm[0] > bpm[1]) throw new Error('velocità: il minimo supera il massimo');
    const voce = scelta(d.voce, Object.keys(VOCI), 'voce');
    const righe = (Array.isArray(d.strumenti) ? d.strumenti : []).map((s) => ({ it: testo(s.it, 50, 'strumento'), en: testo(s.en, 80, 'strumento in inglese'), ruolo: scelta(s.ruolo || 'scelta', RUOLI, 'ruolo dello strumento') })).filter((s) => s.it);
    if (!righe.length || righe.length > 16) throw new Error('strumenti: da uno a sedici');
    if (new Set(righe.map((r) => r.it)).size !== righe.length) throw new Error('strumenti: nomi ripetuti');
    if (righe.some((r) => !r.en)) throw new Error('strumenti: serve anche la descrizione in inglese (è quella che va al motore)');
    const organico = { fissi: righe.filter((r) => r.ruolo === 'fisso').map((r) => r.it), scelta: righe.filter((r) => r.ruolo === 'scelta').map((r) => r.it) };
    if (!organico.fissi.length) throw new Error('strumenti: almeno uno «sempre presente»');
    const strutture = elenco(d.strutture, 10, 30, 'strutture');
    if (!strutture.length || strutture.some((s) => !(cat.strutture || {})[s])) throw new Error('strutture: scegline almeno una dall’elenco');
    const tonalita = elenco(d.tonalita, 24, 30, 'tonalità').map((t) => scelta(t, TONALITA, 'tonalità'));
    if (!tonalita.length) throw new Error('tonalità: scegline almeno una');
    const en = d.en || {};
    const influenze = (Array.isArray(d.influenze) ? d.influenze : []).map((i) => ({ genere: testo(i.genere, 60, 'influenza'), peso: intero(i.peso || 1, 1, 5, 'peso dell’influenza'), en: testo(i.en || i.genere, 60, 'influenza') })).filter((i) => i.genere).slice(0, 8);
    const stile = testo(d.stile, 300, 'descrizione dello stile') || testo(en.genre, 120, 'genere in inglese', true);
    const durata = testo(d.durata, 9, 'durata');
    if (durata) { const m = /^(\d+)-(\d+)$/.exec(durata); if (!m || Number(m[1]) < 60 || Number(m[2]) > 360 || Number(m[1]) > Number(m[2])) throw new Error('durata: due valori in secondi tra 60 e 360'); }
    const lora = d.lora ? loraInstallate().find((l) => l.nome === d.lora) : null;
    if (d.lora && !lora) throw new Error('LoRA non installata');
    const vecchiaLora = ((vecchia.lora || [])[0] || {}).name === d.lora ? vecchia.lora : null;
    const colori = (Array.isArray(d.colori) ? d.colori : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3);
    const c = {
      ...vecchia,
      genere: testo(d.genere, 60, nome, true),
      raccolta: scelta(d.raccolta, (cat.raccolte || []).map((r) => r.nome), 'raccolta'),
      famiglia: cartella(d.famiglia, 'famiglia'),
      attivita: testo(d.attivita, 160, 'a cosa serve') || testo(d.genere, 60, nome),
      energia: intero(d.energia, 1, 5, 'energia'),
      estro: intero(d.estro, 0, 2, 'estro'),
      carattere: scelta(d.carattere, Object.keys(CARATTERI), 'carattere'),
      voce, bpm, strutture, tonalita, stile,
      strumenti: righe.map((r) => r.it),
      organico,
      vietati: elenco(d.vietati, 20, 60, 'da evitare'),
      influenze: influenze.map(({ genere: g, peso }) => ({ genere: g, peso })),
      varianti: (vecchia.varianti || []).length ? vecchia.varianti : [{ nome: 'base', keywords: stile }],
      en: {
        ...(vecchia.en || {}),
        genre: testo(en.genre, 120, 'genere in inglese', true),
        instruments: Object.fromEntries(righe.map((r) => [r.it, r.en])),
        rhythm: testo(en.rhythm, 160, 'ritmo in inglese'),
        mood: testo(en.mood, 160, 'atmosfera in inglese'),
        space: testo(en.space, 160, 'suono in inglese'),
        influences: Object.fromEntries(influenze.map((i) => [i.genere, i.en])),
      },
    };
    if (durata) c.durata = durata; else delete c.durata;
    if (lora) c.lora = vecchiaLora || [{ name: lora.nome, scale: 1, ar_scale: voce === 'testo' ? 1 : 0.35, nar_scale: 0, ...(lora.innesco ? { innesco: lora.innesco } : {}) }];
    else delete c.lora;
    if (voce === 'testo') {
      c.lingua = scelta(d.lingua, (cat.lingue || []).map((l) => l.codice), 'lingua');
      c.timbro = scelta(d.timbro, Object.keys(TIMBRI), 'voce solista');
      c.testi = scelta(d.testi, Object.keys(MODI_TESTI), 'chi scrive le parole');
      c.temi = testo(d.temi, 300, 'temi');
    }
    const etichetta = testo((d.copertina || {}).etichetta, 30, 'nome in copertina') || c.genere;
    c.copertina = { font: 'Georgia', corsivo: false, ...(vecchia.copertina || {}), etichetta, prompt: testo((d.copertina || {}).prompt, 400, 'immagine di copertina') || `abstract artwork inspired by ${c.en.genre}, no text` };
    c.colori = colori.length === 3 ? colori : vecchia.colori || ['#22303c', '#5b8a9a', '#eef3f4'];
    return c;
  }

  // Proposta dell'IA a partire da una descrizione: non salva nulla, il modulo la mostra da rivedere
  async function proponi({ descrizione, voce }) {
    if (!testi) throw new Error('servizi di testo non disponibili');
    const d = testo(descrizione, 400, 'descrizione', true);
    const cat = catalogo();
    const { dati: j } = await testi.chiedi({
      system: 'Sei un produttore musicale. Prepari la scheda di un genere per un generatore di musica. Rispondi solo con JSON valido.',
      maxTokens: 1800,
      user: `Genere richiesto: "${d}". Voce: ${VOCI[voce] || VOCI.strumentale}.
JSON con: "genere" (nome in italiano), "famiglia" (una parola; esistenti: ${[...new Set(cat.categories.map((c) => c.famiglia))].join(', ')}), "attivita" (a cosa serve, italiano),
"energia" (1-5), "estro" (0 ripetizione voluta, 1 qualche variazione, 2 molte sorprese), "carattere" (uno tra ${Object.keys(CARATTERI).join(', ')}), "bpm" ([min, max]),
"strutture" (1-3 tra ${Object.keys(cat.strutture || {}).join(', ')}), "tonalita" (2-4 come "La minore", "Do maggiore"),
"strumenti" (5-7 oggetti {"it": nome italiano, "en": descrizione inglese del suono, "ruolo": "fisso" per i 3-4 portanti, altrimenti "scelta"}),
"en" ({"genre", "rhythm", "mood", "space"} in inglese, brevi descrittori separati da virgole), "stile" (descrizione inglese di una riga), "vietati" (elenco in italiano), "copertina" ({"etichetta", "prompt" in inglese, senza testo nell'immagine})`,
    });
    return j;
  }

  async function gestisci(azione, d) {
    if (azione === 'proponi') return { ok: true, proposta: await proponi(d) };
    const cat = catalogo();
    if (azione === 'salva') {
      const nuovo = !d.name;
      const nome = nuovo ? cartella(idDi(d.genere), 'nome del genere') : d.name;
      const i = cat.categories.findIndex((c) => c.name.toLowerCase() === nome.toLowerCase());
      if (nuovo && i >= 0) throw new Error(`esiste già un genere «${nome}»`);
      if (!nuovo && (i < 0 || cat.categories[i].name !== nome)) throw new Error(`genere sconosciuto: ${nome}`);
      const base0 = nuovo ? { name: nome, enfasi: '', melodia: '', accordi: '', ritmica: '' } : cat.categories[i];
      const c = scheda(cat, base0, d);
      const prima = nuovo ? null : cat.categories[i];
      if (nuovo) {
        // un genere nuovo nasce sospeso: lo si accende dopo averlo controllato
        const p = fs.existsSync(PARAMETRI) ? JSON.parse(fs.readFileSync(PARAMETRI, 'utf8')) : {};
        p.generi = { ...(p.generi || {}), [nome]: { peso: 1, attivo: false, note: [] } };
        scriviAtomico(PARAMETRI, JSON.stringify(p, null, 2));
        cat.categories.push(c);
      } else cat.categories[i] = c;
      scrivi(cat, nome, prima, c);
      return { ok: true, nome, nuovo };
    }
    if (azione === 'elimina') {
      const c = cat.categories.find((x) => x.name === d.name);
      if (!c) throw new Error('genere sconosciuto');
      if (brani()[c.name]) throw new Error('il genere ha brani in libreria: puoi sospenderlo, non eliminarlo');
      if (cat.categories.length < 2) throw new Error('deve restare almeno un genere');
      cat.categories = cat.categories.filter((x) => x !== c);
      scrivi(cat, c.name, c, null);
      return { ok: true };
    }
    if (azione === 'raccolta') {
      const nome = cartella(d.nome, 'raccolta');
      const playlist = cartella(d.playlist || nome, 'nome delle playlist');
      if ((cat.raccolte || []).some((r) => r.nome.toLowerCase() === nome.toLowerCase())) throw new Error('raccolta già presente');
      if (nome.startsWith('_')) throw new Error('nome riservato');
      cat.raccolte = [...(cat.raccolte || []), { nome, playlist }];
      scrivi(cat, `raccolta ${nome}`, null, { nome, playlist });
      return { ok: true };
    }
    if (azione === 'lingua') {
      const l = { codice: testo(d.codice, 3, 'sigla', true).toLowerCase(), nome: testo(d.nome, 30, 'nome', true), en: testo(d.en, 30, 'nome in inglese', true), id3: testo(d.id3 || d.codice, 3, 'sigla a tre lettere').toLowerCase() };
      if (!/^[a-z]{2,3}$/.test(l.codice) || !/^[A-Za-z ]+$/.test(l.en)) throw new Error('lingua: sigla di 2-3 lettere e nome inglese senza segni');
      if ((cat.lingue || []).some((x) => x.codice === l.codice)) throw new Error('lingua già presente');
      cat.lingue = [...(cat.lingue || []), l];
      scrivi(cat, `lingua ${l.codice}`, null, l);
      return { ok: true };
    }
    throw new Error(`azione sconosciuta: ${azione}`);
  }

  return { lettura, gestisci };
}

module.exports = { crea, idDi, VOCI, TIMBRI };
