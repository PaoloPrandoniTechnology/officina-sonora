// Integra le copertine: colori per genere nel catalogo, frame APIC nei tag ID3, inclusione nel build.
const fs = require('fs');
const base = 'E:/n8n/yoga/';

// 1) Colori per categoria (tre colori: sfondo chiaro-scuro e accento)
const colori = {
  'Meditazione': ['#1e2f4d', '#4f7fa8', '#e7c77a'],
  'Pranayama-respiro': ['#2c4a52', '#8fc3b8', '#f4efe1'],
  'Yin-Savasana': ['#120f1e', '#3a2d52', '#8a6fb3'],
  'Restorative': ['#4a3728', '#c9a57a', '#f6e7c9'],
  'Sound-bath-rilassamento': ['#2a1f3d', '#7d5fa3', '#e9d8ff'],
  'Hatha-base': ['#3b5b3a', '#a9c28a', '#f5e9c4'],
  'Vinyasa-dinamico': ['#6b2f1d', '#e08a3c', '#ffd27a'],
  'Power-yoga': ['#0f2a3d', '#2fb3c9', '#ff5d73'],
};
const cat = JSON.parse(fs.readFileSync(base + 'config/catalogo.json', 'utf8'));
for (const c of cat.categories) c.colori = colori[c.name] || ['#222222', '#666666', '#dddddd'];
fs.writeFileSync(base + 'config/catalogo.json', JSON.stringify(cat, null, 2));

// 2) Frame APIC nei tag ID3 (dopo i frame testuali)
const f = base + 'src/lib-ibroadcast.js';
let s = fs.readFileSync(f, 'utf8');
const ancora = "    commentFrame(comment),\n  ].filter(Boolean);";
if (!s.includes(ancora)) throw new Error('ancora tagFile non trovata');
s = s.replace(ancora, "    commentFrame(comment),\n    apicFrame(coverPng(meta.categoria, Number(meta.numero_traccia) || 1)),\n  ].filter(Boolean);");
fs.writeFileSync(f, s);

// 3) Il build include cover.js nei nodi iBroadcast
const b = base + 'build-workflow.mjs';
let w = fs.readFileSync(b, 'utf8');
const old = "const codeIb = (prefix) => lib + '\\n' + libIb + '\\n' + blockFile(prefix);";
if (!w.includes(old)) throw new Error('ancora build non trovata');
w = w.replace(old, "const coverJs = readFileSync(join(here, 'src', 'cover.js'), 'utf8');\nconst codeIb = (prefix) => lib + '\\n' + libIb + '\\n' + coverJs + '\\n' + blockFile(prefix);");
fs.writeFileSync(b, w);
console.log('copertine integrate');
