// Testi cantati (state\parole.json, fuori da Git): unico scrittore del file. La produzione li legge e segna
// quelli usati in state.testiUsati; le bozze le chiede qui (rotta /parole/bozza).
const fs = require('fs');
const path = require('path');
const { scriviAtomico } = require('./disco');
const M = require('./parole-modello');

const BASE = path.join(__dirname, '..');

function crea({ base = BASE, testi, adesso = () => new Date() } = {}) {
  const FILE = path.join(base, 'state', 'parole.json');
  const leggiJson = (file, f) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return f; } };
  const catalogo = () => leggiJson(path.join(base, 'config', 'catalogo.json'), { categories: [] });
  const archivio = () => {
    if (!fs.existsSync(FILE)) return [];
    // un file illeggibile non va sovrascritto con un elenco vuoto
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).testi || []; } catch (e) { throw new Error('archivio dei testi illeggibile (state\\parole.json)'); }
  };
  const scrivi = (lista) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); scriviAtomico(FILE, JSON.stringify({ testi: lista }, null, 2)); };
  const usati = () => leggiJson(path.join(base, 'state', 'state.json'), {}).testiUsati || {};

  const linguaDi = (cat, c) => (cat.lingue || []).find((l) => l.codice === c) || { codice: c || 'it', nome: c || 'Italiano', en: 'Italian' };
  function genere(nome) {
    const cat = catalogo();
    const g = (cat.categories || []).find((x) => x.name === nome);
    if (!g) throw new Error(`genere sconosciuto: ${nome}`);
    if (g.voce !== 'testo') throw new Error(`«${g.genere || nome}» non ha il testo cantato: cambia la voce nella pagina Generi`);
    return { cat, g, lingua: linguaDi(cat, g.lingua) };
  }
  const trova = (lista, id) => { const t = lista.find((x) => x.id === id); if (!t) throw new Error('testo non trovato'); return t; };
  const libero = (t) => { if (usati()[t.id]) throw new Error('testo già usato in un brano: usa «Duplica» per riprenderlo'); return t; };
  const nuovoId = (lista) => { let id; do { id = `p${adesso().getTime().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`; } while (lista.some((t) => t.id === id)); return id; };
  const corto = (v, n) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);

  function componi(vecchio, { titolo, genere: nome, tema, sezioni, stato, autore }) {
    const { g, lingua } = genere(nome);
    const s = M.pulisciSezioni(sezioni);
    if (s.length > 20) throw new Error('al massimo 20 sezioni');
    const nuovo = {
      ...vecchio, titolo: corto(titolo, 80), genere: nome, lingua: lingua.codice, tema: corto(tema, 300), sezioni: s,
      lyrics: M.lyricsDi(s), durata_s: M.durata(s, ((g.bpm || [90, 90])[0] + (g.bpm || [90, 90])[1]) / 2),
      stato: stato === 'approvato' ? 'approvato' : 'bozza', autore: autore || vecchio.autore || 'tu', modificato: adesso().toISOString(),
    };
    if (nuovo.stato === 'approvato') {
      const grave = M.controlli(s, { lingua: lingua.codice }).find((c) => c.grave && !c.ok);
      if (grave) throw new Error(`non approvabile: ${grave.testo.toLowerCase()}`);
    }
    return nuovo;
  }

  // ---- assistente ----
  async function chiedi(system, user, maxTokens) {
    if (!testi) throw new Error('servizi di testo non disponibili');
    return (await testi.chiedi({ system, user, maxTokens })).dati;
  }
  const SISTEMA = 'Sei un paroliere esperto. Scrivi parole originali, cantabili, concrete, senza citare canzoni, artisti o marchi. Rispondi solo con JSON valido.';
  const REGOLE = 'Versi brevi (7-11 sillabe), di lunghezza simile dentro la stessa sezione, accenti naturali, rime non forzate. Nei versi solo parole da cantare: niente indicazioni, parentesi o accordi.';

  async function proponiTesto(nome, tema) {
    const { cat, g, lingua } = genere(nome);
    const struttura = ((cat.strutture || {})[(g.strutture || [])[0]] || ['[verse]', '[chorus]', '[verse]', '[chorus]', '[bridge]', '[chorus]'])
      .map((t) => t.replace(/[[\]]/g, '')).filter((t) => t !== 'intro' && t !== 'outro');
    const recenti = archivio().filter((t) => t.genere === nome).slice(-8).map((t) => t.titolo).filter(Boolean);
    const j = await chiedi(SISTEMA, `Scrivi il testo di una canzone in lingua "${lingua.en}".
Genere: ${g.genere || nome}. Atmosfera: ${g.stile || ''}.
Tema: ${corto(tema || g.temi || 'libero', 300)}.
Sezioni, in quest'ordine: ${struttura.join(', ')}. Il ritornello (chorus) si ripete identico; da 4 a 6 versi per sezione.
${REGOLE}${recenti.length ? `\nTitoli già usati, da non ripetere: ${recenti.join(', ')}.` : ''}
JSON: {"titolo": "...", "sezioni": [{"tipo": "verse|pre-chorus|chorus|bridge", "righe": ["..."]}]}`, 2500);
    const s = M.pulisciSezioni(j.sezioni);
    const rit = s.find((x) => x.tipo === 'chorus');
    if (rit) for (const x of s) if (x.tipo === 'chorus') x.righe = [...rit.righe];
    if (s.reduce((a, x) => a + x.righe.length, 0) < 4) throw new Error('il testo proposto è troppo corto: riprova');
    return { titolo: corto(j.titolo, 80) || 'Senza titolo', sezioni: s, tema: corto(tema || g.temi, 300) };
  }

  async function bozza({ genere: nome, tema, approvata }) {
    const { g } = genere(nome);
    const p = await proponiTesto(nome, tema);
    const lista = archivio(); // riletto dopo l'attesa
    // si approva da sola solo se il genere e' impostato su «automatico»
    const nuovo = componi({ id: nuovoId(lista), creato: adesso().toISOString() }, { ...p, genere: nome, autore: 'ia', stato: approvata && g.testi === 'auto' ? 'approvato' : 'bozza' });
    scrivi([...lista, nuovo]);
    return nuovo;
  }

  // Aiuti su una parte del testo: restituiscono una proposta, non salvano nulla
  async function assisti({ azione, genere: nome, sezioni, indice, riga, richiesta }) {
    const { g, lingua } = genere(nome);
    const s = M.pulisciSezioni(sezioni);
    const sezione = s[indice];
    const contesto = `Canzone in lingua "${lingua.en}", genere ${g.genere || nome}.\nTesto:\n${M.lyricsDi(s).slice(0, 3000)}`;
    if (azione === 'sezione') {
      if (!sezione) throw new Error('scegli una sezione');
      const j = await chiedi(SISTEMA, `${contesto}\n\nRiscrivi la sezione numero ${Number(indice) + 1} ([${sezione.tipo}]).${richiesta ? ` Richiesta: ${corto(richiesta, 200)}.` : ''}\n${REGOLE}\nJSON: {"righe": ["..."]}`, 900);
      const righe = M.pulisciSezioni([{ tipo: sezione.tipo, righe: j.righe }])[0].righe;
      if (!righe.length) throw new Error('nessuna proposta: riprova');
      return { righe };
    }
    if (azione === 'verso' || azione === 'rime') {
      const verso = corto(riga, 120);
      if (!verso) throw new Error('scegli un verso');
      const domanda = azione === 'rime' ? `Dai 12 parole che rimano con l'ultima parola di questo verso: "${verso}".` : `Proponi 4 alternative a questo verso, con circa ${M.sillabe(verso, lingua.codice)} sillabe: "${verso}".${richiesta ? ` Richiesta: ${corto(richiesta, 200)}.` : ''}`;
      const j = await chiedi(SISTEMA, `${contesto}\n\n${domanda}\nJSON: {"proposte": ["..."]}`, 700);
      const proposte = (Array.isArray(j.proposte) ? j.proposte : []).map((x) => corto(x, 120)).filter(Boolean).slice(0, 12);
      if (!proposte.length) throw new Error('nessuna proposta: riprova');
      return { proposte };
    }
    throw new Error(`azione sconosciuta: ${azione}`);
  }

  function lettura() {
    const cat = catalogo();
    const u = usati();
    const lista = archivio();
    return {
      testi: lista.map((t) => ({ ...t, usato: u[t.id] || null })).reverse(),
      generi: (cat.categories || []).filter((g) => g.voce === 'testo').map((g) => ({
        nome: g.name, etichetta: g.genere || g.name, lingua: linguaDi(cat, g.lingua), modo: g.testi || 'approvazione', bpm: g.bpm || [90, 100], temi: g.temi || '',
        pronti: lista.filter((t) => t.genere === g.name && t.stato === 'approvato' && !u[t.id]).length,
      })),
    };
  }

  async function gestisci(azione, d) {
    if (azione === 'bozza') return { ok: true, testo: await bozza({ genere: d.genere, tema: d.tema }) };
    if (azione === 'proponi') return { ok: true, ...(await proponiTesto(d.genere, d.tema)) };
    if (azione === 'assisti') return { ok: true, ...(await assisti(d)) };
    const lista = archivio();
    if (azione === 'salva') {
      const i = d.id ? lista.indexOf(libero(trova(lista, d.id))) : -1;
      const vecchio = i < 0 ? { id: nuovoId(lista), creato: adesso().toISOString() } : lista[i];
      const nuovo = componi(vecchio, d);
      if (i < 0) lista.push(nuovo); else lista[i] = nuovo;
      scrivi(lista);
      return { ok: true, testo: nuovo };
    }
    const t = trova(lista, d.id);
    if (azione === 'duplica') {
      const copia = { ...t, id: nuovoId(lista), stato: 'bozza', creato: adesso().toISOString(), modificato: adesso().toISOString() };
      scrivi([...lista, copia]);
      return { ok: true, testo: copia };
    }
    if (azione === 'elimina') { scrivi(lista.filter((x) => x !== t)); return { ok: true }; }
    throw new Error(`azione sconosciuta: ${azione}`);
  }

  return { lettura, gestisci, bozza };
}

module.exports = { crea };
