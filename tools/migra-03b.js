// Migrazione one-off: il blocco 03b non tiene piu' i token e usa il gateway locale.
const fs = require('fs');
const file = 'E:/n8n/yoga/src/blocks/03b-pubblica-ibroadcast.js';
let s = fs.readFileSync(file, 'utf8');

function taglia(da, a, sostituto) {
  const i = s.indexOf(da);
  const j = s.indexOf(a, i + 1);
  if (i < 0 || j < 0) throw new Error('ancora non trovata: ' + da.slice(0, 50) + ' / ' + a.slice(0, 50));
  s = s.slice(0, i) + sostituto + s.slice(j);
}

taglia('const clientId = $env.IBROADCAST_CLIENT_ID;', '// Impronta FNV-1a', [
  '// I token iBroadcast non entrano in questo blocco: le chiamate passano dal gateway locale.',
  'const session = { access: null };',
  '',
  '',
].join('\n'));

taglia("// Chiamata JSON all'API iBroadcast", '// Tag iBroadcast', [
  "// Chiamata all'API iBroadcast tramite il gateway locale (il token resta li')",
  'async function ibApi(access, mode, args) {',
  "  const r = await gw('/ib/api', { mode, args });",
  "  if (r.ok === false && r.error) throw new Error(mode + ': ' + r.error);",
  '  const j = r.json || {};',
  "  if (j.result === false || r.status !== 200) throw new Error(mode + ' fallito (HTTP ' + r.status + ')');",
  '  return j;',
  '}',
  '',
  '',
].join('\n'));

taglia('async function upload(access, file) {', 'let session;', [
  'async function upload(access, file) {',
  '  const r = await gwUpload(path.basename(file), fs.readFileSync(file));',
  '  const j = r.json || {};',
  "  if (j.result === false) throw new Error('upload fallito (HTTP ' + r.status + '): ' + (j.message || ''));",
  '  const match = /\\((.*)\\) uploaded successfully/.exec(j.message || \'\');',
  "  return match ? match[1] : 'ok';",
  '}',
  '',
  '',
].join('\n'));

taglia('let session;', '// Tag e playlist ancora da applicare', [
  '// Sessione gestita dal gateway: qui nessun token',
  'state.ibroadcast = state.ibroadcast || {};',
  'delete state.ibroadcast.refresh_token; // il token vive solo nel gateway',
  '',
  '',
].join('\n'));

fs.writeFileSync(file, s);
console.log('03b migrato');
