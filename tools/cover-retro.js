// Applica la copertina ai brani gia' presenti sul PC (solo locale: iBroadcast non viene toccato).
const fs = require('fs'), path = require('path');
const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const libIb = fs.readFileSync('E:/n8n/yoga/src/lib-ibroadcast.js', 'utf8');
const cover = fs.readFileSync('E:/n8n/yoga/src/cover.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const brani = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (/\.mp3$/.test(n)) {
      const j = f.replace(/\.mp3$/, '.json');
      if (fs.existsSync(j)) brani.push({ mp3: f, json: j });
    }
  }
})('E:/Yoga Music');
new AF('require', 'console', lib + '\n' + libIb + '\n' + cover + `
const brani = ${JSON.stringify(brani)};
let ok = 0, errori = 0;
for (const b of brani) {
  try {
    const meta = JSON.parse(fs.readFileSync(b.json, 'utf8'));
    tagFile(b.mp3, meta);
    ok++;
  } catch (e) { errori++; console.log('errore su', b.mp3, e.message); }
}
console.log('copertine applicate:', ok, 'errori:', errori);
`)(require, console).catch((e) => console.error('ERR', e.message));
