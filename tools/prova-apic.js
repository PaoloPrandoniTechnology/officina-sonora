// Prova: applica i tag ID3 con copertina su una copia del file e legge i frame.
const fs = require('fs');
const lib = fs.readFileSync('E:/n8n/yoga/src/lib.js', 'utf8') + '\n' + fs.readFileSync('E:/n8n/yoga/src/lib-apprendimento.js', 'utf8');
const libIb = fs.readFileSync('E:/n8n/yoga/src/lib-ibroadcast.js', 'utf8');
const cover = fs.readFileSync('E:/n8n/yoga/src/cover.js', 'utf8');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const file = 'E:/n8n/yoga/state/tagtest/t.mp3';
new AF('require', 'console', lib + '\n' + libIb + '\n' + cover + `
const n = tagFile(${JSON.stringify(file)}, { titolo: 'Prova', categoria: 'Meditazione', genere: 'Drone meditativo', numero_traccia: 3, bpm: 55, tonalita: 'Do minore', generato_il: new Date().toISOString() });
const b = fs.readFileSync(${JSON.stringify(file)});
const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
let p = 10; const ids = [];
while (p < 10 + size) { const id = b.toString('ascii', p, p + 4); const len = b.readUInt32BE(p + 4); if (!/^[A-Z0-9]{4}$/.test(id) || len === 0) break; ids.push(id + ':' + len); p += 10 + len; }
console.log('frame scritti:', n, '| frame letti:', ids.join(' '));
console.log('audio dopo i tag:', b.slice(10 + size, 10 + size + 2).toString('hex'));
`)(require, console).catch((e) => console.error('ERR', e.message));
