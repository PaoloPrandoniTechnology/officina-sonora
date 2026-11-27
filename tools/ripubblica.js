// Ripubblica su iBroadcast i brani gia' online con i nuovi tag e la copertina AI.
// Uso: node tools/ripubblica.js --prova a.json b.json c.json   |   node tools/ripubblica.js --tutti
// Per ogni brano: carica la copia nuova, attende tag e playlist, trasferisce stelle, playlist e tag
// dell'utente e solo alla fine cestina la vecchia. La mappa in state/ripubblica.json rende tutto riprendibile.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const MAPPA = path.join(DIR, 'state', 'ripubblica.json');
const NOSTRI = /^(yoga|musica|famiglia-|categoria-|energia-|struttura-|tipo-|Yoga - |Musica - )/i;

function prossimoPasso(r) {
  if (!r.nuovo) return 'carica';
  if (!/^\d+$/.test(String(r.nuovo)) || String(r.nuovo) === String(r.vecchio)) throw new Error(`id nuovo non valido (${r.nuovo}) per il brano ${r.vecchio}`);
  if (!r.organizzato) return 'attendi';
  if (r.rating > 0 && !r.voto_ok) return 'voto';
  if (!r.playlist_ok) return 'playlist';
  return r.cestinato ? 'fatto' : 'cestina';
}

function daRipubblicare(brani, mappa) {
  return brani.filter(({ jsonPath, meta }) => {
    if (!meta.ibroadcast || !meta.ibroadcast.track_id) return false;
    const r = mappa[jsonPath];
    if (r && !r.cestinato) return true;
    return (meta.id3_versione || 0) < 2 || meta.copertina === 'provvisoria';
  }).sort((a, b) => (a.meta.numero_traccia || 0) - (b.meta.numero_traccia || 0));
}

const righe = (tabella) => Object.entries(tabella || {}).filter(([k]) => k !== 'map')
  .map(([id, v]) => ({ id, ...Object.fromEntries(Object.entries(tabella.map).map(([k, i]) => [k, v[i]])) }));
const stelle = (lib, id) => Number((righe(lib.tracks).find((t) => t.id === String(id)) || {}).rating) || 0;

// Cosa ha fatto l'utente sul brano e va portato sulla copia nuova
function segnali(lib, id) {
  const suoi = (x) => !NOSTRI.test(x.name || '') && (x.tracks || []).map(String).includes(String(id));
  return {
    rating: stelle(lib, id),
    playlists: righe(lib.playlists).filter((p) => !p.system_created && !p.type && suoi(p)).map((p) => Number(p.id)),
    tags: righe(lib.tags).filter(suoi).map((t) => Number(t.id)),
  };
}

// Passi dopo l'organizzazione: voto, playlist e tag, cestino. Ogni passo si salva subito.
async function dopoOrganizzato(r, io) {
  for (let passo = prossimoPasso(r); passo !== 'fatto'; passo = prossimoPasso(r)) {
    const nuovo = Number(r.nuovo);
    if (passo === 'voto') {
      await io.api('ratetrack', { track_id: nuovo, rating: r.rating });
      let letto = stelle(await io.libreria(), nuovo);
      for (let i = 0; i < 3 && letto !== r.rating; i++) {
        if (io.attendi) await io.attendi(5000);
        letto = stelle(await io.libreria(), nuovo);
      }
      if (letto !== r.rating) throw new Error(`valutazione non confermata sul brano ${nuovo} (attesa ${r.rating}, letta ${letto}): il vecchio brano resta`);
      // per il blocco dei voti questo non e' un segnale nuovo
      const meta = io.leggiScheda();
      meta.voto_ib = r.rating;
      io.scriviScheda(meta);
      r.voto_ok = true;
    } else if (passo === 'playlist') {
      for (const p of r.playlists || []) await io.api('appendplaylist', { playlist: p, tracks: [nuovo] });
      for (const t of r.tags || []) await io.api('tagtracks', { tagid: t, tracks: [nuovo], untag: false });
      r.playlist_ok = true;
    } else if (passo === 'cestina') {
      await io.api('trash', { tracks: [Number(r.vecchio)] });
      r.cestinato = true;
    } else throw new Error('passo inatteso: ' + passo);
    io.salva();
  }
}

