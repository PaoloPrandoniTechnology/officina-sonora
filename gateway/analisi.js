// Analisi dei dati per la dashboard: libreria, generi, voti, qualita', render, errori.
// Sola lettura. I risultati sono in cache per 30 secondi, cosi' la scansione della libreria
// non pesa sull'aggiornamento della dashboard (che legge lo stato ogni 5 secondi).
const fs = require('fs');
const path = require('path');

const ROOT = 'E:\\Musica di sottofondo';
const STATE = 'E:\\n8n\\yoga\\state';
const CATALOGO = path.join(__dirname, '..', 'config', 'catalogo.json');
const GUIDA = path.join(__dirname, '..', 'config', 'guidance.json');
const TTL_MS = 30 * 1000;

let cache = { t: 0, dati: null };

function leggiJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// Ultimi byte di un file di log (per non leggere file grandi per intero)
function codaTesto(file, bytes = 400000) {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, bytes);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      return buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch (e) { return ''; }
}

// Tutti i file .json della libreria (anche _scartati)
function trovaJson(dir, out = []) {
  let nomi = [];
  try { nomi = fs.readdirSync(dir); } catch (e) { return out; }
  for (const n of nomi) {
    const p = path.join(dir, n);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) trovaJson(p, out);
    else if (n.endsWith('.json') && n !== 'feedback.json') out.push(p);
  }
  return out;
}

