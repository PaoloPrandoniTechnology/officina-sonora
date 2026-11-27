// BLOCCO 9 - Riflessione giornaliera: una volta al giorno (dopo le 8) prepara il rapporto
// su ricette, voti ed errori, lo invia su Telegram e registra cosa ha imparato il sistema.
// Stato proprio in state/riflessione.json (parallelo alla produzione, nessun conflitto).
// il token Telegram sta nel gateway locale
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const RIF_FILE = path.join(CFG.dir, 'state', 'riflessione.json');
const ora = new Date();
const oggi = ora.toISOString().slice(0, 10);
const rif = readJsonSafe(RIF_FILE, { ultimo: null });

if (!CHAT || rif.ultimo === oggi || ora.getHours() < 8) {
  return [{ json: { riflessione: 'non dovuta oggi' } }];
}

async function tgSend(text) {
  const r = await gw('/tg', { method: 'sendMessage', body: { chat_id: CHAT, text: String(text).slice(0, 3900) } });
  if (!r.ok) throw new Error('invio Telegram non riuscito');
  return r.status;
}

const tracks = libraryTracks();
const votes = readVotes();
const stats = recipeStats(tracks, votes);
const totale = tracks.length;

// Classifica delle ricette con almeno un dato
const classifica = Object.entries(stats).map(([k, s]) => {
  const r = ricettaScore(s, totale);
  return { ricetta: k, punteggio: r.p, voti: s.nu, brani: s.na, affidabile: r.affidabile };
}).sort((a, b) => b.punteggio - a.punteggio);

const ultime24 = tracks.filter((t) => Date.now() - Date.parse(t.meta.generato_il || 0) < 86400000);
const votiOggi = Object.keys(votes).length;
const erroriOggi = (() => {
  try {
    return fs.readFileSync(CFG.errorsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((e) => Date.now() - Date.parse(e.ts) < 86400000).length;
  } catch (e) { return 0; }
})();
const state = readJsonSafe(CFG.stateFile, {}) || {};
const guida = readGuidance();

const dati = {
  brani_totali: totale,
  brani_ultime_24h: ultime24.length,
  voti_totali: votiOggi,
  errori_24h: erroriOggi,
  esperimenti_attivi: (state.experiments || []).map((e) => e.key),
  migliori_ricette: classifica.filter((c) => c.affidabile).slice(0, 3),
  peggiori_ricette: classifica.filter((c) => c.affidabile).slice(-3),
  linee_guida_versione: guida.versione,
};

let commento = '';
try {
  const j = await llmJson('Sei l\'analista di un generatore di musica per yoga. Rispondi solo con JSON valido.',
    `Dati di oggi: ${JSON.stringify(dati)}
Scrivi un oggetto JSON con "sintesi" (2-3 frasi in italiano su cosa sta funzionando e cosa no) e "suggerimento" (una sola modifica concreta, o "nessuno"). Non proporre codice.`, 600);
  commento = `\n\n${j.sintesi || ''}${j.suggerimento && j.suggerimento !== 'nessuno' ? `\nSuggerimento: ${j.suggerimento}` : ''}`;
} catch (e) {
  commento = `\n\n(commento automatico non disponibile: ${e.message})`;
}

const testo = [
  `Rapporto giornaliero ${oggi}`,
  `Brani: ${totale} (ultime 24h: ${ultime24.length}) · voti: ${votiOggi} · errori 24h: ${erroriOggi}`,
  `Esperimenti attivi: ${dati.esperimenti_attivi.length ? dati.esperimenti_attivi.join(', ') : 'nessuno'}`,
  `Migliori ricette: ${dati.migliori_ricette.map((c) => `${c.ricetta} (${c.punteggio.toFixed(2)})`).join('; ') || 'ancora pochi dati'}`,
  `Da rivedere: ${dati.peggiori_ricette.map((c) => `${c.ricetta} (${c.punteggio.toFixed(2)})`).join('; ') || 'nessuna'}`,
].join('\n') + commento;

try {
  await tgSend(testo);
  fs.writeFileSync(RIF_FILE, JSON.stringify({ ultimo: oggi, dati }, null, 2));
  log(`riflessione giornaliera inviata (${totale} brani, ${votiOggi} voti)`);
  return [{ json: { riflessione: 'inviata' } }];
} catch (e) {
  log(`riflessione: invio Telegram fallito: ${e.message}`);
  return [{ json: { riflessione: 'errore', message: e.message } }];
}
