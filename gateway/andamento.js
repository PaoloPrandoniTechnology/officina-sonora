// Andamento nel tempo: indici del periodo, serie per ora o per giorno, dettaglio per genere, scarti, errori
// e modifiche fatte dalla plancia. Sola lettura, dai file esistenti (schede dei brani, registro errori,
// storico del controllo, linee guida).
const fs = require('fs');
const path = require('path');
const libreria = require('./libreria');
const testi = require('./testi').crea();

const LIBRERIA = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
const STATE = 'E:\\n8n\\officina-sonora\\state';
const CONFIG = path.join(__dirname, '..', 'config');
const ORA_MS = 3600000;
const GIORNO_MS = 86400000;
const MAX_PUNTI = { ora: 168, giorno: 366 };
const FILTRI = ['raccolta', 'famiglia', 'genere', 'tipo', 'struttura', 'modello'];

const arrotonda = (x, cifre) => Math.round(x * 10 ** cifre) / 10 ** cifre;
const mediaDi = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const somma = (lista, f) => lista.reduce((a, x) => a + (f(x) || 0), 0);
const quota = (n, su) => (su ? arrotonda((n / su) * 100, 1) : null);
// il campo del brano su cui agisce un filtro
const valoreDi = (b, f) => (f === 'genere' ? b.categoria : b[f]) || null;

// Giudizio sugli ultimi 7 giorni contro i 7 precedenti
function giudizio(prima, dopo, minimo, valore, soglia, piuEMeglio) {
  if (prima.length < minimo || dopo.length < minimo) return 'dati insufficienti';
  const diff = arrotonda(valore(dopo) - valore(prima), 6) * (piuEMeglio ? 1 : -1);
  return diff >= soglia ? 'migliora' : diff <= -soglia ? 'peggiora' : 'stabile';
}

// Indici di un gruppo di brani (un intervallo, un genere, il periodo intero)
function indici(lista) {
  const accettati = lista.filter((b) => !b.scartato);
  const voti = accettati.map((b) => b.voto).filter((v) => Number.isInteger(v));
  const scartati = lista.length - accettati.length;
  // solo i brani con render_s (le schede piu' vecchie non lo hanno), altrimenti la resa risulta piu' bassa
  const conRender = lista.filter((b) => typeof b.render_s === 'number');
  const musica = somma(conRender.filter((b) => !b.scartato), (b) => b.durata_s);
  const render = somma(conRender, (b) => b.render_s);
  const conTentativi = lista.filter((b) => typeof b.tentativi === 'number');
  const conDurata = accettati.filter((b) => b.durata_s && b.richiesta_s);
  const media = mediaDi(conDurata.map((b) => (b.durata_s / b.richiesta_s) * 100));
  return {
    brani: lista.length,
    accettati: accettati.length,
    scartati,
    scartoPct: quota(scartati, lista.length),
    ore: arrotonda(somma(accettati, (b) => b.durata_s) / 3600, 2),
    voto: voti.length ? arrotonda(mediaDi(voti), 2) : null,
    votati: voti.length,
    coperturaPct: quota(voti.length, accettati.length),
    resa: musica ? arrotonda(render / musica, 2) : null,
    renderMedio: conRender.length ? Math.round(render / conRender.length) : null,
    rigeneratiPct: quota(conTentativi.filter((b) => b.tentativi > 0).length, conTentativi.length),
    durataPct: media === null ? null : arrotonda(media, 1),
    caricatiPct: quota(accettati.filter((b) => b.caricato).length, accettati.length),
    ascolti: somma(accettati, (b) => b.ascolti),
  };
}

