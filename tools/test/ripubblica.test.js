// Test della ripubblicazione su iBroadcast: nessuna chiamata di rete, la libreria remota e' finta.
// Esecuzione: node --test tools/test/ripubblica.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { daRipubblicare, prossimoPasso, segnali, dopoOrganizzato, provaSuperata, perOgnuno, Saltato } = require(path.join(__dirname, '..', 'ripubblica.js'));

const base = { vecchio: '1', nuovo: '2', organizzato: true, rating: 4, voto_ok: false, playlist_ok: false, cestinato: false };

test('prossimoPasso: ordine obbligato, si cestina solo alla fine', () => {
  assert.equal(prossimoPasso({ vecchio: '1' }), 'carica');
  assert.equal(prossimoPasso({ ...base, organizzato: false }), 'attendi');
  assert.equal(prossimoPasso(base), 'voto');
  assert.equal(prossimoPasso({ ...base, voto_ok: true }), 'playlist');
  assert.equal(prossimoPasso({ ...base, voto_ok: true, playlist_ok: true }), 'cestina');
  assert.equal(prossimoPasso({ ...base, rating: 0 }), 'playlist');
  assert.equal(prossimoPasso({ ...base, voto_ok: true, playlist_ok: true, cestinato: true }), 'fatto');
});

test('prossimoPasso: un id nuovo non valido o uguale al vecchio non porta mai a cestinare', () => {
  const pronto = { ...base, voto_ok: true, playlist_ok: true };
  for (const nuovo of ['ok', '1']) assert.throws(() => prossimoPasso({ ...pronto, nuovo }), /id/);
});

test('daRipubblicare: vecchi, provvisori e cambi a meta, in ordine di numero', () => {
  const b = (n, meta) => ({ jsonPath: `${n}.json`, meta: { numero_traccia: n, ibroadcast: { track_id: String(n) }, ...meta } });
  const aggiornato = { id3_versione: 2, copertina: 'ai' };
  const brani = [b(5, {}), b(2, { id3_versione: 2, copertina: 'provvisoria' }), b(3, aggiornato), b(4, aggiornato), b(1, aggiornato),
    { jsonPath: '9.json', meta: { numero_traccia: 9 } }];
  const mappa = { '4.json': { ...base, cestinato: false }, '1.json': { ...base, cestinato: true } };
  assert.deepEqual(daRipubblicare(brani, mappa).map((x) => x.meta.numero_traccia), [2, 4, 5]);
});

test('segnali: stelle, playlist e tag dell utente; ignorati quelli di sistema e i nostri', () => {
  const lib = {
    tracks: { map: { rating: 0 }, 1: [4] },
    playlists: { map: { name: 0, tracks: 1, system_created: 2, type: 3 },
      10: ['La mia serata', [1], false, null], 11: ['Yoga - Meditazione', [1], false, null], 12: ['Musica - Metal', [1], false, null],
      13: ['Thumbs Up', [1], false, 'thumbsup'], 14: ['Recently Played', [1], true, null], 15: ['Altra', [7], false, null] },
    tags: { map: { name: 0, tracks: 1 }, 20: ['preferito', [1]], 21: ['categoria-meditazione', [1]], 22: ['yoga', [1]] },
  };
  assert.deepEqual(segnali(lib, '1'), { rating: 4, playlists: [10], tags: [20] });
});

// brano 1 = vecchio, 2 = nuovo; ratetrack cambia il nuovo solo se l'API "funziona"
function finta({ vecchio = 4, nuovo = 0, funziona = true, playlist = { 10: ['Serata', [1], false, null] }, tag = { 20: ['preferito', [1]] } } = {}) {
  const chiamate = [];
  const meta = { titolo: 'x', voto: 5, voto_ib: null };
  const stato = { 1: vecchio, 2: nuovo };
  return { chiamate, meta, io: {
    api: async (mode, args) => { chiamate.push([mode, args]); if (mode === 'ratetrack' && funziona) stato[2] = args.rating; },
    libreria: async () => ({ tracks: { map: { rating: 0 }, 1: [stato[1]], 2: [stato[2]] },
      playlists: { map: { name: 0, tracks: 1, system_created: 2, type: 3 }, ...playlist }, tags: { map: { name: 0, tracks: 1 }, ...tag } }),
    leggiScheda: () => meta, scriviScheda: () => {}, salva: () => {},
  } };
}

