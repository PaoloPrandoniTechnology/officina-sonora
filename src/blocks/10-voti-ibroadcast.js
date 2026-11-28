// BLOCCO 10 - Voti da iBroadcast: legge la libreria (via gateway) ogni 10 minuti, libera spazio quando
// si avvicina ai 5 GB e converte i segnali che tu gia' dai nell'app in voti:
//  - valutazione a stelle (rating 1-5)  -> voto diretto
//  - tag utente (preferito, scarta, voto-N) -> voto
//  - playlist utente (preferiti, scartati) -> voto
//  - brano nel cestino -> voto 1 (se non c'e' un segnale migliore)
// Gli ascolti (plays) vengono solo registrati come dato.
const CADENZA_MS = 10 * 60 * 1000;
const VOTI_FILE = path.join(CFG.dir, 'state', 'voti-ibroadcast.json');
const ultimo = readJsonSafe(VOTI_FILE, { lastRun: 0 });
if (Date.now() - ultimo.lastRun < CADENZA_MS) return [{ json: { voti: 'non ancora' } }];
// Non scrive guidance.json mentre la pipeline e' in corso: riprova al giro successivo
if (lockOccupato('pipeline')) return [{ json: { voti: 'pipeline occupata' } }];

function decodifica(d) {
  if (!d || !d.map) return d || {};
  const out = {};
  for (const [id, riga] of Object.entries(d)) {
    if (id === 'map') continue;
    const o = {};
    for (const [k, i] of Object.entries(d.map)) o[k] = riga[i];
    out[id] = o;
  }
  return out;
}

let lib;
try {
  const r = await gw('/ib/library', {});
  lib = (r.json && r.json.library) ? r.json.library : null;
  if (!lib) throw new Error('risposta libreria vuota (HTTP ' + r.status + ')');
} catch (e) {
  log('voti iBroadcast: lettura libreria non riuscita: ' + e.message);
  return [{ json: { voti: 'errore' } }];
}

const tracce = decodifica(lib.tracks);
const playlist = Object.values(decodifica(lib.playlists));
const tag = Object.values(decodifica(lib.tags));

// Valori dai tag e dalle playlist dell'utente (non quelli creati dal sistema)
const mai = (nome) => nostroNome(nome) || /^(Recently|Most Recent)/i.test(nome || '');
// Parole di voto e di tempo: dalla tassonomia del catalogo, valide per ogni genere
const TASS = CFG.tassonomia || { voto: { preferito: 'preferit|fav|like|top|ok', scartato: 'scart|skip|brutt|no$|delete' }, tempo: { 'piu-veloce': 'piu.?veloce', 'piu-lento': 'piu.?lento' }, passoBpm: 6, limiteBpm: 15 };
const PREF = new RegExp(TASS.voto.preferito, 'i');
const SCART = new RegExp(TASS.voto.scartato, 'i');
const VELOCE = new RegExp(TASS.tempo['piu-veloce'], 'i');
const LENTO = new RegExp(TASS.tempo['piu-lento'], 'i');
const fonteVoto = {}; // track id -> { voto, fonte }
const tempoPerTraccia = {}; // track id -> +1 (piu' veloce) | -1 (piu' lento)

for (const p of playlist) {
  if (mai(p.name)) continue;
  for (const id of (p.tracks || [])) {
    if (PREF.test(p.name)) fonteVoto[String(id)] = { voto: 5, fonte: 'playlist ' + p.name };
    else if (SCART.test(p.name)) fonteVoto[String(id)] = { voto: 1, fonte: 'playlist ' + p.name };
  }
}
for (const t of tag) {
  if (mai(t.name)) continue;
  const m = /^voto-([1-5])$/i.exec(t.name || '');
  for (const id of (t.tracks || [])) {
    if (m) fonteVoto[String(id)] = { voto: Number(m[1]), fonte: 'tag ' + t.name };
    else if (PREF.test(t.name)) fonteVoto[String(id)] = { voto: 5, fonte: 'tag ' + t.name };
    else if (SCART.test(t.name)) fonteVoto[String(id)] = { voto: 1, fonte: 'tag ' + t.name };
    // tag di tempo: indicano che il ritmo del genere va alzato o abbassato
    if (VELOCE.test(t.name)) tempoPerTraccia[String(id)] = 1;
    else if (LENTO.test(t.name)) tempoPerTraccia[String(id)] = -1;
  }
}

// Brani della libreria: i nostri (con track_id) confrontati con i segnali
const nostri = [];
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n);
    if (n === '_scartati') continue;
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (n.endsWith('.json') && n !== 'feedback.json') {
      const m = readJsonSafe(f, null);
      if (m && m.titolo && m.ibroadcast && m.ibroadcast.track_id) nostri.push({ json: f, meta: m, id: String(m.ibroadcast.track_id) });
    }
  }
})(CFG.root);

