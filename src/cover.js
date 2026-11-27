// ---- Copertine locali: PNG generato in JavaScript, colori e forma per genere ----
// Nessun servizio esterno. Il PNG usa blocchi deflate "stored" (non compressi): semplice e valido.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function hexRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Genera il PNG quadrato di dimensione size con una funzione colore(x, y) -> [r,g,b]
function makePng(size, colore) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filtro "nessuno"
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colore(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  // zlib con blocchi stored (max 65535 byte ciascuno)
  const blocchi = [];
  for (let off = 0; off < raw.length; off += 65535) {
    const fine = Math.min(raw.length, off + 65535);
    const dati = raw.subarray(off, fine);
    const ultimo = fine === raw.length ? 1 : 0;
    const h = Buffer.alloc(5);
    h[0] = ultimo;
    h.writeUInt16LE(dati.length, 1);
    h.writeUInt16LE(~dati.length & 0xffff, 3);
    blocchi.push(h, dati);
  }
  const ad = Buffer.alloc(4); ad.writeUInt32BE(adler32(raw));
  const zlib = Buffer.concat([Buffer.from([0x78, 0x01]), ...blocchi, ad]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Copertina astratta per genere: gradiente tra i due colori del genere, anelli e onda con il terzo colore.
// Il seme (numero del brano) varia la posizione degli anelli, cosi' ogni copertina e' diversa.
function coverPng(categoria, seme) {
  const cat = (CFG.categories || []).find((c) => c.name === categoria);
  const pal = (cat && cat.colori && cat.colori.length === 3) ? cat.colori : ['#1d3b4a', '#6fa8a0', '#f2d7a0'];
  const [c1, c2, c3] = pal.map(hexRgb);
  const size = 300;
  const cx = 60 + ((seme * 37) % 180), cy = 60 + ((seme * 53) % 180);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return makePng(size, (x, y) => {
    const base = mix(c1, c2, y / size);
    const d = Math.hypot(x - cx, y - cy);
    const anello = Math.abs(Math.sin(d / 18)) > 0.82;
    const onda = Math.abs(y - (size * 0.62 + Math.sin(x / 22) * 14)) < 5;
    if (onda) return mix(base, c3, 0.75);
    if (anello) return mix(base, c3, 0.35);
    return base;
  });
}

// Frame APIC (ID3v2.3): copertina anteriore in PNG
function apicFrame(png) {
  const payload = Buffer.concat([
    Buffer.from([0x00]), // testo ISO-8859-1
    Buffer.from('image/png', 'ascii'), Buffer.from([0x00]),
    Buffer.from([0x03]), // copertina anteriore
    Buffer.from([0x00]), // descrizione vuota
    png,
  ]);
  return frame('APIC', payload);
}
