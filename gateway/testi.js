// Catena dei modelli di testo: i servizi cloud gratuiti di config\servizi.json in ordine, poi gemma in LM Studio.
// Le chiavi stanno cifrate (DPAPI) in secrets\ e le legge solo questo processo.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { scriviAtomico } = require('./disco');

const RADICE = path.join(__dirname, '..');
const MARGINE_LOCALE = 6000; // gemma ragiona prima di rispondere e il ragionamento consuma max_tokens
const SOSPESO_QUOTA_MS = 15 * 60000; // quota finita senza indicazioni su quando torna
const SOSPESO_LENTO_MS = 5 * 60000; // non risponde in tempo: non lo si aspetta di nuovo a ogni richiesta
const SOSPESO_RIFIUTO_MS = 60 * 60000; // chiave o modello rifiutati: inutile insistere

const LMS = path.join(require('os').homedir(), '.cache', 'lm-studio', 'bin', 'lms.exe');
function lms(args) {
  return new Promise((resolve) => {
    // lms scrive diversi messaggi su stderr: si restituiscono entrambi i canali
    execFile(LMS, args, { windowsHide: true, timeout: 180000 }, (e, out, err) => resolve(e ? { ok: false, error: e.message.slice(0, 200) } : { ok: true, testo: `${out}\n${err}` }));
  });
}
// gemma una sola volta: un secondo load creerebbe una seconda copia in memoria, anche con richieste insieme
let caricamento = null;
function caricaGemma() {
  caricamento = caricamento || (async () => {
    const ps = await lms(['ps']);
    if (/gemma/i.test(ps.testo || '')) return { ok: true };
    return lms(['load', 'google/gemma-4-e4b', '-y', '-c', '16384']);
  })().finally(() => { caricamento = null; });
  return caricamento;
}

// La chiave passa a PowerShell solo come nome di file, in una variabile d'ambiente
function decifraDpapi(file) {
  const comando = '$s = Get-Content -LiteralPath $env:OFS_SEGRETO | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))';
  const env = { ...process.env, OFS_SEGRETO: file };
  delete env.PSModulePath; // se ereditata da PowerShell 7, la 5.1 non trova ConvertTo-SecureString
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], { env, windowsHide: true, timeout: 20000 },
      (e, out) => (e || !out.trim() ? reject(new Error('chiave illeggibile: reinseriscila con tools\\chiavi.ps1')) : resolve(out.trim())));
  });
}

// La chiave arriva a PowerShell dallo standard input: non compare tra gli argomenti dei processi
function cifraDpapi(valore) {
  const comando = '[Console]::In.ReadToEnd().Trim() | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString';
  const env = { ...process.env };
  delete env.PSModulePath;
  return new Promise((resolve, reject) => {
    const p = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], { env, windowsHide: true, timeout: 20000 },
      (e, out) => (e || !out.trim() ? reject(new Error('cifratura della chiave non riuscita')) : resolve(out.trim())));
    p.stdin.end(valore);
  });
}