let aggiornati = 0;
let ascoltiTot = 0;
for (const b of nostri) {
  const t = tracce[b.id];
  if (!t) continue;
  const ascolti = Number(t.plays) || 0;
  ascoltiTot += ascolti;
  let voto = null, fonte = null;
  if (Number(t.rating) >= 1) { voto = Math.min(5, Math.round(Number(t.rating))); fonte = 'valutazione iBroadcast'; }
  else if (fonteVoto[b.id]) { voto = fonteVoto[b.id].voto; fonte = fonteVoto[b.id].fonte; }
  else if (t.trashed && !b.meta.ibroadcast.rimosso) { voto = 1; fonte = 'cestino iBroadcast'; }

  // Tag di tempo: sposta il bpm del genere di un passo, una sola volta per brano, entro i limiti
  const dir = tempoPerTraccia[b.id];
  const giaApplicati = ultimo.tempoApplicati || [];
  if (dir && !giaApplicati.includes(b.id)) {
    const c = (CFG.categories || []).find((x) => x.name === b.meta.categoria);
    if (c) {
      const g = readGuidance();
      const attuale = (g.bpm_range || {})[c.name] ? g.bpm_range[c.name].split('-').map(Number) : c.bpm.slice();
      const minimo = c.bpm[0] - TASS.limiteBpm, massimo = c.bpm[1] + TASS.limiteBpm;
      const lo = Math.max(minimo, Math.min(massimo, attuale[0] + dir * TASS.passoBpm));
      const hi = Math.max(minimo, Math.min(massimo, attuale[1] + dir * TASS.passoBpm));
      if (lo < hi) {
        const prossima = { ...g, versione: g.versione + 1, aggiornato: new Date().toISOString(), bpm_range: { ...(g.bpm_range || {}), [c.name]: `${lo}-${hi}` }, note: `bpm di ${c.name} ${dir > 0 ? 'alzato' : 'abbassato'} da un tag di tempo` };
        scriviGuida(prossima, g);
        log(`voti iBroadcast: tempo di ${c.name} ${dir > 0 ? 'alzato' : 'abbassato'} a ${lo}-${hi} bpm (versione ${prossima.versione})`);
      }
    }
    giaApplicati.push(b.id);
    ultimo.tempoApplicati = giaApplicati.slice(-500);
  }
  const segnale = voto === null ? null : { voto, fonte };
  // La scheda si rilegge subito prima di scriverla: un voto arrivato nel frattempo resta
  const meta = readJsonSafe(b.json, null);
  if (!meta || !meta.ibroadcast) continue;
  meta.ascolti = ascolti;
  meta.ibroadcast.ascolti = ascolti;
  const cambiato = applicaSegnale(meta, segnale, new Date().toISOString());
  try {
    scriviScheda(b.json, meta);
    if (cambiato) aggiornati++;
  } catch (e) {
    log(`voti iBroadcast: scheda di ${meta.titolo} non aggiornata: ${e.message}`);
  }
}
// Spazio: dopo aver registrato i voti si eliminano da iBroadcast i brani di troppo. I file sul PC restano.
// Il segno "rimosso" si scrive prima di cestinare: così il brano non diventa un voto 1 né viene ricaricato.
const via = daRimuovere(tracce, nostri.map((b) => ({ id: b.id, meta: readJsonSafe(b.json, b.meta) })), CFG.spazioIb.soglia, CFG.spazioIb.obiettivo);
if (via.length) {
  const segnati = [];
  const chiedi = async (mode, ids) => {
    const r = await gw('/ib/api', { mode, args: { tracks: ids.map(Number) } });
    if (r.status !== 200 || !r.json || r.json.result === false) throw new Error(`${mode} non accettato (HTTP ${r.status}) ${r.error || (r.json && r.json.message) || ''}`);
  };
  try {
    for (const b of nostri.filter((x) => via.includes(x.id))) {
      const meta = readJsonSafe(b.json, null);
      if (!meta || !meta.ibroadcast || meta.ibroadcast.rimosso) continue;
      meta.ibroadcast.rimosso = new Date().toISOString();
      scriviScheda(b.json, meta);
      segnati.push(b);
    }
    const daCestinare = via.filter((id) => !tracce[id].trashed);
    if (daCestinare.length) {
      try { await chiedi('trash', daCestinare); } catch (e) {
        for (const b of segnati.filter((x) => daCestinare.includes(x.id))) {
          const meta = readJsonSafe(b.json, null);
          delete meta.ibroadcast.rimosso;
          scriviScheda(b.json, meta);
        }
        throw e;
      }
    }
    // se lo svuotamento fallisce i brani restano nel cestino e al giro successivo sono i primi della lista
    await chiedi('empty_trash', via);
    log(`spazio iBroadcast: eliminati ${via.length} brani (restano sul PC). Per liberare del tutto la quota controlla "Unavailable Files" nel Track Dashboard`);
  } catch (e) {
    log('spazio iBroadcast: eliminazione non riuscita: ' + e.message);
  }
}
fs.writeFileSync(VOTI_FILE,JSON.stringify({ lastRun: Date.now(), tempoApplicati: ultimo.tempoApplicati || [], ultimoEsito: { aggiornati, ascoltiTot } }, null, 2));
if (aggiornati) log(`voti iBroadcast: ${aggiornati} brani aggiornati dai segnali dell'app`);
return [{ json: { voti: 'ok', aggiornati, ascoltiTot } }];
