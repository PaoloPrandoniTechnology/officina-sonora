// ---- Libreria iBroadcast: incollata nei nodi di caricamento (non in tutti i blocchi) ----
// Impronta FNV-1a dell'audio (senza l'header ID3): identifica i duplicati
function fnvAudio(raw) {
  let i = 0;
  if (raw.length > 10 && raw.toString('ascii', 0, 3) === 'ID3') {
    const size = ((raw[6] & 0x7f) << 21) | ((raw[7] & 0x7f) << 14) | ((raw[8] & 0x7f) << 7) | (raw[9] & 0x7f);
    i = 10 + size;
  }
  let h = 0x811c9dc5;
  for (let k = i; k < raw.length; k++) h = Math.imul(h ^ raw[k], 0x01000193) >>> 0;
  return h.toString(16) + '-' + raw.length;
}

// ---- Tag ID3v2.3 completi, scritti nel file prima del caricamento ----
function syncsafe(n) {
  return Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
}
function frame(id, payload) {
  const head = Buffer.alloc(10);
  head.write(id, 0, 'ascii');
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
}
// Testo UTF-16 con BOM (encoding 0x01 di ID3v2.3)
function utf16(s) {
  return Buffer.concat([Buffer.from([0x01, 0xff, 0xfe]), Buffer.from(String(s), 'utf16le')]);
}
function textFrame(id, value) {
  if (value === undefined || value === null || value === '') return null;
  return frame(id, utf16(value));
}
function commentFrame(text) {
  if (!text) return null;
  // encoding 0x01, lingua 'ita', descrizione vuota (BOM + terminatore), testo (BOM + UTF-16)
  const payload = Buffer.concat([Buffer.from([0x01]), Buffer.from('ita', 'ascii'), Buffer.from([0xff, 0xfe, 0x00, 0x00]), Buffer.from([0xff, 0xfe]), Buffer.from(String(text), 'utf16le')]);
  return frame('COMM', payload);
}

// Scrive i tag nel file: rimuove un eventuale header ID3 esistente e ne mette uno nuovo.
function tagFile(file, meta) {
  const raw = fs.readFileSync(file);
  let audio = raw;
  if (raw.length > 10 && raw.toString('ascii', 0, 3) === 'ID3') {
    const size = ((raw[6] & 0x7f) << 21) | ((raw[7] & 0x7f) << 14) | ((raw[8] & 0x7f) << 7) | (raw[9] & 0x7f);
    audio = raw.subarray(10 + size);
  }
  const year = String(new Date(meta.generato_il || Date.now()).getFullYear());
  const album = meta.categoria || 'Raccolta';
  const comment = [meta.descrizione, meta.attivita && `Attivita': ${meta.attivita}`, meta.style && `Stile: ${meta.style}`,
    meta.energia && `Energia: ${meta.energia}/5`, meta.struttura && `Struttura: ${meta.struttura}`, 'Strumentale, generato con YuE2']
    .filter(Boolean).join(' | ');
  const frames = [
    textFrame('TIT2', meta.titolo),
    textFrame('TPE1', CFG.artista),
    textFrame('TPE2', CFG.artista),
    textFrame('TALB', album),
    textFrame('TCON', meta.genere || meta.categoria),
    textFrame('TRCK', meta.numero_traccia),
    textFrame('TIT3', meta.tipo),
    textFrame('TBPM', meta.bpm),
    textFrame('TKEY', meta.tonalita),
    textFrame('TYER', year),
    textFrame('TENC', 'Yoga Music Factory'),
    commentFrame(comment),
    apicFrame(coverPng(meta.categoria, Number(meta.numero_traccia) || 1)),
  ].filter(Boolean);
  const body = Buffer.concat(frames);
  const header = Buffer.concat([Buffer.from('ID3'), Buffer.from([0x03, 0x00, 0x00]), syncsafe(body.length)]);
  fs.writeFileSync(file, Buffer.concat([header, body, audio]));
  return frames.length;
}

// Ambito del brano (yoga o musica), dal catalogo
function ambitoDi(meta) {
  const c = (CFG.categories || []).find((x) => x.name === meta.categoria);
  return (c && c.ambito) || 'yoga';
}

// Chiamata all'API iBroadcast tramite il gateway locale (il token resta li')
async function ibApi(access, mode, args) {
  const r = await gw('/ib/api', { mode, args });
  if (r.ok === false && r.error) throw new Error(mode + ': ' + r.error);
  const j = r.json || {};
  if (j.result === false || r.status !== 200) throw new Error(mode + ' non accettato (HTTP ' + r.status + ')');
  return j;
}

// Tag iBroadcast: creati una volta sola e riusati (id in state.tags)
async function tagId(access, state, name) {
  state.tags = state.tags || {};
  if (!state.tags[name]) state.tags[name] = (await ibApi(access, 'createtag', { tagname: name })).id;
  return state.tags[name];
}

// Playlist per categoria, con mood coerente con l'energia (Chill, Relaxed, Dance, Workout)
const MOOD_BY_ENERGIA = { 1: 'Chill', 2: 'Relaxed', 3: 'Relaxed', 4: 'Dance', 5: 'Workout' };
async function playlistId(access, state, meta) {
  state.playlists = state.playlists || {};
  if (!state.playlists[meta.categoria]) {
    const r = await ibApi(access, 'createplaylist', {
      name: `${ambitoDi(meta) === 'musica' ? 'Musica' : 'Yoga'} - ${meta.categoria}`,
      description: meta.attivita || meta.categoria,
      make_public: false,
      mood: MOOD_BY_ENERGIA[meta.energia] || '',
    });
    state.playlists[meta.categoria] = r.playlist_id;
  }
  return state.playlists[meta.categoria];
}

// Applica tag e inserisce il brano nella playlist della sua categoria
async function organizza(access, meta, trackId, state) {
  const tid = Number(trackId);
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const extra = (CFG.tag_extra && CFG.tag_extra[meta.categoria]) || [];
  const fam = ((CFG.categories || []).find((x) => x.name === meta.categoria) || {}).famiglia;
  const names = [ambitoDi(meta), fam ? `famiglia-${slug(fam)}` : null, `categoria-${slug(meta.categoria)}`, `energia-${meta.energia}`, `struttura-${slug(meta.struttura)}`, `tipo-${slug(meta.tipo)}`, ...extra.map(slug)].filter((n) => n && !n.endsWith('-undefined'));
  for (const n of names) {
    const id = await tagId(access, state, n);
    await ibApi(access, 'tagtracks', { tagid: id, tracks: [tid], untag: false });
  }
  const pid = await playlistId(access, state, meta);
  await ibApi(access, 'appendplaylist', { playlist: pid, tracks: [tid] });
}

async function upload(access, file) {
  const r = await gwUpload(path.basename(file), fs.readFileSync(file));
  const j = r.json || {};
  if (j.result === false) throw new Error('upload non accettato (HTTP ' + r.status + '): ' + (j.message || ''));
  const match = /\((.*)\) uploaded successfully/.exec(j.message || '');
  return match ? match[1] : 'ok';
}