// Carica lib e blocchi del workflow: solo quando serve davvero (hanno effetti globali)
async function motore() {
  const src = (f) => fs.readFileSync(path.join(DIR, 'src', f), 'utf8');
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const lib = src('lib.js') + '\n' + src('lib-apprendimento.js') + '\n' + src('lib-messaggi.js') + '\n' + src('lib-ibroadcast.js') + '\n' + src('cover.js');
  const m = await new AF('require', lib + '\nreturn { CFG, gw, ibApi, libraryTracks, copertinaPer, acquireLock, releaseLock, loadState, saveState, readJsonSafe };')(require);
  m.blocco = async (nome, json) => (await new AF('require', '$input', '$env', lib + '\n' + src(path.join('blocks', nome)))(require, { first: () => ({ json }) }, {}))[0].json;
  return m;
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [modo, ...file] = process.argv.slice(2);
  if (!(modo === '--tutti' || (modo === '--prova' && file.length))) throw new Error('uso: --prova a.json b.json c.json | --tutti');
  const m = await motore();
  const mappa = m.readJsonSafe(MAPPA, {});
  const salva = () => { fs.writeFileSync(MAPPA + '.tmp', JSON.stringify(mappa, null, 2)); fs.renameSync(MAPPA + '.tmp', MAPPA); };
  let brani = daRipubblicare(m.libraryTracks(), mappa);
  if (modo === '--prova') {
    const scelti = file.map((f) => path.resolve(f).toLowerCase());
    brani = brani.filter((b) => scelti.includes(b.jsonPath.toLowerCase()));
    if (brani.length !== file.length) throw new Error(`trovati ${brani.length} brani da ripubblicare su ${file.length} indicati`);
  }
  console.log(`brani da ripubblicare: ${brani.length}`);

  const libreria = async () => {
    const r = await m.gw('/ib/library', {});
    if (!r.json || !r.json.library) throw new Error('libreria iBroadcast non leggibile (HTTP ' + r.status + ')');
    return r.json.library;
  };
  // Un passo alla volta con il lock della pipeline, cosi' non si sovrappone al workflow
  const conLock = async (fn) => {
    let token;
    while (!(token = m.acquireLock('pipeline'))) await attendi(15000);
    try { return await fn(); } finally { m.releaseLock('pipeline', token); }
  };

  const carica = async (b) => {
    const meta = m.readJsonSafe(b.jsonPath, null);
    let r = mappa[b.jsonPath];
    if (!r || r.cestinato) {
      const id = String(meta.ibroadcast.track_id);
      r = mappa[b.jsonPath] = { vecchio: id, ...segnali(await libreria(), id), organizzato: false, voto_ok: false, playlist_ok: false, cestinato: false };
      salva();
    }
    // interrotto dopo il caricamento ma prima di salvare la mappa
    if (String(meta.ibroadcast.track_id) !== r.vecchio) { r.nuovo = String(meta.ibroadcast.track_id); return salva(); }
    const sfondi = path.join(DIR, 'assets', 'sfondi', meta.categoria);
    const quanti = fs.existsSync(sfondi) ? fs.readdirSync(sfondi).filter((f) => /^\d+\.jpg$/.test(f)).length : 0;
    if (quanti < 8) throw new Error(`${meta.categoria}: solo ${quanti} sfondi su 8 (node tools/genera-sfondi.js --genere ${meta.categoria})`);
    if (!(await m.copertinaPer(meta)).definitiva) throw new Error('il gateway non compone le copertine: riavviarlo');
    const audio = b.jsonPath.replace(/\.json$/, '.mp3');
    const stato = { ...m.loadState(), uploadQueue: [audio], ibroadcastScanned: true, retagScanned: true, uploadTries: {} };
    const pronto = await m.blocco('03d1-prepara-caricamento.js', { state: stato });
    if (!pronto.daCaricare.length) throw new Error(`${meta.titolo}: non preparato (duplicato o file mancante), vedere state\\tick.log`);
    if (m.readJsonSafe(b.jsonPath, {}).copertina !== 'ai') throw new Error(`${meta.titolo}: copertina provvisoria, non caricato`);
    // il blocco 3d4 non si usa: manderebbe un messaggio Telegram per ogni brano
    const esito = await m.blocco('03d2-carica-ibroadcast.js', pronto);
    const c = esito.caricati[0];
    if (!c || !/^\d+$/.test(c.trackId) || c.trackId === r.vecchio) throw new Error(`${meta.titolo}: caricamento non riuscito (${c ? c.trackId : 'nessun id'})`);
    const ora = m.readJsonSafe(b.jsonPath, null);
    ora.id3_frames = c.nTags;
    ora.ibroadcast_precedente = ora.ibroadcast;
    ora.ibroadcast = { track_id: c.trackId, caricato_il: new Date().toISOString(), organizzato: false };
    fs.writeFileSync(b.jsonPath, JSON.stringify(ora, null, 2));
    r.nuovo = c.trackId;
    salva();
    console.log(`caricato: ${meta.titolo} (${r.vecchio} -> ${r.nuovo})`);
  };

  let ultimoAvanzamento = Date.now();
  let restano = brani;
  while (restano.length) {
    let organizzare = false;
    for (const b of restano) {
      await conLock(async () => {
        let r = mappa[b.jsonPath];
        if (!r || r.cestinato || !r.nuovo) { await carica(b); r = mappa[b.jsonPath]; ultimoAvanzamento = Date.now(); }
        if (!r.organizzato) r.organizzato = !!m.readJsonSafe(b.jsonPath, {}).ibroadcast.organizzato;
        if (!r.organizzato) { organizzare = true; return; }
        await dopoOrganizzato(r, {
          api: (mode, args) => m.ibApi(null, mode, args), libreria, attendi, salva,
          leggiScheda: () => m.readJsonSafe(b.jsonPath, null),
          scriviScheda: (x) => fs.writeFileSync(b.jsonPath, JSON.stringify(x, null, 2)),
        });
        ultimoAvanzamento = Date.now();
        console.log(`fatto: ${b.meta.titolo}`);
      });
    }
    restano = restano.filter((b) => !(mappa[b.jsonPath] || {}).cestinato);
    if (!restano.length) break;
    if (Date.now() - ultimoAvanzamento > 45 * 60000) throw new Error(`fermo da 45 minuti, restano ${restano.length} brani: rilanciare piu tardi`);
    if (organizzare) {
      await attendi(60000);
      await conLock(async () => {
        const esito = await m.blocco('03d3-recupero-tag.js', { state: m.loadState() });
        m.saveState(esito.state);
      });
    }
  }
  console.log('ripubblicazione completata');
}

module.exports = { daRipubblicare, prossimoPasso, segnali, dopoOrganizzato };
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
