// Aggiunge al gateway una sola operazione: lettura della libreria iBroadcast (sola lettura).
const fs = require('fs');
const file = 'E:/n8n/officina-sonora/gateway/server.js';
let s = fs.readFileSync(file, 'utf8');

const funzione = `// Lettura della libreria (sola lettura): brani, playlist, tag e ascolti
async function ibLibrary() {
  const access = await accessToken();
  const body = Buffer.from(JSON.stringify({ client: 'officina-sonora', version: '1.0', device_name: 'officina-sonora', user_agent: 'officina-sonora', mode: 'library' }));
  const r = await httpsReq('library.ibroadcast.com', '/library', { 'Content-Type': 'application/json', 'User-Agent': 'officina-sonora', Authorization: 'Bearer ' + access }, body);
  return { status: r.status, json: r.json };
}

`;
const ancora1 = 'async function ibApi(mode, args) {';
if (!s.includes(ancora1)) throw new Error('ancora 1 non trovata');
s = s.replace(ancora1, funzione + ancora1);

const ancora2 = "    if (req.url === '/ib/upload') {";
if (!s.includes(ancora2)) throw new Error('ancora 2 non trovata');
s = s.replace(ancora2, "    if (req.url === '/ib/library') {\n      return rispondi(200, await ibLibrary());\n    }\n" + ancora2);

fs.writeFileSync(file, s);
console.log('route libreria aggiunta (sola lettura)');