function crea({
  config = path.join(RADICE, 'config', 'servizi.json'), segreti = path.join(RADICE, 'secrets'),
  stato = path.join(RADICE, 'state', 'testi.json'), locale = { url: 'http://127.0.0.1:1234/v1/chat/completions', modello: 'google/gemma-4-e4b' },
  decifra = decifraDpapi, cifra = cifraDpapi, carica = caricaGemma, adesso = Date.now,
  renderInCorso = () => Boolean(leggi(path.join(RADICE, 'state', 'state.json'), {}).job),
} = {}) {
  const memoria = new Map(); // chiavi in chiaro, solo in memoria, rilette se il file cambia
  const servizi = () => leggi(config, {}).testi || [];
  const fileChiave = (s) => path.join(segreti, `${path.basename(String(s.chiave))}.dpapi`);
  const oggi = () => new Date(adesso()).toISOString().slice(0, 10);

  async function chiaveDi(s) {
    const file = fileChiave(s);
    const versione = fs.statSync(file).mtimeMs;
    const nota = memoria.get(file);
    if (nota && nota.versione === versione) return nota.valore;
    const valore = await decifra(file);
    memoria.set(file, { versione, valore });
    return valore;
  }

  function annota(nome, cambia) {
    const d = leggi(stato, {});
    if (d.giorno !== oggi()) { d.giorno = oggi(); for (const v of Object.values(d.servizi || {})) { v.oggi = 0; v.errori = 0; } }
    d.servizi = d.servizi || {};
    const v = { oggi: 0, errori: 0, ...d.servizi[nome] };
    cambia(v);
    d.servizi[nome] = v;
    // il conteggio è un di più: se non si scrive, il testo si consegna lo stesso
    try { scriviAtomico(stato, JSON.stringify(d, null, 1)); } catch (e) { /* si riprova alla prossima */ }
  }

  async function domanda(s, chiave, { system, user, maxTokens, temperature, json }, attesa) {
    const r = await fetch(s.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(chiave ? { Authorization: `Bearer ${chiave}` } : {}) },
      body: JSON.stringify({
        model: s.modello, temperature, max_tokens: maxTokens + (s.margine ?? MARGINE_LOCALE),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      redirect: 'error', // la chiave va solo all'indirizzo configurato
      signal: AbortSignal.timeout(attesa),
    });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { codice: r.status, riprovaTra: Number(r.headers.get('retry-after')) });
    const scelta = (await r.json()).choices[0];
    if (scelta.finish_reason === 'length') throw new Error('risposta del modello troncata (max_tokens)');
    const testo = String(scelta.message.content || '').trim();
    if (!json) { if (!testo) throw new Error('risposta vuota'); return { testo }; }
    const a = testo.indexOf('{');
    const b = testo.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('nessun JSON nella risposta del modello');
    return { testo, dati: JSON.parse(testo.slice(a, b + 1)) };
  }

  // solo = nome di un servizio da provare senza ripiego; attesaMs vale per ogni tentativo
  async function chiedi({ system, user, maxTokens = 1200, temperature = 0.8, json = true, solo, attesaMs, caricaLocale = true }) {
    const richiesta = { system: String(system), user: String(user), maxTokens: Math.min(4000, Number(maxTokens) || 1200), temperature, json };
    const motivi = [];
    for (const s of servizi()) {
      if (solo ? s.nome !== solo : s.attivo === false) continue;
      if (!fs.existsSync(fileChiave(s))) { if (solo) motivi.push(`${s.nome}: chiave non inserita`); continue; }
      const sospeso = ((leggi(stato, {}).servizi || {})[s.nome] || {}).sospesoFino;
      if (!solo && sospeso && Date.parse(sospeso) > adesso()) continue;
      try {
        const r = await domanda(s, await chiaveDi(s), richiesta, attesaMs || 60000);
        annota(s.nome, (v) => { v.oggi++; v.ultimo = new Date(adesso()).toISOString(); delete v.sospesoFino; delete v.errore; });
        return { servizio: s.nome, ...r };
      } catch (e) {
        const pausa = e.codice === 429 ? (e.riprovaTra > 0 ? e.riprovaTra * 1000 : SOSPESO_QUOTA_MS) : [401, 403, 404].includes(e.codice) ? SOSPESO_RIFIUTO_MS : e.name === 'TimeoutError' ? SOSPESO_LENTO_MS : 0;
        const errore = e.codice === 429 ? 'quota esaurita' : e.name === 'TimeoutError' ? 'nessuna risposta in tempo' : e.codice ? `HTTP ${e.codice}` : e.message.slice(0, 120);
        annota(s.nome, (v) => { v.errori++; v.errore = errore; if (pausa) v.sospesoFino = new Date(adesso() + pausa).toISOString(); });
        motivi.push(`${s.nome}: ${errore}`);
      }
    }
    if (solo) throw new Error(motivi.join('; ') || `servizio sconosciuto: ${solo}`);
    // gemma si carica solo adesso e mai durante un render: sulla scheda video non stanno insieme
    if (caricaLocale && !renderInCorso()) await carica();
    try {
      return { servizio: 'locale', motivi, ...(await domanda(locale, '', richiesta, attesaMs || 600000)) };
    } catch (e) {
      throw new Error(e.codice ? `LLM HTTP ${e.codice}` : e.message);
    }
  }

  // Prova, senza ripiego, tutti i servizi che usano una chiave
  async function prova(chiave) {
    const prove = [];
    for (const s of servizi().filter((x) => x.chiave === chiave)) {
      try {
        await chiedi({ system: 'Rispondi solo con JSON valido.', user: 'Rispondi con {"ok":true}', maxTokens: 50, solo: s.nome, attesaMs: 60000 });
        prove.push({ nome: s.nome, ok: true });
      } catch (e) { prove.push({ nome: s.nome, ok: false, errore: e.message }); }
    }
    return prove;
  }

  // Richieste della scheda "Chiavi": la chiave entra, non esce mai
  async function gestisci(azione, { chiave, valore } = {}) {
    const suoi = servizi().filter((s) => s.chiave === chiave);
    if (!suoi.length) throw new Error('servizio non previsto');
    const file = fileChiave(suoi[0]);
    if (azione === 'chiave') {
      const v = String(valore || '').trim();
      if (!/^[\x21-\x7e]{10,300}$/.test(v)) throw new Error('chiave non valida: incollala intera, senza spazi');
      scriviAtomico(file, await cifra(v));
    } else if (azione === 'togli') {
      fs.rmSync(file, { force: true });
    } else if (azione !== 'prova') throw new Error('richiesta non prevista');
    memoria.delete(file);
    // una chiave cambiata riparte senza pause né vecchi errori
    if (azione !== 'prova') for (const s of suoi) annota(s.nome, (v) => { delete v.sospesoFino; delete v.errore; });
    if (azione === 'togli') return { ok: true };
    if (!fs.existsSync(file)) throw new Error('chiave non inserita');
    return { ok: true, prove: await prova(chiave) };
  }

  // Per la dashboard: nessuna chiave e nessun indirizzo
  function riepilogo() {
    const d = leggi(stato, {});
    return servizi().map((s) => {
      const v = (d.servizi || {})[s.nome] || {};
      const sospeso = v.sospesoFino && Date.parse(v.sospesoFino) > adesso() ? v.sospesoFino : null;
      return { nome: s.nome, chiave: s.chiave, modello: s.modello, configurato: fs.existsSync(fileChiave(s)), attivo: s.attivo !== false,
        oggi: d.giorno === oggi() ? v.oggi || 0 : 0, sospesoFino: sospeso, errore: v.errore || null };
    });
  }

  return { chiedi, riepilogo, gestisci };
}

function leggi(file, vuoto) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return vuoto; }
}

module.exports = { crea, lms };
