// BLOCCO 11 - Riepilogo Telegram: alla frequenza scelta, dentro la fascia oraria, un solo messaggio
// con i brani caricati su iBroadcast dall'ultimo invio. Quelli della notte entrano nel primo del mattino.
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const RIEP_FILE = path.join(CFG.dir, 'state', 'riepilogo.json');
if (!CHAT) return [{ json: { riepilogo: 'non configurato' } }];

const adesso = new Date();
const salva = () => fs.writeFileSync(RIEP_FILE, JSON.stringify({ ultimo: adesso.toISOString() }));
const ultimo = Date.parse((readJsonSafe(RIEP_FILE, {}) || {}).ultimo);
// Primo avvio: si parte da adesso, senza riversare tutta la libreria
if (!ultimo) { salva(); return [{ json: { riepilogo: 'inizializzato' } }]; }

const imp = CFG.messaggi;
const slot = slotRiepilogo(imp, adesso);
if (slot === null || ultimo >= slot) return [{ json: { riepilogo: 'non dovuto' } }];

const { attivo, dati } = imp.tipi.riepilogo;
// Disattivato: si avanza comunque, cosi' alla riattivazione non arrivano gli arretrati
if (!attivo || !dati.length) { salva(); return [{ json: { riepilogo: 'disattivato' } }]; }

const quando = (t) => Date.parse((t.meta.ibroadcast || {}).caricato_il);
const brani = libraryTracks().filter((t) => quando(t) > ultimo && quando(t) <= adesso.getTime())
  .sort((a, b) => quando(a) - quando(b)).map((t) => t.meta);
if (!brani.length) { salva(); return [{ json: { riepilogo: 'nessun brano nuovo' } }]; }

try {
  const text = testoRiepilogo(brani, dati, (readJsonSafe(CFG.stateFile, {}) || {}).done);
  const r = await gw('/tg', { method: 'sendMessage', body: { chat_id: CHAT, text } });
  if (!r.ok) throw new Error('invio Telegram non riuscito');
  salva(); // solo a invio riuscito: altrimenti si riprova al giro successivo
  log(`riepilogo Telegram inviato (${brani.length} brani)`);
  return [{ json: { riepilogo: 'inviato', brani: brani.length } }];
} catch (e) {
  log('riepilogo Telegram non inviato: ' + e.message);
  return [{ json: { riepilogo: 'errore', message: e.message } }];
}
