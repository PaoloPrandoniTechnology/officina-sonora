// Plancia di controllo: lettura e scrittura dei parametri della produzione.
// Ogni modifica e' validata entro limiti precisi, scritta in modo atomico e registrata nello storico.
// Le scritture sono accettate solo con l'intestazione X-Controllo: 1 (il browser non la invia da altri siti).
const fs = require('fs');
const path = require('path');
const { datiAnalisi } = require('./analisi');

const DIR = path.join(__dirname, '..');
const PARAMETRI = path.join(DIR, 'config', 'parametri.json');
const COMANDI = path.join(DIR, 'state', 'comandi.json');
const GUIDA = path.join(DIR, 'config', 'guidance.json');
const CATALOGO = path.join(DIR, 'config', 'catalogo.json');
const STORICO = path.join(DIR, 'config', 'history', 'controllo.jsonl');
const HISTORY = path.join(DIR, 'config', 'history');

// Catalogo dei parametri: etichetta, gruppo, valore di default, limiti e spiegazione
const PARAMETRI_DEF = [
  { chiave: 'durDefault', gruppo: 'Durata', etichetta: 'Durata di riferimento', unita: 's', def: 180, min: 60, max: 600, passo: 5, descrizione: 'Durata usata quando un brano non ne dichiara una.' },
  { chiave: 'durMin', gruppo: 'Durata', etichetta: 'Durata minima', unita: 's', def: 120, min: 60, max: 240, passo: 5, descrizione: 'Nessun brano verra\' richiesto piu\' corto di questo.' },
  { chiave: 'durMax', gruppo: 'Durata', etichetta: 'Durata massima', unita: 's', def: 270, min: 120, max: 600, passo: 5, descrizione: 'Nessun brano verra\' richiesto piu\' lungo di questo.' },
  { chiave: 'maxAttempts', gruppo: 'Render', etichetta: 'Tentativi per render', unita: '', def: 3, min: 1, max: 10, passo: 1, descrizione: 'Quante volte si riprova un render fallito prima di rinunciare.' },
  { chiave: 'reviewEvery', gruppo: 'Apprendimento', etichetta: 'Revisione linee guida ogni', unita: 'brani', def: 5, min: 1, max: 50, passo: 1, descrizione: 'Ogni quanti brani il sistema rivede le linee guida.' },
  { chiave: 'pesoVoto', gruppo: 'Apprendimento', etichetta: 'Peso dei tuoi voti', unita: '', def: 100, min: 0, max: 1000, passo: 10, descrizione: 'Quanto pesa un tuo voto rispetto ai dati automatici (che valgono 1).' },
  { chiave: 'minVotiAffidabili', gruppo: 'Apprendimento', etichetta: 'Voti per fidarsi di una ricetta', unita: 'voti', def: 3, min: 1, max: 20, passo: 1, descrizione: 'Quanti voti servono perche\' una ricetta sia considerata affidabile.' },
  { chiave: 'maxEsperimenti', gruppo: 'Apprendimento', etichetta: 'Esperimenti in parallelo', unita: '', def: 2, min: 0, max: 10, passo: 1, descrizione: 'Quante ricette nuove si provano contemporaneamente.' },
  { chiave: 'esplorazione', gruppo: 'Apprendimento', etichetta: 'Esplorazione', unita: '', def: 0.3, min: 0, max: 2, passo: 0.05, descrizione: 'Quanto il sistema prova cose nuove invece di ripetere le migliori.' },
  { chiave: 'durataEsperimentoBrani', gruppo: 'Apprendimento', etichetta: 'Durata di un esperimento', unita: 'brani', def: 10, min: 1, max: 100, passo: 1, descrizione: 'Dopo quanti brani un esperimento viene chiuso.' },
  { chiave: 'qcSilenzioDb', gruppo: 'Qualita\' audio', etichetta: 'Soglia di silenzio', unita: 'dB', def: -45, min: -80, max: -20, passo: 1, descrizione: 'Sotto questo livello medio il brano e\' considerato quasi silenzioso e viene scartato.' },
  { chiave: 'qcSilenzioFrazione', gruppo: 'Qualita\' audio', etichetta: 'Quota di silenzio ammessa', unita: '', def: 0.5, min: 0.1, max: 1, passo: 0.05, descrizione: 'Quota del brano che puo\' essere silenziosa prima dello scarto.' },
  { chiave: 'qcDurataMin', gruppo: 'Qualita\' audio', etichetta: 'Durata minima accettata', unita: '', def: 0.85, min: 0.5, max: 1, passo: 0.01, descrizione: 'Frazione della durata richiesta sotto cui il brano viene rigenerato.' },
  { chiave: 'qcDurataMax', gruppo: 'Qualita\' audio', etichetta: 'Durata massima accettata', unita: '', def: 1.25, min: 1, max: 2, passo: 0.01, descrizione: 'Frazione della durata richiesta sopra cui il brano viene scartato.' },
];

function leggiJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

// Scrittura atomica: prima un file temporaneo, poi il nome definitivo
function scriviJson(file, dati) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dati, null, 2));
  fs.renameSync(tmp, file);
}

function registra(sezione, chiave, prima, dopo) {
  fs.mkdirSync(HISTORY, { recursive: true });
  fs.appendFileSync(STORICO, JSON.stringify({ ts: new Date().toISOString(), sezione, chiave, prima, dopo }) + '\n');
}

function catalogoNomi() {
  const c = leggiJson(CATALOGO, { categories: [] });
  return (c.categories || []).map((x) => x.name);
}

function parametriAttuali() {
  const salvati = leggiJson(PARAMETRI, {});
  return PARAMETRI_DEF.map((d) => ({
    ...d,
    valore: typeof salvati[d.chiave] === 'number' ? salvati[d.chiave] : d.def,
    personalizzato: typeof salvati[d.chiave] === 'number',
  }));
}

function lettura() {
  const generiSalvati = leggiJson(PARAMETRI, {}).generi || {};
  const analisi = datiAnalisi();
  const brani = Object.fromEntries(analisi.generi.map((g) => [g.nome, g.brani]));
  const guida = leggiJson(GUIDA, {});
  const righe = fs.existsSync(STORICO) ? fs.readFileSync(STORICO, 'utf8').split('\n').filter(Boolean) : [];
  return {
    parametri: parametriAttuali(),
    comandi: leggiJson(COMANDI, {}),
    generi: catalogoNomi().map((nome) => {
      const s = generiSalvati[nome] || {};
      return { nome, peso: typeof s.peso === 'number' ? s.peso : 1, attivo: s.attivo !== false, brani: brani[nome] || 0 };
    }),
    guida: {
      versione: guida.versione || null,
      aggiornato: guida.aggiornato || null,
      style_extra: guida.style_extra || [],
      style_avoid: guida.style_avoid || [],
      note: guida.note || [],
      bpm_range: guida.bpm_range || {},
    },
    storico: righe.slice(-80).map((r) => JSON.parse(r)).reverse(),
  };
}

// ---- scritture ----

function impostaParametro({ chiave, valore }) {
  const def = PARAMETRI_DEF.find((d) => d.chiave === chiave);
  if (!def) throw new Error(`parametro sconosciuto: ${chiave}`);
  if (typeof valore !== 'number' || Number.isNaN(valore)) throw new Error(`${def.etichetta}: valore non numerico`);
  if (valore < def.min || valore > def.max) throw new Error(`${def.etichetta}: il valore deve stare tra ${def.min} e ${def.max}`);
  const salvati = leggiJson(PARAMETRI, {});
  const prima = typeof salvati[chiave] === 'number' ? salvati[chiave] : def.def;
  salvati[chiave] = Math.round(valore * 1000) / 1000;
  scriviJson(PARAMETRI, salvati);
  registra('parametri', chiave, prima, salvati[chiave]);
  return { ok: true, chiave, valore: salvati[chiave] };
}

function impostaGenere({ nome, peso, attivo }) {
  if (!catalogoNomi().includes(nome)) throw new Error(`genere sconosciuto: ${nome}`);
  const salvati = leggiJson(PARAMETRI, {});
  salvati.generi = salvati.generi || {};
  const corrente = salvati.generi[nome] || { peso: 1, attivo: true };
  const nuovo = { peso: corrente.peso, attivo: corrente.attivo };
  if (peso !== undefined) {
    if (typeof peso !== 'number' || peso < 0 || peso > 5) throw new Error('peso: deve essere tra 0 e 5');
    nuovo.peso = Math.round(peso * 100) / 100;
  }
  if (attivo !== undefined) {
    if (typeof attivo !== 'boolean') throw new Error('attivo: deve essere vero o falso');
    nuovo.attivo = attivo;
  }
  salvati.generi[nome] = nuovo;
  scriviJson(PARAMETRI, salvati);
  registra('generi', nome, corrente, nuovo);
  return { ok: true, nome, ...nuovo };
}

