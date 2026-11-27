// Andamento nel tempo: voto medio, scarti, costo di render ed errori, con le modifiche fatte dalla plancia.
// Sola lettura, dai file esistenti (schede dei brani, registro errori, storico del controllo, linee guida).
const fs = require('fs');
const path = require('path');

const LIBRERIA = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
const STATE = 'E:\\n8n\\officina-sonora\\state';
const CONFIG = path.join(__dirname, '..', 'config');
const ORA_MS = 3600000;
const GIORNO_MS = 86400000;
const MAX_PUNTI = { ora: 48, giorno: 60 };

const arrotonda = (x, cifre) => Math.round(x * 10 ** cifre) / 10 ** cifre;
const mediaDi = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// Giudizio sugli ultimi 7 giorni contro i 7 precedenti
function giudizio(prima, dopo, minimo, valore, soglia, piuEMeglio) {
  if (prima.length < minimo || dopo.length < minimo) return 'dati insufficienti';
  const diff = arrotonda(valore(dopo) - valore(prima), 6) * (piuEMeglio ? 1 : -1);
  return diff >= soglia ? 'migliora' : diff <= -soglia ? 'peggiora' : 'stabile';
}

function calcola({ brani, errori, modifiche, genere, passo, ora }) {
  const quando = (x, campo) => Date.parse(x[campo]);
  const tutti = brani.filter((b) => Number.isFinite(quando(b, 'generato_il')));
  const scelti = genere ? tutti.filter((b) => b.categoria === genere) : tutti;
  const primo = Math.min(...tutti.map((b) => quando(b, 'generato_il')));
  if (passo !== 'ora' && passo !== 'giorno') passo = tutti.length && ora - primo < 7 * GIORNO_MS ? 'ora' : 'giorno';

  // Intervalli in ora locale
  // per ora si sottrae il tempo trascorso nell'ora: setMinutes(0) sull'ora doppia di fine ora legale salta all'altra
  const inizio = (ms) => {
    const d = new Date(ms);
    if (passo === 'ora') return ms - (d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds());
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const seguente = (ms) => { if (passo === 'ora') return ms + ORA_MS; const d = new Date(ms); d.setDate(d.getDate() + 1); return d.getTime(); };
  const starts = [];
  if (tutti.length) {
    const max = MAX_PUNTI[passo];
    for (let t = inizio(Math.max(primo, ora - (max + 1) * (passo === 'ora' ? ORA_MS : GIORNO_MS))); t <= ora; t = seguente(t)) starts.push(t);
    starts.splice(0, starts.length - max);
  }
  const perPunto = new Map(starts.map((t) => [t, { brani: [], errori: 0 }]));
  for (const b of scelti) perPunto.get(inizio(quando(b, 'generato_il')))?.brani.push(b);
  for (const e of errori) { const p = perPunto.get(inizio(quando(e, 'ts'))); if (p) p.errori++; }

  const punti = starts.map((t) => {
    const { brani: lista, errori: nErrori } = perPunto.get(t);
    const accettati = lista.filter((b) => !b.scartato);
    const voti = accettati.map((b) => b.voto).filter((v) => Number.isInteger(v));
    const scartati = lista.length - accettati.length;
    // solo i brani con render_s (le schede piu' vecchie non lo hanno), altrimenti la resa risulta piu' bassa
    const conRender = lista.filter((b) => typeof b.render_s === 'number');
    const musica = conRender.filter((b) => !b.scartato).reduce((a, b) => a + (b.durata_s || 0), 0);
    const render = conRender.reduce((a, b) => a + b.render_s, 0);
    return {
      da: new Date(t).toISOString(),
      brani: lista.length,
      scartati,
      scartoPct: lista.length ? arrotonda((scartati / lista.length) * 100, 1) : null,
      voto: voti.length ? arrotonda(mediaDi(voti), 2) : null,
      votati: voti.length,
      resa: musica ? arrotonda(render / musica, 2) : null,
      errori: nErrori,
    };
  });

  const inPeriodo = (giorni) => scelti.filter((b) => { const t = quando(b, 'generato_il'); return t > ora - giorni * GIORNO_MS && t <= ora - (giorni - 7) * GIORNO_MS; });
  const [prima, dopo] = [inPeriodo(14), inPeriodo(7)];
  const votiDi = (lista) => lista.filter((b) => !b.scartato && Number.isInteger(b.voto)).map((b) => b.voto);
  const pctScarti = (lista) => (lista.filter((b) => b.scartato).length / lista.length) * 100;
  const esito = {
    voto: giudizio(votiDi(prima), votiDi(dopo), 10, mediaDi, 0.2, true),
    scarti: giudizio(prima, dopo, 30, pctScarti, 5, false),
  };

  const da = starts.length ? starts[0] : Infinity;
  const mod = modifiche
    .filter((m) => m.sezione !== 'voti' && m.sezione !== 'comandi' && quando(m, 'ts') >= da && quando(m, 'ts') <= ora)
    .map(({ ts, sezione, chiave }) => ({ ts, sezione, chiave }));
  return { passo, punti, esito, modifiche: mod };
}

const leggiJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const righe = (file) => { try { return fs.readFileSync(file, 'utf8').split('\n'); } catch (e) { return []; } };
const righeJson = (file) => righe(file).map((r) => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);

function schede(dir, scartato, out) {
  let voci = [];
  try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const v of voci) {
    const file = path.join(dir, v.name);
    if (v.isDirectory()) schede(file, scartato || (dir === LIBRERIA && v.name === '_scartati'), out);
    else if (v.name.endsWith('.json') && v.name !== 'feedback.json') {
      const m = leggiJson(file);
      if (!m || !m.titolo) continue;
      out.push({
        generato_il: m.generato_il || null,
        scartato,
        categoria: m.categoria || null,
        voto: Number.isInteger(m.voto) && m.voto >= 1 && m.voto <= 5 ? m.voto : null,
        durata_s: (m.qualita && m.qualita.durata_reale_s) || m.durata_s || null,
        render_s: typeof m.render_s === 'number' ? m.render_s : null,
      });
    }
  }
  return out;
}

