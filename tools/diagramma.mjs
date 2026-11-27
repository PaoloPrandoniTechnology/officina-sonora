// Genera il diagramma del flusso di n8n dal file officina-sonora-workflow.json (sempre allineato alla versione pubblicata).
// Uso: node tools/diagramma.mjs   -> docs/flusso-n8n.svg (poi la PNG si crea con tools/screenshot.ps1)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const wf = JSON.parse(readFileSync(join(radice, 'officina-sonora-workflow.json'), 'utf8'));

const nomi = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
const archi = []; // [da, uscita, a]
for (const [da, uscite] of Object.entries(wf.connections)) {
  uscite.main.forEach((gruppo, uscita) => (gruppo || []).forEach((c) => archi.push([da, uscita, c.node])));
}

// Livelli: profondita' dal nodo di partenza (il workflow e' aciclico)
const livello = { 'Ogni minuto': 0 };
let cambiato = true;
while (cambiato) {
  cambiato = false;
  for (const [da, , a] of archi) {
    if (livello[da] !== undefined && (livello[a] === undefined || livello[a] < livello[da] + 1)) {
      livello[a] = livello[da] + 1;
      cambiato = true;
    }
  }
}
const colonne = {};
for (const n of wf.nodes) {
  const l = livello[n.name] ?? 0;
  (colonne[l] = colonne[l] || []).push(n.name);
}

// Colori per fase (in base al numero del nodo)
function fase(nome) {
  if (/^Ogni minuto/.test(nome)) return { c: '#38bdf8', t: 'Avvio' };
  const m = /^(\d+[a-z]?\d?)/.exec(nome);
  const p = m ? m[1] : '';
  if (/^1|^2/.test(p) || /^(IF|Render|Pipeline)/.test(nome) || /occupata|in corso|concluso/.test(nome)) return { c: '#94a3b8', t: 'Controllo' };
  if (/^3/.test(p)) return { c: '#34d399', t: 'Audio e caricamento' };
  if (/^4/.test(p)) return { c: '#a78bfa', t: 'Apprendimento' };
  if (/^5/.test(p)) return { c: '#fbbf24', t: 'Composizione' };
  if (/^6|^7/.test(p)) return { c: '#2dd4bf', t: 'Render e stato' };
  if (/^8/.test(p)) return { c: '#f472b6', t: 'Telegram' };
  if (/^9|^10/.test(p)) return { c: '#fb923c', t: 'Rapporto e voti' };
  return { c: '#94a3b8', t: '' };
}

const LARG = 210, ALT = 52, GX = 70, GY = 26, MX = 40, MY = 70;
const colKeys = Object.keys(colonne).map(Number).sort((a, b) => a - b);
// Su due fasce: le colonne oltre la metà scendono sotto, cosi' il diagramma resta leggibile
const PER_FASCIA = Math.ceil(colKeys.length / 2);
const fasciaAlt = Math.max(...colKeys.map((k) => colonne[k].length)) * (ALT + GY);
const W = MX * 2 + PER_FASCIA * LARG + (PER_FASCIA - 1) * GX;
const H = MY + 2 * fasciaAlt + 120;
const pos = {};
colKeys.forEach((k, idx) => {
  const fascia = Math.floor(idx / PER_FASCIA);
  const ci = idx % PER_FASCIA;
  colonne[k].forEach((nome, ri) => {
    const x = MX + ci * (LARG + GX);
    const y = MY + fascia * (fasciaAlt + 40) + ri * (ALT + GY) + (fasciaAlt - colonne[k].length * (ALT + GY)) / 2;
    pos[nome] = { x, y };
  });
});

// Etichette delle uscite per i nodi con condizioni
const etichette = {
  'Render in corso?': ['sì, render in corso', 'no, scegli il prossimo'],
  'Pipeline occupata?': ['occupata: stop', 'libera: procedi'],
  'Render concluso?': ['concluso', 'in corso o fallito'],
};

const sx = (n) => esc(n);
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">
<defs>
  <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0e15"/><stop offset="1" stop-color="#121826"/></linearGradient>
  <marker id="freccia" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#64748b"/></marker>
  <filter id="ombra" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.45"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#fondo)"/>
<text x="${MX}" y="38" fill="#e6eaf2" font-size="22" font-weight="650">Officina Sonora · flusso del workflow n8n</text>
<text x="${MX}" y="58" fill="#8a94a8" font-size="13">${wf.nodes.length} nodi, letti da sinistra a destra. Il ciclo di produzione parte dal nodo "1 Leggi stato".</text>
`;

// Collegamenti
for (const [da, uscita, a] of archi) {
  if (!pos[da] || !pos[a]) continue;
  const p1 = pos[da], p2 = pos[a];
  const x1 = p1.x + LARG, y1 = p1.y + ALT / 2;
  const x2 = p2.x, y2 = p2.y + ALT / 2;
  const cx = (x1 + x2) / 2;
  const colore = '#64748b';
  svg += `<path d="M${x1} ${y1} C${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}" fill="none" stroke="${colore}" stroke-width="1.6" opacity="0.85" marker-end="url(#freccia)"/>`;
  const et = etichette[da];
  if (et && uscita < et.length) {
    svg += `<text x="${x1 + 6}" y="${y1 - 6}" fill="#8a94a8" font-size="11">${esc(et[uscita])}</text>`;
  }
}

// Nodi
for (const nome of Object.keys(pos)) {
  const { x, y } = pos[nome];
  const f = fase(nome);
  svg += `<g filter="url(#ombra)">
    <rect x="${x}" y="${y}" width="${LARG}" height="${ALT}" rx="11" fill="#151b28" stroke="${f.c}" stroke-width="1.6"/>
    <rect x="${x}" y="${y}" width="6" height="${ALT}" rx="3" fill="${f.c}"/>
    <text x="${x + 16}" y="${y + 22}" fill="#e6eaf2" font-size="13" font-weight="600">${sx(nome)}</text>
    <text x="${x + 16}" y="${y + 40}" fill="${f.c}" font-size="11">${esc(f.t)}</text>
  </g>`;
}

// Legenda
const fasi = [...new Set(wf.nodes.map((n) => fase(n.name).t).filter(Boolean))];
let lx = MX;
const ly = H - 34;
for (const t of fasi) {
  const c = fase(wf.nodes.find((n) => fase(n.name).t === t).name).c;
  svg += `<circle cx="${lx + 6}" cy="${ly}" r="6" fill="${c}"/><text x="${lx + 18}" y="${ly + 4}" fill="#8a94a8" font-size="12">${esc(t)}</text>`;
  lx += 30 + t.length * 7.2;
}
svg += `</svg>\n`;

mkdirSync(join(radice, 'docs'), { recursive: true });
writeFileSync(join(radice, 'docs', 'flusso-n8n.svg'), svg, 'utf8');
console.log(`docs/flusso-n8n.svg creato: ${Object.keys(pos).length} nodi, ${archi.length} collegamenti, ${colKeys.length} colonne`);
