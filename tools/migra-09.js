// Migrazione one-off: il blocco 09 manda il rapporto tramite il gateway (nessun token).
const fs = require('fs');
const file = 'E:/n8n/yoga/src/blocks/09-riflessione.js';
let s = fs.readFileSync(file, 'utf8');
function taglia(da, a, nuovo) {
  const i = s.indexOf(da);
  const j = s.indexOf(a, i + 1);
  if (i < 0 || j < 0) throw new Error('ancora non trovata: ' + da.slice(0, 50));
  s = s.slice(0, i) + nuovo + s.slice(j);
}
s = s.replace("const https = require('https');\n", '');
s = s.replace('if (!TOKEN || !CHAT || rif.ultimo', 'if (!CHAT || rif.ultimo');
taglia('function tgSend(text) {', 'const tracks = libraryTracks();', [
  'async function tgSend(text) {',
  "  const r = await gw('/tg', { method: 'sendMessage', body: { chat_id: CHAT, text: String(text).slice(0, 3900) } });",
  "  if (!r.ok) throw new Error('invio Telegram non riuscito');",
  '  return r.status;',
  '}',
  '',
  '',
].join('\n'));
fs.writeFileSync(file, s);
console.log('09 migrato');