// Versioni delle linee guida (attuale e archiviate): ogni data di aggiornamento e' una modifica,
// salvo se lo storico della plancia ha gia' una modifica delle linee guida entro 5 s (la stessa)
function aggiungiGuide(modifiche, guide) {
  for (const g of guide) {
    const t = Date.parse(g.aggiornato);
    if (!Number.isFinite(t)) continue;
    if (modifiche.some((m) => m.sezione === 'linee guida' && Math.abs(Date.parse(m.ts) - t) <= 5000)) continue;
    modifiche.push({ ts: g.aggiornato, sezione: 'linee guida', chiave: g.versione ? `versione ${g.versione}` : g.nome });
  }
  return modifiche;
}

function leggi({ genere, passo }) {
  const brani = schede(LIBRERIA, false, []);
  const errori = [...righeJson(path.join(STATE, 'errori.jsonl.1')), ...righeJson(path.join(STATE, 'errori.jsonl'))];
  const modifiche = righeJson(path.join(CONFIG, 'history', 'controllo.jsonl'));
  const guide = [];
  for (const dir of [CONFIG, path.join(CONFIG, 'history')]) {
    let nomi = [];
    try { nomi = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of nomi.filter((x) => /^guidance.*\.json$/.test(x))) guide.push({ nome: n, ...(leggiJson(path.join(dir, n)) || {}) });
  }
  aggiungiGuide(modifiche, guide);
  const generi = [...new Set(brani.map((b) => b.categoria).filter(Boolean))].sort();
  return { ...calcola({ brani, errori, modifiche, genere: genere || '', passo: passo || '', ora: Date.now() }), generi };
}

module.exports = { calcola, leggi, aggiungiGuide };
