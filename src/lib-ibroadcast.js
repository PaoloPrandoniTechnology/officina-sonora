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
  return h.toString(16) + '-' + (raw.length - i);
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

// "Do minore" -> "Cm" (formato TKEY); vuoto se non riconosciuta
function chiaveId3(tonalita) {
  const m = /^(do|re|mi|fa|sol|la|si)\s*(#|b|diesis|bemolle)?\s+(maggiore|minore)$/i.exec(String(tonalita || '').trim());
  if (!m) return '';
  const nota = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }[m[1].toLowerCase()];
  const alt = /^(#|diesis)$/i.test(m[2] || '') ? '#' : m[2] ? 'b' : '';
  return nota + alt + (m[3].toLowerCase() === 'minore' ? 'm' : '');
}
// Testo libero con nome (TXXX)
function userFrame(nome, value) {
  if (value === undefined || value === null || value === '') return null;
  return frame('TXXX', Buffer.concat([utf16(nome), Buffer.from([0, 0, 0xff, 0xfe]), Buffer.from(String(value), 'utf16le')]));
}

// Copertina del brano: composta dal gateway sullo sfondo del genere; se non si puo', quella disegnata qui.
async function copertinaPer(meta) {
  try {
    const r = await gw('/copertina', { categoria: meta.categoria, titolo: meta.titolo, numero: Number(meta.numero_traccia) || 0 });
    if (r.ok && r.jpeg) return { mime: 'image/jpeg', dati: Buffer.from(r.jpeg, 'base64'), definitiva: true };
  } catch (e) { /* gateway non raggiungibile: copertina provvisoria */ }
  return copertinaProvvisoria(meta);
}
function copertinaProvvisoria(meta) {
  return { mime: 'image/png', dati: coverPng(meta.categoria, Number(meta.numero_traccia) || 1), definitiva: false };
}

// Scrive i tag nel file: rimuove un eventuale header ID3 esistente e ne mette uno nuovo.
function tagFile(file, meta, cop = copertinaProvvisoria(meta)) {
  const raw = fs.readFileSync(file);
  let audio = raw;
  if (raw.length > 10 && raw.toString('ascii', 0, 3) === 'ID3') {
    const size = ((raw[6] & 0x7f) << 21) | ((raw[7] & 0x7f) << 14) | ((raw[8] & 0x7f) << 7) | (raw[9] & 0x7f);
    audio = raw.subarray(10 + size);
  }
  const data = new Date(meta.generato_il || Date.now());
  const due = (n) => String(n).padStart(2, '0');
  const cat = (CFG.categories || []).find((c) => c.name === meta.categoria) || {};
  const album = (cat.copertina && cat.copertina.etichetta) || String(meta.categoria || 'Raccolta').replace(/-/g, ' ');
  const durata = (meta.qualita && meta.qualita.durata_reale_s) || meta.durata_s;
  const editore = 'Yoga Music Factory';
  const comment = [meta.descrizione, meta.attivita && `Attività: ${meta.attivita}`, meta.style && `Stile: ${meta.style}`,
    meta.energia && `Energia: ${meta.energia}/5`, meta.struttura && `Struttura: ${meta.struttura}`, 'Strumentale, generato con YuE2']
    .filter(Boolean).join(' | ');
  const frames = [
    textFrame('TIT1', cat.famiglia),
    textFrame('TIT2', meta.titolo),
    textFrame('TIT3', meta.tipo),
    textFrame('TPE1', CFG.artista),
    textFrame('TPE2', CFG.artista),
    textFrame('TALB', album),
    textFrame('TCON', meta.genere || album),
    textFrame('TRCK', meta.numero_traccia),
    textFrame('TYER', String(data.getFullYear())),
    textFrame('TDAT', due(data.getDate()) + due(data.getMonth() + 1)),
    textFrame('TBPM', meta.bpm),
    textFrame('TKEY', chiaveId3(meta.tonalita)),
    textFrame('TLEN', durata ? Math.round(durata * 1000) : ''),
    textFrame('TLAN', 'zxx'),
    textFrame('TCOM', editore),
    textFrame('TPUB', editore),
    textFrame('TCOP', `${data.getFullYear()} ${editore}`),
    textFrame('TENC', editore),
    userFrame('MOOD', MOOD_BY_ENERGIA[meta.energia]),
    userFrame('ENERGIA', meta.energia),
    userFrame('ATTIVITA', meta.attivita),
    userFrame('STRUTTURA', meta.struttura),
    userFrame('STRUMENTI', [].concat(meta.strumenti || []).join(', ')),
    userFrame('VARIANTE', meta.variante),
    userFrame('SEED', meta.seed),
    commentFrame(comment),
    apicFrame(cop.dati, cop.mime),
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
