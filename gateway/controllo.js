// Plancia di controllo: lettura e scrittura dei parametri della produzione.
// Ogni modifica e' validata entro limiti precisi, scritta in modo atomico e registrata nello storico.
// Le scritture sono accettate solo con l'intestazione X-Controllo: 1 (il browser non la invia da altri siti).
const fs = require('fs');
const path = require('path');
const { datiAnalisi } = require('./analisi');
const voti = require('./voti');
const sfondi = require('./sfondi');

const DIR = path.join(__dirname, '..');
const PARAMETRI = path.join(DIR, 'config', 'parametri.json');
const COMANDI = path.join(DIR, 'state', 'comandi.json');
const GUIDA = path.join(DIR, 'config', 'guidance.json');
const CATALOGO = path.join(DIR, 'config', 'catalogo.json');
const STORICO = path.join(DIR, 'config', 'history', 'controllo.jsonl');
const HISTORY = path.join(DIR, 'config', 'history');

// Impostazioni dei messaggi Telegram: stessa definizione usata dai blocchi n8n
const M = new Function(fs.readFileSync(path.join(DIR, 'src', 'lib-messaggi.js'), 'utf8')
  + '\nreturn { MESSAGGI_DEF, MESSAGGI_FREQUENZE, orariValidi, impostazioniMessaggi };')();

// Composizione dello stile: le stesse funzioni usate dai blocchi n8n
const STILE = new Function('CFG', 'path', fs.readFileSync(path.join(DIR, 'src', 'lib-apprendimento.js'), 'utf8')
  + '\nreturn { blocchiStile, erroreBlocco };')({ dir: DIR }, path);
const VOCABOLARIO = path.join(DIR, 'config', 'vocabolario.json');
// Spiegazioni dei termini per i tooltip: righe "termine|spiegazione" in config\spiegazioni
function spiegazioni() {
  const dir = path.join(DIR, 'config', 'spiegazioni');
  const out = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    for (const riga of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
      const i = riga.indexOf('|');
      if (i > 0) out[riga.slice(0, i).trim().toLowerCase()] = riga.slice(i + 1).trim();
    }
  }
  return out;
}
const BLOCCO_FISSO = /^(instrumental|wordless vocals|no vocals|no lyrics)$/i;

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
    messaggi: {
      impostazioni: M.impostazioniMessaggi(leggiJson(PARAMETRI, {}).messaggi),
      definizioni: M.MESSAGGI_DEF,
      frequenze: M.MESSAGGI_FREQUENZE,
    },
    comandi: leggiJson(COMANDI, {}),
    sfondi: sfondi.stato(),
    generi: (leggiJson(CATALOGO, { categories: [] }).categories || []).map((c) => {
      const nome = c.name;
      const s = generiSalvati[nome] || {};
      return { nome, etichetta: c.genere || nome, ambito: c.ambito || '', famiglia: c.famiglia || '', colore: (c.colori || [])[1] || '', bpm: c.bpm || [], strutture: c.strutture || [], peso: typeof s.peso === 'number' ? s.peso : 1, attivo: s.attivo !== false, brani: brani[nome] || 0, note: s.note || [] };
    }),
    guida: {
      versione: guida.versione || null,
      aggiornato: guida.aggiornato || null,
      style_extra: guida.style_extra || [],
      style_avoid: guida.style_avoid || [],
      note: [].concat(guida.note || []), // la revisione la scrive come testo, la pagina vuole un elenco
      stile_generi: guida.stile_generi || {},
      blocchi_generi: guida.blocchi_generi || {},
      bpm_range: guida.bpm_range || {},
      durata_hint: guida.durata_hint || {},
      struttura_pref: guida.struttura_pref || {},
    },
    vocabolario: leggiJson(VOCABOLARIO, { famiglie: {} }).famiglie,
    spiegazioni: spiegazioni(),
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

