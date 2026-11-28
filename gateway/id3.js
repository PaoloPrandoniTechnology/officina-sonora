// Copertina incorporata in un MP3 (frame APIC di un tag ID3v2.3, quello scritto dal blocco 3d1).
// Si legge solo il tag in testa al file, non l'audio.
const fs = require('fs');

const MAX_TAG = 8 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png']);

function apic(tag) {
  for (let i = 0; i + 10 <= tag.length;) {
    const id = tag.toString('latin1', i, i + 4);
    const n = tag.readUInt32BE(i + 4);
    if (!/^[A-Z0-9]{4}$/.test(id) || !n || i + 10 + n > tag.length) return null; // riempimento o tag rovinato
    if (id === 'APIC') {
      const c = tag.subarray(i + 10, i + 10 + n);
      const fineMime = c.indexOf(0, 1);
      if (fineMime < 0) return null;
      const mime = c.toString('latin1', 1, fineMime);
      // dopo il tipo di immagine c'è la descrizione: terminatore di uno o due byte secondo la codifica
      let j = fineMime + 2;
      if (c[0] === 1 || c[0] === 2) { while (j + 1 < c.length && (c[j] || c[j + 1])) j += 2; j += 2; } else { while (j < c.length && c[j]) j++; j += 1; }
      return MIME.has(mime) && j < c.length ? { mime, dati: c.subarray(j) } : null;
    }
    i += 10 + n;
  }
  return null;
}

function copertinaDi(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const h = Buffer.alloc(10);
    if (fs.readSync(fd, h, 0, 10, 0) < 10 || h.toString('latin1', 0, 3) !== 'ID3' || h[3] !== 3) return null;
    const n = ((h[6] & 0x7f) << 21) | ((h[7] & 0x7f) << 14) | ((h[8] & 0x7f) << 7) | (h[9] & 0x7f);
    if (!n || n > MAX_TAG) return null;
    const tag = Buffer.alloc(n);
    fs.readSync(fd, tag, 0, n, 10);
    return apic(tag);
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { copertinaDi };