// Conteggio per testo, i piu' frequenti prima
function classifica(testi, quanti = 8) {
  const n = new Map();
  for (const t of testi) n.set(t, (n.get(t) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).slice(0, quanti).map(([nome, valore]) => ({ nome, valore }));
}

// periodo: numero di giorni, vuoto = tutto. passo: 'ora', 'giorno' o vuoto (automatico)
function calcola({ brani, errori, modifiche, passo, periodo, ora, ...filtri }) {
  const quando = (x, campo) => Date.parse(x[campo]);
  const tutti = brani.filter((b) => Number.isFinite(quando(b, 'generato_il')));
  const scelti = tutti.filter((b) => FILTRI.every((f) => !filtri[f] || valoreDi(b, f) === filtri[f]));
  const primo = Math.min(...tutti.map((b) => quando(b, 'generato_il')));
  const giorni = Number(periodo) > 0 ? Number(periodo) : null;
  const inizioPeriodo = giorni ? ora - giorni * GIORNO_MS : -Infinity;
  const nelPeriodo = (ms) => ms > inizioPeriodo && ms <= ora;
  const ampiezza = ora - Math.max(primo, inizioPeriodo); // quanta storia c'è davvero nel periodo
  if (passo !== 'ora' && passo !== 'giorno') passo = tutti.length && ampiezza < 7 * GIORNO_MS ? 'ora' : 'giorno';
  // oltre 7 giorni i punti per ora sarebbero illeggibili
  if (giorni > 7) passo = 'giorno';

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
  let troncato = false;
  if (tutti.length) {
    const max = MAX_PUNTI[passo];
    const dal = Math.max(primo, inizioPeriodo);
    const limite = ora - (max + 1) * (passo === 'ora' ? ORA_MS : GIORNO_MS);
    for (let t = inizio(Math.max(dal, limite)); t <= ora; t = seguente(t)) starts.push(t);
    troncato = limite > dal || starts.length > max;
    starts.splice(0, starts.length - max);
  }

  const periodoBrani = scelti.filter((b) => nelPeriodo(quando(b, 'generato_il')));
  const periodoErrori = errori.filter((e) => nelPeriodo(quando(e, 'ts')));
  const perPunto = new Map(starts.map((t) => [t, { brani: [], errori: 0 }]));
  for (const b of periodoBrani) perPunto.get(inizio(quando(b, 'generato_il')))?.brani.push(b);
  for (const e of periodoErrori) { const p = perPunto.get(inizio(quando(e, 'ts'))); if (p) p.errori++; }
  const punti = starts.map((t) => ({ da: new Date(t).toISOString(), ...indici(perPunto.get(t).brani), errori: perPunto.get(t).errori }));

  // Periodo scelto contro quello di pari durata che lo precede
  const riepilogo = { ...indici(periodoBrani), errori: periodoErrori.length };
  let precedente = null;
  if (giorni) {
    const nelPrima = (ms) => ms > inizioPeriodo - giorni * GIORNO_MS && ms <= inizioPeriodo;
    const lista = scelti.filter((b) => nelPrima(quando(b, 'generato_il')));
    const n = errori.filter((e) => nelPrima(quando(e, 'ts'))).length;
    if (lista.length || n) precedente = { ...indici(lista), errori: n };
  }

  const inSettimana = (da) => scelti.filter((b) => { const t = quando(b, 'generato_il'); return t > ora - da * GIORNO_MS && t <= ora - (da - 7) * GIORNO_MS; });
  const [prima, dopo] = [inSettimana(14), inSettimana(7)];
  const votiDi = (lista) => lista.filter((b) => !b.scartato && Number.isInteger(b.voto)).map((b) => b.voto);
  const pctScarti = (lista) => (lista.filter((b) => b.scartato).length / lista.length) * 100;
  const esito = {
    voto: giudizio(votiDi(prima), votiDi(dopo), 10, mediaDi, 0.2, true),
    scarti: giudizio(prima, dopo, 30, pctScarti, 5, false),
  };

  // il confronto fra modelli segue periodo e filtri, tranne quello per modello
  const perModello = new Map();
  for (const b of tutti.filter((x) => FILTRI.every((f) => f === 'modello' || !filtri[f] || valoreDi(x, f) === filtri[f]) && nelPeriodo(quando(x, 'generato_il')))) {
    if (!b.modello) continue;
    if (!perModello.has(b.modello)) perModello.set(b.modello, []);
    perModello.get(b.modello).push(b);
  }

  const perGenere = new Map();
  for (const b of periodoBrani) {
    if (!b.categoria) continue;
    if (!perGenere.has(b.categoria)) perGenere.set(b.categoria, []);
    perGenere.get(b.categoria).push(b);
  }
  const distribuzione = [1, 2, 3, 4, 5].map((v) => votiDi(periodoBrani).filter((x) => x === v).length);
  // numeri e nomi dei brani sostituiti, cosi' lo stesso problema conta una volta
  const motivi = classifica(periodoBrani.filter((b) => b.scartato).flatMap((b) => (b.problemi || []).map((p) => String(p).replace(/\d+(\.\d+)?/g, '#').slice(0, 90))));
  const erroriTop = classifica(periodoErrori.map((e) => String(e.key).replace(/ a [^:]+:/, ' a <brano>:').slice(0, 110)));

  const da = starts.length ? starts[0] : Infinity;
  const mod = modifiche
    .filter((m) => m.sezione !== 'voti' && m.sezione !== 'comandi' && quando(m, 'ts') >= Math.max(da, inizioPeriodo) && quando(m, 'ts') <= ora)
    .map(({ ts, sezione, chiave }) => ({ ts, sezione, chiave }))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return {
    passo, troncato, punti, riepilogo, precedente, esito, distribuzione, motivi, erroriTop,
    perGenere: [...perGenere].map(([genere, lista]) => ({ genere, ...indici(lista) })).sort((a, b) => b.brani - a.brani),
    perModello: [...perModello].map(([modello, lista]) => {
      const i = indici(lista), ms = mediaDi(lista.map((b) => b.testo_ms).filter((x) => typeof x === 'number'));
      return { modello, ...i, testoMs: ms === null ? null : Math.round(ms), ascoltiMedi: i.accettati ? arrotonda(i.ascolti / i.accettati, 2) : null };
    }).sort((a, b) => b.brani - a.brani),
    modifiche: mod,
  };
}

const leggiJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const righe = (file) => { try { return fs.readFileSync(file, 'utf8').split('\n'); } catch (e) { return []; } };
const righeJson = (file) => righe(file).map((r) => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
const numero = (x) => (typeof x === 'number' ? x : null);

function schede() {
  return libreria.schede(LIBRERIA).map(({ meta: m, scartato }) => {
    const ib = m.ibroadcast || {};
    return {
      generato_il: m.generato_il || null,
      scartato,
      categoria: m.categoria || null,
      modello: libreria.modelloTesto(m),
      testo_ms: numero(m.modello_testo && m.modello_testo.ms),
      tipo: typeof m.tipo === 'string' ? m.tipo : null,
      struttura: m.struttura || null,
      voto: Number.isInteger(m.voto) && m.voto >= 1 && m.voto <= 5 ? m.voto : null,
      durata_s: (m.qualita && m.qualita.durata_reale_s) || m.durata_s || null,
      richiesta_s: m.qualita && m.qualita.durata_reale_s ? numero(m.durata_s) : null,
      render_s: numero(m.render_s),
      tentativi: numero(m.tentativi_render),
      problemi: (m.qualita && m.qualita.problemi) || [],
      caricato: !!ib.track_id,
      ascolti: numero(ib.ascolti) ?? numero(m.ascolti),
    };
  });
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

// query: periodo, passo e i filtri (raccolta, famiglia, genere, tipo, struttura)
function leggi(query) {
  const catalogo = (leggiJson(path.join(CONFIG, 'catalogo.json')) || {}).categories || [];
  const perNome = new Map(catalogo.map((c) => [c.name, c]));
  const brani = schede().map((b) => {
    const c = perNome.get(b.categoria) || {};
    return { ...b, raccolta: c.raccolta || null, famiglia: c.famiglia || null };
  });
  const errori = [...righeJson(path.join(STATE, 'errori.jsonl.1')), ...righeJson(path.join(STATE, 'errori.jsonl'))];
  const modifiche = righeJson(path.join(CONFIG, 'history', 'controllo.jsonl'));
  const guide = [];
  for (const dir of [CONFIG, path.join(CONFIG, 'history')]) {
    let nomi = [];
    try { nomi = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of nomi.filter((x) => /^guidance.*\.json$/.test(x))) guide.push({ nome: n, ...(leggiJson(path.join(dir, n)) || {}) });
  }
  aggiungiGuide(modifiche, guide);
  // valori scelti nei menu: dipendono dai filtri precedenti (la raccolta restringe famiglie e generi)
  const opzioni = {};
  let restanti = brani;
  for (const f of FILTRI) {
    opzioni[f] = [...new Set(restanti.map((b) => valoreDi(b, f)).filter(Boolean))].sort();
    if (query[f] && (f === 'raccolta' || f === 'famiglia')) restanti = restanti.filter((b) => valoreDi(b, f) === query[f]);
  }
  const scelta = Object.fromEntries([...FILTRI, 'periodo', 'passo'].map((k) => [k, query[k] || '']));
  return { ...calcola({ ...scelta, brani, errori, modifiche, ora: Date.now() }), opzioni, servizi: testi.prestazioni() };
}

module.exports = { calcola, leggi, aggiungiGuide };