function impostaMessaggi({ frequenzaMin, inizio, fine, tipi }) {
  if (!M.MESSAGGI_FREQUENZE.includes(frequenzaMin)) throw new Error('frequenza non prevista');
  if (!M.orariValidi(inizio, fine)) throw new Error('orari: l\'inizio deve venire prima dello stop');
  const puliti = {};
  for (const [nome, def] of Object.entries(M.MESSAGGI_DEF)) {
    const t = (tipi || {})[nome];
    if (!t || typeof t.attivo !== 'boolean' || !Array.isArray(t.dati)) throw new Error(`${def.etichetta}: impostazioni incomplete`);
    if (!t.dati.every((d) => Object.hasOwn(def.dati, d))) throw new Error(`${def.etichetta}: dato sconosciuto`);
    if (t.attivo && !t.dati.length) throw new Error(`${def.etichetta}: scegli almeno un dato oppure disattiva il messaggio`);
    puliti[nome] = { attivo: t.attivo, dati: t.dati };
  }
  const salvati = leggiJson(PARAMETRI, {});
  const prima = M.impostazioniMessaggi(salvati.messaggi);
  salvati.messaggi = { frequenzaMin, inizio, fine, tipi: puliti };
  scriviJson(PARAMETRI, salvati);
  registra('messaggi', 'impostazioni', prima, salvati.messaggi);
  return { ok: true };
}

