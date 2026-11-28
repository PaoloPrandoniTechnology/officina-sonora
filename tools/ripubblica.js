// Ripubblica su iBroadcast i brani gia' online con tag vecchi, copertina provvisoria o copertina nuova
// (iBroadcast non permette di cambiare l'immagine di un brano: serve ricaricarlo).
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
    // "rimosso": eliminato per spazio, ricaricarlo vanificherebbe la rotazione
    if (!meta.ibroadcast || !meta.ibroadcast.track_id || meta.ibroadcast.rimosso) return false;
    const r = mappa[jsonPath];
    if (r && !r.cestinato) return true;
    return (meta.id3_versione || 0) < 2 || meta.copertina === 'provvisoria' || meta.copertina_online === false;
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

// --tutti solo dopo che il trasferimento delle stelle (API non ufficiale) ha funzionato fino in fondo
const provaSuperata = (mappa) => Object.values(mappa).some((r) => r.cestinato && r.voto_trasferito);

// Brano che non si puo' preparare: si salta senza fermare gli altri (nulla e' stato inviato)
class Saltato extends Error {}
async function perOgnuno(elementi, fn, saltati) {
  for (const x of elementi) {
    if (saltati.has(x)) continue;
    try { await fn(x); } catch (e) {
      if (!(e instanceof Saltato)) throw e;
      saltati.add(x);
      console.log('saltato: ' + e.message);
    }
  }
}

