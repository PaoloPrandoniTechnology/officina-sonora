// Divide il blocco Telegram in due: 8a comandi/pulsanti, 8b avvisi di errore (entrambi con le stesse utilita').
const fs = require('fs');
const src = fs.readFileSync('E:/n8n/yoga/src/blocks/08-telegram.js', 'utf8');
const iAvvisi = src.indexOf('// ---- Avvisi:');
const iMain = src.indexOf('async function main()');
if (iAvvisi < 0 || iMain < 0) throw new Error('marcatori non trovati');
const avvisiTesto = src.slice(iAvvisi, iMain);
const corpoMain = src.slice(iMain);

// Il primo blocco (fino agli avvisi) e' comune: configurazione, utilita' Telegram, comandi
const comune = src.slice(0, iAvvisi);

// 8a: comandi. Il main non chiama piu' gli avvisi.
const main8a = corpoMain.replace('  await avvisi();\n', '').replace(/\n+$/, '\n');
const blocco8a = comune + main8a;
fs.writeFileSync('E:/n8n/yoga/src/blocks/08a-comandi-telegram.js', blocco8a);

// 8b: avvisi. Usa la stessa configurazione e le stesse utilita' Telegram, senza comandi.
const intestazione = `// BLOCCO 8b - Avvisi Telegram: segnala solo i casi gravi che richiedono il tuo intervento.
const CHAT = Number((readJsonSafe(CFG.telegramFile, {}) || {}).chat_id);
const TG_FILE = path.join(CFG.dir, 'state', 'telegram.json');
if (!CHAT) return [{ json: { avvisi: 'non configurato' } }];
let tgs = readJsonSafe(TG_FILE, { offset: 0, pending: {}, alerted: {}, seq: 0 });
async function tgRequest(method, body) { return gw('/tg', { method, body }); }
async function say(text) { return tgRequest('sendMessage', { chat_id: CHAT, text: String(text).slice(0, 3900) }); }

`;
const fine = `
try {
  await avvisi();
  fs.writeFileSync(TG_FILE, JSON.stringify(tgs, null, 2));
  return [{ json: { avvisi: 'ok' } }];
} catch (e) {
  log('avvisi Telegram: errore: ' + e.message);
  return [{ json: { avvisi: 'errore', message: e.message } }];
}
`;
fs.writeFileSync('E:/n8n/yoga/src/blocks/08b-avvisi-telegram.js', intestazione + avvisiTesto + fine);
fs.unlinkSync('E:/n8n/yoga/src/blocks/08-telegram.js');
console.log('08 diviso in 08a (comandi) e 08b (avvisi)');
