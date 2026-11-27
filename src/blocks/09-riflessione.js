// BLOCCO 9 - Riflessione giornaliera: una volta al giorno (nella fascia dei messaggi) prepara il rapporto
// su ricette, voti ed errori, lo invia su Telegram e registra cosa ha imparato il sistema.
// Stato proprio in state/riflessione.json (parallelo alla produzione, nessun conflitto).
// il token Telegram sta nel gateway locale
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const RIF_FILE = path.join(CFG.dir, 'state', 'riflessione.json');
const ora = new Date();
const oggi = ora.toISOString().slice(0, 10);
const rif = readJsonSafe(RIF_FILE, { ultimo: null });

const { attivo, dati: scelti } = CFG.messaggi.tipi.rapporto;
const con = (d) => scelti.includes(d);
if (!CHAT || !attivo || !scelti.length || rif.ultimo === oggi || !inFascia(CFG.messaggi, ora)) {
  return [{ json: { riflessione: 'non dovuta oggi' } }];
}

async function tgSend(text) {
  const r = await gw('/tg', { method: 'sendMessage', body: { chat_id: CHAT, text: String(text).slice(0, 3900) } });
  if (!r.ok) throw new Error('invio Telegram non riuscito');
  return r.status;
}

const tracks = libraryTracks();
const stats = recipeStats(tracks);
const totale = tracks.length;

// Classifica delle ricette con almeno un dato
const classifica = Object.entries(stats).map(([k, s]) => {
  const r = ricettaScore(s, totale);
  return { ricetta: k, punteggio: r.p, voti: s.nu, brani: s.na, affidabile: r.affidabile };
}).sort((a, b) => b.punteggio - a.punteggio);

const ultime24 = tracks.filter((t) => Date.now() - Date.parse(t.meta.generato_il || 0) < 86400000);
const votiTotali = tracks.filter((t) => votoUtente(t)).length;
const erroriOggi = (() => {
  try {
    return fs.readFileSync(CFG.errorsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((e) => Date.now() - Date.parse(e.ts) < 86400000).length;
  } catch (e) { return 0; }
})();
const state = readJsonSafe(CFG.stateFile, {}) || {};
const guida = readGuidance();

// Salute del sistema (sola lettura): spazio su disco, battito del watchdog, errori piu' frequenti
const salute = (() => {
  let liberoGb = null;
  try { const s = fs.statfsSync('E:\\'); liberoGb = Math.round((s.bavail * s.bsize) / 1e9); } catch (e) { /* non disponibile */ }
  let batticoMin = null;
  try { batticoMin = Math.round((Date.now() - fs.statSync(path.join(CFG.dir, 'state', 'watchdog.heartbeat')).mtimeMs) / 60000); } catch (e) { /* assente */ }
  const perChiave = {};
  try {
    fs.readFileSync(CFG.errorsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((e) => Date.now() - Date.parse(e.ts) < 86400000)
      .forEach((e) => {
        const k = String(e.key).replace(/ a [^:]+:/, ' a <brano>:'); // stesso errore su brani diversi = un solo gruppo
        perChiave[k] = (perChiave[k] || 0) + 1;
      });
  } catch (e) { /* nessun errore */ }
  const top = Object.entries(perChiave).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { liberoGb, batticoMin, top, coda: (state.queue || []).length, falliti: (state.failed || []).length, scartati: state.scartati || 0 };
})();

const dati = {
  brani_totali: totale,
  brani_ultime_24h: ultime24.length,
  voti_totali: votiTotali,
  errori_24h: erroriOggi,
  esperimenti_attivi: (state.experiments || []).map((e) => e.key),
  migliori_ricette: classifica.filter((c) => c.affidabile).slice(0, 3),
  peggiori_ricette: classifica.filter((c) => c.affidabile).slice(-3),
  linee_guida_versione: guida.versione,
};

let commento = '';
if (con('commento')) try {
  const j = await llmJson('Sei l\'analista di un generatore di musica per yoga. Rispondi solo con JSON valido.',
    `Dati di oggi: ${JSON.stringify(dati)}
Scrivi un oggetto JSON con "sintesi" (2-3 frasi in italiano su cosa sta funzionando e cosa no) e "suggerimento" (una sola modifica concreta, o "nessuno"). Non proporre codice.`, 600);
  commento = `\n\n${j.sintesi || ''}${j.suggerimento && j.suggerimento !== 'nessuno' ? `\nSuggerimento: ${j.suggerimento}` : ''}`;
} catch (e) {
  commento = `\n\n(commento automatico non disponibile: ${e.message})`;
}

const testo = [
  `Rapporto giornaliero ${oggi}`,
  con('conteggi') && `Brani: ${totale} (ultime 24h: ${ultime24.length}) · voti: ${votiTotali} · errori 24h: ${erroriOggi}`,
  con('esperimenti') && `Esperimenti attivi: ${dati.esperimenti_attivi.length ? dati.esperimenti_attivi.join(', ') : 'nessuno'}`,
  con('salute') && `Salute: disco E: ${salute.liberoGb ?? '?'} GB liberi · coda ${salute.coda} · falliti ${salute.falliti} · scartati QC ${salute.scartati} · watchdog ${salute.batticoMin ?? '?'} min fa`,
  con('salute') && salute.liberoGb !== null && salute.liberoGb < 20 && 'ATTENZIONE: spazio su disco sotto 20 GB',
  con('errori') && (salute.top.length ? `Errori principali 24h: ${salute.top.map(([k, n]) => `${k} (${n})`).join('; ')}` : 'Errori 24h: nessuno'),
  con('migliori') && `Migliori ricette: ${dati.migliori_ricette.map((c) => `${c.ricetta} (${c.punteggio.toFixed(2)})`).join('; ') || 'ancora pochi dati'}`,
  con('rivedere') && `Da rivedere: ${dati.peggiori_ricette.map((c) => `${c.ricetta} (${c.punteggio.toFixed(2)})`).join('; ') || 'nessuna'}`,
].filter(Boolean).join('\n') + commento;

try {
  await tgSend(testo);
  fs.writeFileSync(RIF_FILE, JSON.stringify({ ultimo: oggi, dati }, null, 2));
  log(`riflessione giornaliera inviata (${totale} brani, ${votiTotali} voti)`);
  return [{ json: { riflessione: 'inviata' } }];
} catch (e) {
  log(`riflessione: invio Telegram fallito: ${e.message}`);
  return [{ json: { riflessione: 'errore', message: e.message } }];
}