// Passi dopo l'organizzazione: voto, playlist e tag, cestino. Ogni passo si salva subito.
async function dopoOrganizzato(r, io) {
  if (!r.playlist_ok) {
    // tra caricamento e cestino passano ore: vale quello che l'utente ha fatto fino ad adesso
    const lib = await io.libreria();
    const prima = segnali(lib, r.vecchio);
    const gia = segnali(lib, r.nuovo);
    if (!r.voto_ok) {
      r.rating = prima.rating;
      // stelle diverse date sulla copia nuova: sono la scelta piu' recente e restano
      if (gia.rating > 0 && gia.rating !== prima.rating) r.voto_ok = true;
    }
    r.playlists = prima.playlists.filter((p) => !gia.playlists.includes(p));
    r.tags = prima.tags.filter((t) => !gia.tags.includes(t));
    io.salva();
  }
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
      r.voto_trasferito = true;
    } else if (passo === 'playlist') {
      for (const p of r.playlists || []) await io.api('appendplaylist', { playlist: p, tracks: [nuovo] });
      for (const t of r.tags || []) await io.api('tagtracks', { tagid: t, tracks: [nuovo], untag: false });
      // un voto dato solo con un tag torna con il tag: per il blocco 10 non deve sembrare nuovo
      if (!(r.rating > 0) && 'voto_ib' in r) { const meta = io.leggiScheda(); meta.voto_ib = r.voto_ib; io.scriviScheda(meta); }
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
  const m = await new AF('require', lib + '\nreturn { CFG, gw, ibApi, libraryTracks, copertinaPer, acquireLock, releaseLock, loadState, saveState, readJsonSafe, aggiornaScheda, scriviScheda, audioIntegro };')(require);
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
  if (modo === '--tutti' && !provaSuperata(mappa)) throw new Error('prima serve una --prova completata che includa un brano con stelle');
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
    if (!meta || !meta.ibroadcast) throw new Saltato(`${path.basename(b.jsonPath)}: scheda illeggibile`);
    let r = mappa[b.jsonPath];
    if (!r || r.cestinato) {
      const id = String(meta.ibroadcast.track_id);
      r = mappa[b.jsonPath] = { vecchio: id, ...segnali(await libreria(), id), voto_ib: meta.voto_ib ?? null, organizzato: false, voto_ok: false, playlist_ok: false, cestinato: false };
      salva();
    }
    // interrotto dopo il caricamento ma prima di salvare la mappa
    if (String(meta.ibroadcast.track_id) !== r.vecchio) { r.nuovo = String(meta.ibroadcast.track_id); return salva(); }
    const sfondi = path.join(DIR, 'assets', 'sfondi', meta.categoria);
    const quanti = fs.existsSync(sfondi) ? fs.readdirSync(sfondi).filter((f) => /^\d+\.jpg$/.test(f)).length : 0;
    if (quanti < 8) throw new Saltato(`${meta.categoria}: solo ${quanti} sfondi su 8 (node tools/genera-sfondi.js --genere ${meta.categoria})`);
    if (!(await m.copertinaPer(meta)).definitiva) throw new Error('il gateway non compone le copertine: riavviarlo');
    const audio = b.jsonPath.replace(/\.json$/, '.mp3');
    if (!fs.existsSync(audio)) throw new Saltato(`${meta.titolo}: file audio mancante`);
    if (!m.audioIntegro(fs.readFileSync(audio), meta.hash_audio)) throw new Saltato(`${meta.titolo}: l'audio non corrisponde all'impronta salvata, non caricato`);
    const stato = { ...m.loadState(), uploadQueue: [audio], ibroadcastScanned: true, retagScanned: true, uploadTries: {} };
    const pronto = await m.blocco('03d1-prepara-caricamento.js', { state: stato });
    if (!pronto.daCaricare.length) throw new Saltato(`${meta.titolo}: non preparato (duplicato o file mancante), vedere state\\tick.log`);
    if (m.readJsonSafe(b.jsonPath, {}).copertina !== 'ai') throw new Saltato(`${meta.titolo}: copertina provvisoria, non caricato`);
    // il blocco 3d4 non si usa: manderebbe un messaggio Telegram per ogni brano
    const esito = await m.blocco('03d2-carica-ibroadcast.js', pronto);
    const c = esito.caricati[0];
    if (!c || !/^\d+$/.test(c.trackId) || c.trackId === r.vecchio) throw new Error(`${meta.titolo}: caricamento non riuscito (${c ? c.trackId : 'nessun id'})`);
    // solo questi campi: un voto dato durante il caricamento resta
    m.aggiornaScheda(b.jsonPath, { id3_frames: c.nTags, ibroadcast_precedente: meta.ibroadcast, copertina_online: true,
      ibroadcast: { track_id: c.trackId, caricato_il: new Date().toISOString(), organizzato: false } });
    r.nuovo = c.trackId;
    salva();
    console.log(`caricato: ${meta.titolo} (${r.vecchio} -> ${r.nuovo})`);
  };

  let ultimoAvanzamento = Date.now();
  let restano = brani;
  const saltati = new Set();
  while (restano.length) {
    let organizzare = false;
    await perOgnuno(restano, (b) => conLock(async () => {
        let r = mappa[b.jsonPath];
        if (!r || r.cestinato || !r.nuovo) { await carica(b); r = mappa[b.jsonPath]; ultimoAvanzamento = Date.now(); }
        if (!r.organizzato) r.organizzato = !!m.readJsonSafe(b.jsonPath, {}).ibroadcast.organizzato;
        if (!r.organizzato) { organizzare = true; return; }
        await dopoOrganizzato(r, {
          api: (mode, args) => m.ibApi(null, mode, args), libreria, attendi, salva,
          leggiScheda: () => m.readJsonSafe(b.jsonPath, null),
          scriviScheda: (x) => m.scriviScheda(b.jsonPath, x),
        });
        ultimoAvanzamento = Date.now();
        console.log(`fatto: ${b.meta.titolo}`);
    }), saltati);
    restano = restano.filter((b) => !saltati.has(b) && !(mappa[b.jsonPath] || {}).cestinato);
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
  console.log(saltati.size ? `finito: ${saltati.size} brani saltati (motivi sopra), rilanciare dopo averli sistemati` : 'ripubblicazione completata');
}

module.exports = { daRipubblicare, prossimoPasso, segnali, dopoOrganizzato, provaSuperata, perOgnuno, Saltato };
if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