test('voto trasferito e confermato, poi playlist, tag e cestino', async () => {
  const f = finta();
  const riga = { ...base, playlists: [10], tags: [20] };
  await dopoOrganizzato(riga, f.io);
  assert.deepEqual(f.chiamate.map((c) => c[0]), ['ratetrack', 'appendplaylist', 'tagtracks', 'trash']);
  assert.deepEqual(f.chiamate[0][1], { track_id: 2, rating: 4 });
  assert.deepEqual(f.chiamate[3][1], { tracks: [1] });
  assert.equal(riga.cestinato, true);
  assert.equal(riga.voto_trasferito, true);
  assert.equal(f.meta.voto, 5, 'il voto locale non si tocca');
  assert.equal(f.meta.voto_ib, 4, 'il voto trasferito non deve sembrare nuovo');
});

test('voto dato solo con un tag: dopo il trasferimento voto_ib torna quello di prima', async () => {
  const f = finta({ vecchio: 0 });
  const riga = { ...base, rating: 0, voto_ib: 3, playlists: [], tags: [20] };
  await dopoOrganizzato(riga, f.io);
  assert.equal(f.meta.voto_ib, 3);
  assert.equal(f.meta.voto, 5);
  assert.ok(!f.chiamate.some((c) => c[0] === 'ratetrack'));
});

test('stelle e playlist cambiate dopo il caricamento: vale la situazione di adesso', async () => {
  const f = finta({ vecchio: 2, playlist: { 10: ['Serata', [1], false, null], 30: ['Nuova', [1, 2], false, null], 40: ['Aggiunta', [1], false, null] }, tag: {} });
  const riga = { ...base, rating: 0, playlists: [10], tags: [20] };
  await dopoOrganizzato(riga, f.io);
  assert.deepEqual(f.chiamate[0], ['ratetrack', { track_id: 2, rating: 2 }]);
  assert.deepEqual(f.chiamate.filter((c) => c[0] === 'appendplaylist').map((c) => c[1].playlist), [10, 40], 'niente doppioni dove il nuovo c e gia');
  assert.ok(!f.chiamate.some((c) => c[0] === 'tagtracks'), 'il tag tolto non torna');
});

test('stelle date sulla copia nuova: non si sovrascrivono e restano un segnale nuovo', async () => {
  const f = finta({ vecchio: 2, nuovo: 5 });
  const riga = { ...base, rating: 2, playlists: [], tags: [] };
  await dopoOrganizzato(riga, f.io);
  assert.ok(!f.chiamate.some((c) => c[0] === 'ratetrack'));
  assert.equal(f.meta.voto_ib, null);
  assert.equal(riga.cestinato, true);
});

test('voto non confermato: ci si ferma e il vecchio brano non si cestina', async () => {
  const f = finta({ funziona: false });
  const riga = { ...base, playlists: [], tags: [] };
  await assert.rejects(() => dopoOrganizzato(riga, f.io), /valutazione/);
  assert.ok(!f.chiamate.some((c) => c[0] === 'trash'));
  assert.equal(riga.cestinato, false);
});

test('--tutti solo dopo un brano votato trasferito e completato', () => {
  assert.equal(provaSuperata({}), false);
  assert.equal(provaSuperata({ a: { cestinato: true, rating: 0 } }), false);
  assert.equal(provaSuperata({ a: { cestinato: false, voto_trasferito: true } }), false);
  assert.equal(provaSuperata({ a: { cestinato: true, voto_trasferito: true } }), true);
});

test('un brano che non si puo preparare si salta; un errore vero ferma tutto', async () => {
  const visti = [];
  const saltati = new Set();
  await perOgnuno([1, 2, 3], async (x) => { if (x === 2) throw new Saltato('sfondi mancanti'); visti.push(x); }, saltati);
  assert.deepEqual(visti, [1, 3]);
  assert.deepEqual([...saltati], [2]);
  await assert.rejects(() => perOgnuno([1], async () => { throw new Error('valutazione'); }, saltati), /valutazione/);
});
