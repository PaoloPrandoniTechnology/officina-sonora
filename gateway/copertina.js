// Copertine: sfondo pre-generato del genere + etichetta, titolo e artista composti in SVG -> JPEG 1000x1000.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const CATALOGO = path.join(DIR, 'config', 'catalogo.json');
const SFONDI = path.join(DIR, 'assets', 'sfondi');
const FFMPEG = 'E:\\MusicAI\\ffmpeg\\bin\\ffmpeg.exe';
const FONT_FILE = ['georgia.ttf', 'georgiai.ttf', 'impact.ttf', 'bahnschrift.ttf', 'segoeui.ttf', 'segoeuii.ttf'];

function stileCopertina(categoria) {
  const c = (JSON.parse(fs.readFileSync(CATALOGO, 'utf8')).categories || []).find((x) => x.name === categoria) || {};
  const s = c.copertina || {};
  const nome = String(categoria || 'Raccolta').replace(/-/g, ' ');
  return {
    etichetta: s.etichetta || nome,
    prompt: s.prompt || `album cover art inspired by ${c.stile || nome}, evocative scenery, painterly illustration, rich colors`,
    font: s.font || 'Georgia',
    corsivo: !!s.corsivo,
    colore: (c.colori || [])[2] || '#ffffff',
  };
}

const esc = (s) => String(s).replace(/[\u0000-\u001f]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Va a capo in al massimo 4 righe, allargando la riga se serve; le parole oltre 24 caratteri si spezzano.
function righe(titolo) {
  const parole = String(titolo).slice(0, 90).split(/\s+/).filter(Boolean).flatMap((p) => p.match(/.{1,24}/g));
  for (let max = 16; ; max += 2) {
    const out = [];
    for (const p of parole) {
      if (out.length && (out[out.length - 1] + ' ' + p).length <= max) out[out.length - 1] += ' ' + p;
      else out.push(p);
    }
    if (out.length <= 4) return out;
  }
}

function svgCopertina({ titolo, stile, sfondo }) {
  const mime = sfondo[0] === 0x89 ? 'image/png' : 'image/jpeg';
  const l = righe(titolo);
  const corpo = Math.min(108, Math.floor(880 / (0.6 * Math.max(1, ...l.map((x) => x.length)))));
  const y0 = 900 - (l.length - 1) * corpo * 1.05;
  const colore = esc(stile.colore);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient></defs>
<image href="data:${mime};base64,${sfondo.toString('base64')}" width="1000" height="1000" preserveAspectRatio="xMidYMid slice"/>
<rect width="1000" height="1000" fill="url(#v)"/>
<rect x="64" y="${y0 - corpo - 62}" width="72" height="7" fill="${colore}"/>
<text x="64" y="${y0 - corpo - 12}" font-family="Bahnschrift" font-size="34" letter-spacing="7" fill="${colore}">${esc(stile.etichetta.toUpperCase())}</text>
${l.map((x, k) => `<text x="64" y="${y0 + k * corpo * 1.05}" font-family="${esc(stile.font)}" font-style="${stile.corsivo ? 'italic' : 'normal'}" font-size="${corpo}" fill="#fff">${esc(x)}</text>`).join('\n')}
<text x="64" y="962" font-family="Bahnschrift" font-size="22" letter-spacing="4" fill="#fff" fill-opacity="0.7">YOGA MUSIC FACTORY</text></svg>`;
}

let motore = null;
function resvg() {
  if (!motore) {
    motore = (async () => {
      const R = require('@resvg/resvg-wasm');
      await R.initWasm(fs.readFileSync(path.join(path.dirname(require.resolve('@resvg/resvg-wasm')), 'index_bg.wasm')));
      const fonts = FONT_FILE.map((f) => fs.readFileSync(path.join('C:\\Windows\\Fonts', f)));
      return { R, fonts };
    })().catch((e) => { motore = null; throw e; });
  }
  return motore;
}

// null se il genere non ha ancora sfondi
async function componi({ categoria, titolo, numero }, cartella = SFONDI) {
  if (!/^[\p{L}\p{N} _-]+$/u.test(String(categoria || ''))) throw new Error('categoria non valida');
  const dir = path.join(cartella, categoria);
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).sort() : [];
  if (!file.length) return null;
  const sfondo = file[(Math.abs(Math.trunc(Number(numero))) || 0) % file.length];
  const stile = stileCopertina(categoria);
  const { R, fonts } = await resvg();
  const svg = svgCopertina({ titolo: String(titolo || '').trim() || stile.etichetta, stile, sfondo: fs.readFileSync(path.join(dir, sfondo)) });
  const png = new R.Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Georgia' } }).render().asPng();
  const jpeg = execFileSync(FFMPEG, ['-loglevel', 'error', '-f', 'png_pipe', '-i', 'pipe:0', '-f', 'mjpeg', '-q:v', '3', 'pipe:1'], { input: Buffer.from(png), maxBuffer: 16 * 1024 * 1024, timeout: 60000 });
  return { jpeg, sfondo };
}

module.exports = { stileCopertina, svgCopertina, componi };