function comando({ azione, genere }) {
  const cur = leggiJson(COMANDI, {});
  let patch;
  if (azione === 'pausa') patch = { pausa: true };
  else if (azione === 'riprendi') patch = { pausa: null };
  else if (azione === 'svuota_coda') patch = { svuotaCoda: true };
  else if (azione === 'produci') {
    if (!catalogoNomi().includes(genere)) throw new Error(`genere sconosciuto: ${genere}`);
    patch = { produciGenere: genere };
  } else throw new Error(`azione sconosciuta: ${azione}`);
  const nuovo = { ...cur, ...patch };
  for (const k of Object.keys(nuovo)) if (nuovo[k] === null) delete nuovo[k];
  scriviJson(COMANDI, nuovo);
  registra('comandi', azione, cur, nuovo);
  return { ok: true, comandi: nuovo };
}

const SOLO_TESTO = /^[^<>]{2,160}$/;

function guida({ campo, valori, categoria, valore }) {
  const salvata = leggiJson(GUIDA, {});
  if (campo === 'style_extra' || campo === 'style_avoid') {
    if (!Array.isArray(valori) || valori.length > 30) throw new Error(`${campo}: elenco non valido (massimo 30 voci)`);
    const puliti = valori.map((v) => String(v).trim());
    for (const v of puliti) if (!SOLO_TESTO.test(v)) throw new Error(`${campo}: voce non valida "${v}" (2-160 caratteri, senza < o >)`);
    const prima = salvata[campo] || [];
    salvata[campo] = [...new Set(puliti)];
    registra('linee guida', campo, prima, salvata[campo]);
  } else if (campo === 'note') {
    if (!Array.isArray(valori) || valori.length > 20) throw new Error('note: massimo 20 voci');
    const puliti = valori.map((v) => String(v).trim()).filter(Boolean);
    for (const v of puliti) if (v.length > 300 || /[<>]/.test(v)) throw new Error('note: ogni voce deve avere al massimo 300 caratteri, senza < o >');
    const prima = salvata.note || [];
    salvata.note = puliti;
    registra('linee guida', 'note', prima, puliti);
  } else if (campo === 'bpm_range') {
    if (!catalogoNomi().includes(categoria)) throw new Error(`genere sconosciuto: ${categoria}`);
    const m = /^(\d{2,3})\s*-\s*(\d{2,3})$/.exec(String(valore || '').trim());
    if (!m) throw new Error('bpm: formato "minimo-massimo", per esempio 50-70');
    const a = Number(m[1]), b = Number(m[2]);
    if (a < 30 || b > 200 || a >= b) throw new Error('bpm: valori tra 30 e 200 e minimo minore del massimo');
    salvata.bpm_range = salvata.bpm_range || {};
    const prima = salvata.bpm_range[categoria] || null;
    salvata.bpm_range[categoria] = `${a}-${b}`;
    registra('linee guida', `bpm ${categoria}`, prima, salvata.bpm_range[categoria]);
  } else throw new Error(`campo sconosciuto: ${campo}`);
  salvata.aggiornato = new Date().toISOString();
  salvata.versione = (salvata.versione || 1);
  scriviJson(GUIDA, salvata);
  return { ok: true };
}

// Smista le richieste di scrittura. Ritorna { codice, corpo }.
function gestisci(url, dati) {
  try {
    if (url === '/api/controllo/parametro') return { codice: 200, corpo: impostaParametro(dati) };
    if (url === '/api/controllo/genere') return { codice: 200, corpo: impostaGenere(dati) };
    if (url === '/api/controllo/comando') return { codice: 200, corpo: comando(dati) };
    if (url === '/api/controllo/guida') return { codice: 200, corpo: guida(dati) };
    return { codice: 404, corpo: { ok: false, error: 'percorso non previsto' } };
  } catch (e) {
    return { codice: 400, corpo: { ok: false, error: e.message } };
  }
}

module.exports = { lettura, gestisci, PARAMETRI_DEF };