function impostaGenere({ nome, peso, attivo }) {
  if (!catalogoNomi().includes(nome)) throw new Error(`genere sconosciuto: ${nome}`);
  const salvati = leggiJson(PARAMETRI, {});
  salvati.generi = salvati.generi || {};
  const corrente = salvati.generi[nome] || { peso: 1, attivo: true };
  const nuovo = { ...corrente, peso: corrente.peso, attivo: corrente.attivo }; // conserva le note del genere
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
  if (azione === 'sfondi_avvia' || azione === 'sfondi_ferma') {
    if (azione === 'sfondi_avvia') sfondi.avvia(); else sfondi.ferma();
    registra('comandi', azione, {}, {});
    return { ok: true, sfondi: sfondi.stato() };
  }
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

function categoria_(nome) {
  const c = (leggiJson(CATALOGO, { categories: [] }).categories || []).find((x) => x.name === nome);
  if (!c) throw new Error(`genere sconosciuto: ${nome}`);
  return c;
}

// Blocchi aggiunti ed esclusi, generali o di un genere
function salvaBlocchi(salvata, { ambito, aggiunti, esclusi, azzera }) {
  const generale = ambito === 'generale';
  const cat = generale ? null : categoria_(ambito);
  const prima = generale ? { aggiunti: salvata.style_extra || [], esclusi: salvata.style_avoid || [] }
    : { ...(salvata.blocchi_generi || {})[ambito], revisione: (salvata.stile_generi || {})[ambito] };
  const pulisci = (lista, nome, massimo, controllo) => {
    if (!Array.isArray(lista) || lista.length > massimo) throw new Error(`${nome}: massimo ${massimo} blocchi`);
    const puliti = lista.map((v) => String(v).trim().toLowerCase());
    if (new Set(puliti).size !== puliti.length) throw new Error(`${nome}: blocco ripetuto`);
    for (const v of puliti) { const e = controllo(v); if (e) throw new Error(`"${v.slice(0, 60)}": ${e}`); }
    return puliti;
  };
  // le aggiunte generali valgono anche per i generi strumentali
  const piu = azzera ? [] : pulisci(aggiunti, 'aggiunti', 8, (v) => STILE.erroreBlocco(v, { strumentale: !(cat && cat.vocale_senza_parole) }));
  const meno = azzera ? [] : pulisci(esclusi, 'esclusi', 40, (v) => (BLOCCO_FISSO.test(v) ? 'e\' un blocco fisso'
    : v.length < 2 || v.length > 120 || /[,<>]/.test(v) ? 'blocco non valido' : ''));
  const doppio = piu.find((v) => meno.includes(v));
  if (doppio) throw new Error(`"${doppio}": non puo' essere insieme aggiunto ed escluso`);
  if (generale) {
    salvata.style_extra = piu;
    salvata.style_avoid = meno;
  } else {
    salvata.blocchi_generi = salvata.blocchi_generi || {};
    if (piu.length || meno.length) salvata.blocchi_generi[ambito] = { aggiunti: piu, esclusi: meno };
    else delete salvata.blocchi_generi[ambito];
    // "torna al predefinito" toglie anche le parole scritte dalla revisione
    if (azzera && salvata.stile_generi) delete salvata.stile_generi[ambito];
  }
  registra('linee guida', `blocchi ${ambito}`, prima, { aggiunti: piu, esclusi: meno });
}

// Anteprima per la pagina: tutti i blocchi del genere, un esempio di prompt finale e gli avvisi
function stile(genere, indiceVariante) {
  const cat = categoria_(genere);
  const guida = leggiJson(GUIDA, {});
  const note = ((leggiJson(PARAMETRI, {}).generi || {})[genere] || {}).note || [];
  const direttive = note.map((n) => String(n.inglese || n.testo || '').trim()).filter(Boolean).slice(0, 10);
  const varianti = cat.varianti || [];
  const variante = varianti[indiceVariante] || varianti[0] || null;
  const strumenti = cat.strumenti || [];
  const influenze = (cat.influenze || []).map((i) => i.genere);
  const [min, max] = /^(\d+)-(\d+)$/.exec((guida.bpm_range || {})[genere] || '')?.slice(1).map(Number) || cat.bpm;
  const opzioni = { bpm: Math.round((min + max) / 2), tonalita: (cat.tonalita || [])[0], direttive };
  const blocchi = STILE.blocchiStile(cat, variante, strumenti, influenze, guida, opzioni);
  const esempio = STILE.blocchiStile(cat, variante, strumenti.slice(0, 3), influenze.slice(0, 1), guida, opzioni).filter((b) => !b.escluso);
  const avvisi = [];
  const escluso = (testo) => blocchi.some((b) => b.escluso && b.testo.toLowerCase() === String(testo).toLowerCase());
  const en = cat.en || {};
  if (en.genre && en.genre.split(',').some((g) => escluso(g.trim()))) avvisi.push('Il termine del genere e\' escluso: il brano potrebbe uscire di un altro stile.');
  const famiglia = leggiJson(VOCABOLARIO, { famiglie: {} }).famiglie.strumenti || [];
  const suoi = Object.values(en.instruments || {});
  if (suoi.length && suoi.every(escluso) && !esempio.some((b) => b.origine !== 'catalogo' && famiglia.includes(b.testo))) avvisi.push('Nessuno strumento rimasto nello stile.');
  if (esempio.length > 25) avvisi.push(`${esempio.length} blocchi: oltre 25 il motore pesa poco ogni termine.`);
  for (const b of blocchi) if (b.escluso && b.origine === 'tuo') avvisi.push(`"${b.testo}" e' tra i tuoi blocchi ma escluso a livello generale.`);
  return {
    genere, variante: variante ? variante.nome : '', varianti: varianti.map((v) => v.nome), vocale: !!cat.vocale_senza_parole,
    blocchi, esempio: esempio.map((b) => b.testo).join(', '), conteggio: esempio.length, avvisi, bpm: `${min}-${max}`,
  };
}

function guida({ campo, valori, categoria, valore, ...blocchi }) {
  const salvata = leggiJson(GUIDA, {});
  if (campo === 'blocchi') {
    salvaBlocchi(salvata, blocchi);
  } else if (campo === 'note') {
    if (!Array.isArray(valori) || valori.length > 20) throw new Error('note: massimo 20 voci');
    const puliti = valori.map((v) => String(v).trim()).filter(Boolean);
    for (const v of puliti) if (v.length > 300 || /[<>]/.test(v)) throw new Error('note: ogni voce deve avere al massimo 300 caratteri, senza < o >');
    const prima = salvata.note || [];
    salvata.note = puliti;
    registra('linee guida', 'note', prima, puliti);
  } else if (campo === 'bpm_range' || campo === 'durata_hint') {
    // fascia "minimo-massimo" di un genere; vuota: torna al predefinito
    categoria_(categoria);
    const [nome, basso, alto] = campo === 'bpm_range' ? ['bpm', 30, 200] : ['durata', 60, 600];
    const testo = String(valore || '').trim();
    const mappa = (salvata[campo] = salvata[campo] || {});
    const prima = mappa[categoria] || null;
    if (!testo) delete mappa[categoria];
    else {
      const m = /^(\d{2,3})\s*-\s*(\d{2,3})$/.exec(testo);
      if (!m) throw new Error(`${nome}: formato "minimo-massimo", per esempio ${nome === 'bpm' ? '50-70' : '150-210'}`);
      const a = Number(m[1]), b = Number(m[2]);
      if (a < basso || b > alto || a >= b) throw new Error(`${nome}: valori tra ${basso} e ${alto} e minimo minore del massimo`);
      mappa[categoria] = `${a}-${b}`;
    }
    registra('linee guida', `${nome} ${categoria}`, prima, mappa[categoria] || null);
  } else if (campo === 'struttura_pref') {
    // strutture da usare per un genere; nessuna o tutte: predefinito
    const cat = categoria_(categoria);
    if (!Array.isArray(valori) || !valori.every((v) => (cat.strutture || []).includes(v))) throw new Error('strutture: scegline tra quelle del genere');
    const mappa = (salvata.struttura_pref = salvata.struttura_pref || {});
    const prima = mappa[categoria] || null;
    const scelte = (cat.strutture || []).filter((s) => valori.includes(s));
    if (!scelte.length || scelte.length === cat.strutture.length) delete mappa[categoria];
    else mappa[categoria] = scelte;
    registra('linee guida', `strutture ${categoria}`, prima, mappa[categoria] || null);
  } else throw new Error(`campo sconosciuto: ${campo}`);
  salvata.aggiornato = new Date().toISOString();
  salvata.versione = (salvata.versione || 1);
  scriviJson(GUIDA, salvata);
  return { ok: true };
}

function voto(dati) {
  const r = voti.vota(dati);
  registra('voti', `${r.numero} ${r.titolo}`, r.prima, r.dopo);
  return r;
}

// ---- note per genere ----
// Ogni nota viene scritta in italiano e tradotta in inglese (il motore YuE2 risponde meglio all'inglese).
// La traduzione usa il modello di LM Studio; se non risponde, la nota resta in italiano e viene usata cosi'.
const http = require('http');
const LLM = { hostname: '127.0.0.1', port: 1234, model: 'google/gemma-4-e4b' };

function traduci(testo) {
  return new Promise((resolve) => {
    const corpo = JSON.stringify({
      model: LLM.model,
      temperature: 0.2,
      max_tokens: 90,
      messages: [
        { role: 'system', content: 'You translate producer notes for an AI instrumental music generator into concise English style directions (max 20 words). Output only the English text, nothing else.' },
        { role: 'user', content: testo },
      ],
    });
    const req = http.request({ ...LLM, path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) }, timeout: 20000 }, (res) => {
      const ch = [];
      res.on('data', (c) => ch.push(c));
      res.on('end', () => {
        try {
          const j = JSON.parse(Buffer.concat(ch).toString('utf8'));
          const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve(t ? String(t).replace(/^["']|["']$/g, '').trim().slice(0, 240) : null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.write(corpo);
    req.end();
  });
}

async function aggiungiNota({ nome, testo }) {
  if (!catalogoNomi().includes(nome)) throw new Error(`genere sconosciuto: ${nome}`);
  const t = String(testo || '').trim();
  if (t.length < 3 || t.length > 300) throw new Error('nota: tra 3 e 300 caratteri');
  if (/[<>]/.test(t)) throw new Error('nota: non usare i caratteri < o >');
  const salvati = leggiJson(PARAMETRI, {});
  salvati.generi = salvati.generi || {};
  const corrente = salvati.generi[nome] || { peso: 1, attivo: true };
  const note = corrente.note || [];
  if (note.length >= 20) throw new Error('nota: massimo 20 note per genere');
  const inglese = await traduci(t);
  const nuova = { testo: t, inglese, ts: new Date().toISOString() };
  salvati.generi[nome] = { ...corrente, note: [...note, nuova] };
  scriviJson(PARAMETRI, salvati);
  registra('note genere', nome, null, nuova);
  return { ok: true, nome, nota: nuova, tradotta: !!inglese };
}

// Le note salvate senza traduzione (LM Studio spento o occupato) vengono ritradotte ogni 10 minuti
async function ritraduciPendenti() {
  const pendenti = [];
  for (const [nome, corrente] of Object.entries(leggiJson(PARAMETRI, {}).generi || {})) {
    for (const n of corrente.note || []) if (!n.inglese) pendenti.push({ nome, ts: n.ts, testo: n.testo });
  }
  if (!pendenti.length) return;
  const risultati = [];
  for (const p of pendenti) {
    const t = await traduci(p.testo);
    if (t) risultati.push({ ...p, inglese: t });
  }
  if (!risultati.length) return;
  // rilettura prima della scrittura: nel frattempo l'utente puo' aver aggiunto o tolto note
  const salvati = leggiJson(PARAMETRI, {});
  let cambiate = 0;
  for (const r of risultati) {
    const nota = ((salvati.generi || {})[r.nome]?.note || []).find((n) => n.ts === r.ts && !n.inglese);
    if (nota) { nota.inglese = r.inglese; cambiate++; }
  }
  if (cambiate) { scriviJson(PARAMETRI, salvati); registra('note genere', 'traduzione automatica', null, cambiate + ' note tradotte'); }
}
setInterval(() => { ritraduciPendenti().catch(() => {}); }, 10 * 60 * 1000).unref();

function togliNota({ nome, indice }) {
  const salvati = leggiJson(PARAMETRI, {});
  const corrente = (salvati.generi || {})[nome];
  if (!corrente || !Array.isArray(corrente.note) || !corrente.note[indice]) throw new Error('nota non trovata');
  const rimossa = corrente.note[indice];
  corrente.note = corrente.note.filter((_, i) => i !== indice);
  scriviJson(PARAMETRI, salvati);
  registra('note genere', nome, rimossa, null);
  return { ok: true };
}

// Smista le richieste di scrittura. Ritorna una Promise di { codice, corpo }.
async function gestisci(url, dati) {
  try {
    if (url === '/api/controllo/parametro') return { codice: 200, corpo: impostaParametro(dati) };
    if (url === '/api/controllo/messaggi') return { codice: 200, corpo: impostaMessaggi(dati) };
    if (url === '/api/controllo/genere') return { codice: 200, corpo: impostaGenere(dati) };
    if (url === '/api/controllo/comando') return { codice: 200, corpo: comando(dati) };
    if (url === '/api/controllo/guida') return { codice: 200, corpo: guida(dati) };
    if (url === '/api/controllo/nota') return { codice: 200, corpo: await aggiungiNota(dati) };
    if (url === '/api/controllo/nota/rimuovi') return { codice: 200, corpo: togliNota(dati) };
    if (url === '/api/controllo/voto') return { codice: 200, corpo: voto(dati) };
    return { codice: 404, corpo: { ok: false, error: 'percorso non previsto' } };
  } catch (e) {
    return { codice: 400, corpo: { ok: false, error: e.message } };
  }
}

module.exports = { stile, lettura, gestisci, PARAMETRI_DEF };
