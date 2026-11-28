// BLOCCO 8b - Avvisi Telegram: segnala solo i casi gravi che richiedono il tuo intervento.
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const TG_FILE = path.join(CFG.dir, 'state', 'telegram.json');
if (!CHAT) return [{ json: { avvisi: 'non configurato' } }];
let tgs = readJsonSafe(TG_FILE, { offset: 0, pending: {}, alerted: {}, seq: 0 });
async function tgRequest(method, body) { return gw('/tg', { method, body }); }
async function say(text) { return tgRequest('sendMessage', { chat_id: CHAT, text: String(text).slice(0, 3900) }); }

// ---- Avvisi: un errore che si ripete 3 volte in un'ora viene segnalato (al massimo ogni 30 minuti) ----
async function avvisi() {
  let righe = [];
  try { righe = fs.readFileSync(CFG.errorsFile, 'utf8').split('\n').filter(Boolean).slice(-500).map((l) => JSON.parse(l)); } catch (e) { /* nessun errore registrato */ }
  const dopo = Date.now() - 3600000;
  const conta = {};
  for (const r of righe) if (Date.parse(r.ts) >= dopo) conta[r.key] = (conta[r.key] || 0) + 1;
  // Solo i casi che richiedono un tuo intervento: il resto (ritardi, riprove, attese) resta nel log
  const GRAVE = /refresh (token )?non valido|invalid_grant|login iBroadcast non riuscito|credenzial|gateway non configurato|scrittura fuori|lettura bloccata|spazio|disco pieno|ENOSPC|state\.json non leggibile|motore YuE2 non attivo.*(riavvio fallito)|token Telegram/i;
  for (const [key, n] of Object.entries(conta)) {
    if (!GRAVE.test(key)) continue;
    if (n < 3) continue;
    const ultimo = tgs.alerted[key] || 0;
    if (Date.now() - ultimo < 30 * 60000) continue;
    tgs.alerted[key] = Date.now();
    tgs.inAttesa = tgs.inAttesa || {};
    tgs.inAttesa[key] = { n, ultimo: Date.now() };
  }
  // Fuori fascia gli avvisi restano in attesa e partono alla riapertura
  const { attivo, dati } = CFG.messaggi.tipi.avvisi;
  if (!attivo || !dati.length) { tgs.inAttesa = {}; return; }
  if (!inFascia(CFG.messaggi, new Date())) return;
  for (const [key, info] of Object.entries(tgs.inAttesa || {})) {
    const r = await say(testoAvviso(key, info, dati));
    if (r.ok) delete tgs.inAttesa[key];
  }
}


try {
  await avvisi();
  fs.writeFileSync(TG_FILE, JSON.stringify(tgs, null, 2));
  return [{ json: { avvisi: 'ok' } }];
} catch (e) {
  log('avvisi Telegram: errore: ' + e.message);
  return [{ json: { avvisi: 'errore', message: e.message } }];
}
