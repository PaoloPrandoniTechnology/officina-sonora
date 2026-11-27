// Migrazione one-off: i blocchi Telegram 08 e 09 passano dal gateway locale (nessun token).
const fs = require('fs');
function taglia(file, da, a, nuovo) {
  let s = fs.readFileSync(file, 'utf8');
  const i = s.indexOf(da);
  const j = s.indexOf(a, i + 1);
  if (i < 0 || j < 0) throw new Error(file + ': ancora non trovata: ' + da.slice(0, 50));
  s = s.slice(0, i) + nuovo + s.slice(j);
  fs.writeFileSync(file, s);
}
const f8 = 'E:/n8n/officina-sonora/src/blocks/08-telegram.js';
taglia(f8, 'const TOKEN = $env.TELEGRAM_BOT_TOKEN;', 'const CHAT =', '// il token Telegram sta nel gateway locale: qui non c\'e\'\n');
taglia(f8, 'if (!TOKEN || !CHAT)', 'let tgs', 'if (!CHAT) return [{ json: { telegram: \'non configurato\' } }];\n\n');
taglia(f8, 'function tgRequest(method, body) {', 'async function say', `// Telegram si chiama tramite il gateway locale
async function tgRequest(method, body) {
  return gw('/tg', { method, body });
}

`);
const f9 = 'E:/n8n/officina-sonora/src/blocks/09-riflessione.js';
taglia(f9, 'const TOKEN = $env.TELEGRAM_BOT_TOKEN;', 'const CHAT =', '// il token Telegram sta nel gateway locale\n');
taglia(f9, 'if (!TOKEN || !CHAT', 'const ora', 'if (!CHAT');
taglia(f9, 'function tgSend(text) {', 'const tracks = libraryTracks();', `async function tgSend(text) {
  const r = await gw('/tg', { method: 'sendMessage', body: { chat_id: CHAT, text: String(text).slice(0, 3900) } });
  if (!r.ok) throw new Error('invio Telegram non riuscito');
  return r.status;
}

`);
console.log('08 e 09 migrati');