function media(valori) {
  const v = valori.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

function contaPer(lista, chiave) {
  const out = {};
  for (const x of lista) {
    const k = chiave(x);
    if (k === null || k === undefined || k === '') continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// Problemi del controllo qualita' normalizzati (numeri sostituiti da #)
function motivoNormalizzato(p) {
  return String(p).replace(/\d+(\.\d+)?/g, '#').slice(0, 90);
}

function calcola() {
  const catalogo = leggiJson(CATALOGO, { categories: [], tipi: [] });
  const guida = leggiJson(GUIDA, {});
  const tracce = [];
  const scartati = [];

  for (const f of trovaJson(ROOT)) {
    const meta = leggiJson(f, null);
    if (!meta || !meta.titolo) continue;
    const parti = path.relative(ROOT, f).split(path.sep);
    const fuori = parti[0] === '_scartati';
    const rec = {
      titolo: meta.titolo,
      ambito: fuori ? null : parti[0],
      famiglia: fuori ? null : parti[1],
      categoria: meta.categoria || null,
      tipo: typeof meta.tipo === 'string' ? meta.tipo : null,
      genere: meta.genere || null,
      variante: meta.variante || null,
      bpm: typeof meta.bpm === 'number' ? meta.bpm : null,
      energia: typeof meta.energia === 'number' ? meta.energia : null,
      struttura: meta.struttura || null,
      durata_s: typeof meta.durata_s === 'number' ? meta.durata_s : null,
      render_s: typeof meta.render_s === 'number' ? meta.render_s : null,
      generato_il: meta.generato_il || null,
      numero: typeof meta.numero_traccia === 'number' ? meta.numero_traccia : null,
      voto: typeof meta.voto === 'number' ? meta.voto : null,
      ascolti: (meta.ibroadcast && meta.ibroadcast.ascolti) || meta.ascolti || 0,
      caricato: !!(meta.ibroadcast && meta.ibroadcast.track_id),
      esito: (meta.qualita && meta.qualita.esito) || null,
      problemi: (meta.qualita && meta.qualita.problemi) || [],
    };
    (fuori ? scartati : tracce).push(rec);
  }

  // Generi: specifiche dal catalogo e statistiche dalla libreria
  const perCat = {};
  for (const t of tracce) {
    const c = t.categoria;
    if (!c) continue;
    (perCat[c] = perCat[c] || []).push(t);
  }
  const scartatiPerCat = contaPer(scartati, (t) => t.categoria);
  const generi = (catalogo.categories || []).map((c) => {
    const list = perCat[c.name] || [];
    const ultimo = list.map((t) => t.generato_il).filter(Boolean).sort().pop() || null;
    return {
      nome: c.name,
      genere: c.genere || c.name,
      ambito: c.ambito || null,
      famiglia: c.famiglia || null,
      energia: c.energia,
      bpm: c.bpm,
      attivita: c.attivita || '',
      strutture: c.strutture || [],
      stile: c.stile || '',
      strumenti: c.strumenti || [],
      vietati: c.vietati || [],
      influenze: (c.influenze || []).map((i) => i.genere || i),
      varianti: (c.varianti || []).map((v) => v.nome),
      tonalita: c.tonalita || [],
      vocale: !!c.vocale_senza_parole,
      colori: c.colori || [],
      brani: list.length,
      caricati: list.filter((t) => t.caricato).length,
      ascoltiTot: list.reduce((a, t) => a + (t.ascolti || 0), 0),
      votoMedio: media(list.map((t) => t.voto)),
      votati: list.filter((t) => t.voto !== null).length,
      scartati: scartatiPerCat[c.name] || 0,
      ultimo,
      durataMedia_s: media(list.map((t) => t.durata_s)),
    };
  });

  // Libreria
  const durataTot = tracce.reduce((a, t) => a + (t.durata_s || 0), 0);
  const giorni = {};
  for (const t of tracce) {
    if (t.generato_il) giorni[t.generato_il.slice(0, 10)] = (giorni[t.generato_il.slice(0, 10)] || 0) + 1;
  }
  const timeline = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    timeline.push({ giorno: d, brani: giorni[d] || 0 });
  }
  const bpmBins = {};
  for (const t of tracce) {
    if (t.bpm === null) continue;
    const b = Math.floor(t.bpm / 10) * 10;
    bpmBins[b] = (bpmBins[b] || 0) + 1;
  }

  // Voti
  const votati = tracce.filter((t) => t.voto !== null);
  const distribuzione = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const t of votati) if (distribuzione[t.voto] !== undefined) distribuzione[t.voto]++;
  const votiPerCat = Object.entries(perCat).map(([cat, list]) => ({
    categoria: cat,
    votati: list.filter((t) => t.voto !== null).length,
    media: media(list.map((t) => t.voto)),
  })).filter((x) => x.votati > 0).sort((a, b) => (b.media || 0) - (a.media || 0));
  const votoGiudizi = votati.map((t) => ({ titolo: t.titolo, categoria: t.categoria, voto: t.voto, ascolti: t.ascolti }));
  const votiIb = leggiJson(path.join(STATE, 'voti-ibroadcast.json'), {});

  // Qualita'
  const motivi = {};
  for (const s of scartati) for (const p of s.problemi) {
    const k = motivoNormalizzato(p);
    motivi[k] = (motivi[k] || 0) + 1;
  }
  const motiviTop = Object.entries(motivi).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([motivo, n]) => ({ motivo, n }));

  // Render e log di produzione
  const log = codaTesto(path.join(STATE, 'tick.log'));
  const righeLog = log.split('\n');
  const renders = [];
  for (const l of righeLog) {
    const m = /\(render (\d+)s, durata richiesta (\d+)s\)/.exec(l);
    if (m) renders.push({ render: Number(m[1]), richiesti: Number(m[2]) });
  }
  const ultimiRender = renders.slice(-40);
  const rigenerazioni = righeLog.filter((l) => /rigenero/.test(l)).length;
  const caricamenti24 = righeLog.filter((l) => /iBroadcast: caricato/.test(l) && Date.now() - Date.parse(l.slice(0, 24)) < 86400000).length;

  // Errori (ultime 24 ore, raggruppati)
  const erroriPerChiave = {};
  let errori24 = 0;
  const righeErrori = codaTesto(path.join(STATE, 'errori.jsonl'), 300000).split('\n').filter(Boolean);
  for (const r of righeErrori) {
    try {
      const e = JSON.parse(r);
      if (Date.now() - Date.parse(e.ts) > 86400000) continue;
      errori24++;
      const k = String(e.key).replace(/ a [^:]+:/, ' a <brano>:').slice(0, 110);
      erroriPerChiave[k] = (erroriPerChiave[k] || 0) + 1;
    } catch (e) { /* riga non valida: ignorata */ }
  }
  const erroriTop = Object.entries(erroriPerChiave).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([errore, n]) => ({ errore, n }));

  const recenti = [...tracce].sort((a, b) => (b.generato_il || '').localeCompare(a.generato_il || '')).slice(0, 25);

  return {
    aggiornato: new Date().toISOString(),
    libreria: {
      totale: tracce.length,
      durataTot_h: Math.round((durataTot / 3600) * 10) / 10,
      perAmbito: contaPer(tracce, (t) => t.ambito),
      perFamiglia: contaPer(tracce, (t) => t.famiglia),
      perTipo: contaPer(tracce, (t) => t.tipo),
      timeline,
      bpmIstogramma: Object.entries(bpmBins).map(([b, n]) => ({ da: Number(b), n })).sort((a, b) => a.da - b.da),
      recenti,
      caricati: tracce.filter((t) => t.caricato).length,
      ascoltiTot: tracce.reduce((a, t) => a + (t.ascolti || 0), 0),
    },
    generi,
    tipi: (catalogo.tipi || []).map((t) => (typeof t === 'string' ? { nome: t } : { nome: t.name, colori: t.palette || [] })),
    voti: {
      totale: votati.length,
      su: tracce.length,
      mediaGlobale: media(votati.map((t) => t.voto)),
      distribuzione,
      perCategoria: votiPerCat,
      migliori: votoGiudizi.filter((v) => v.voto >= 4).sort((a, b) => b.voto - a.voto || b.ascolti - a.ascolti).slice(0, 6),
      peggiori: votoGiudizi.filter((v) => v.voto <= 2).sort((a, b) => a.voto - b.voto).slice(0, 6),
      ultimoControllo: votiIb.lastRun ? new Date(votiIb.lastRun).toISOString() : null,
      ultimoEsito: votiIb.ultimoEsito || null,
    },
    qualita: {
      accettati: tracce.length,
      scartati: scartati.length,
      tassoScarto: tracce.length + scartati.length ? Math.round((scartati.length / (tracce.length + scartati.length)) * 1000) / 10 : 0,
      rigenerazioni: rigenerazioni,
      motivi: motiviTop,
      perCategoria: Object.entries(scartatiPerCat).map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    },
    render: {
      ultimi: ultimiRender,
      medio_s: media(ultimiRender.map((r) => r.render)),
      min_s: ultimiRender.length ? Math.min(...ultimiRender.map((r) => r.render)) : null,
      max_s: ultimiRender.length ? Math.max(...ultimiRender.map((r) => r.render)) : null,
      caricati24h: caricamenti24,
    },
    errori: { totale24h: errori24, top: erroriTop },
    guida: {
      versione: guida.versione || null,
      aggiornato: guida.aggiornato || null,
      bpmRange: guida.bpm_range || {},
      strutturePref: guida.struttura_pref || {},
      note: Array.isArray(guida.note) ? guida.note.slice(-4) : (guida.note ? [String(guida.note)] : []),
      styleExtra: guida.style_extra || [],
      styleAvoid: guida.style_avoid || [],
    },
  };
}

function datiAnalisi() {
  const adesso = Date.now();
  if (!cache.dati || adesso - cache.t > TTL_MS) {
    cache = { t: adesso, dati: calcola() };
  }
  return cache.dati;
}

module.exports = { datiAnalisi };
