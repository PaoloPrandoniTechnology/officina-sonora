// Generi tutti uguali e testi cantati: modello, migrazione, editor, archivio dei testi e produzione.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const M = require(path.join(RADICE, 'gateway', 'parole-modello.js'));
const parole = require(path.join(RADICE, 'gateway', 'parole.js'));
const generi = require(path.join(RADICE, 'gateway', 'generi.js'));
const { migra } = require(path.join(RADICE, 'tools', 'migra-generi.js'));
const CAT = JSON.parse(leggi('config', 'catalogo.json'));

const LIB = ['lib.js', 'lib-apprendimento.js'].map((f) => leggi('src', f)).join('\n');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const L = new Function('require', LIB + '\nreturn { CFG, cartellaBrano, componiStile, generePronto, pickSlot, nostroNome, durRange };')(require);

function banco() {
  // dentro il progetto: caricando lib.js le scritture altrove sono bloccate
  const base = fs.mkdtempSync(path.join(RADICE, 'state', 'prove', 'generi-'));
  cartelle.push(base);
  fs.mkdirSync(path.join(base, 'config'));
  fs.mkdirSync(path.join(base, 'state'));
  fs.writeFileSync(path.join(base, 'config', 'catalogo.json'), JSON.stringify(CAT));
  fs.writeFileSync(path.join(base, 'config', 'parametri.json'), '{}');
  return base;
}
const cartelle = [];
fs.mkdirSync(path.join(RADICE, 'state', 'prove'), { recursive: true });
test.after(() => { for (const d of cartelle) fs.rmSync(d, { recursive: true, force: true }); });
const canzone = CAT.categories.find((c) => c.name === 'Canzone-italiana');
const VERSI = [{ tipo: 'verse', righe: ['La sera scende piano sul mare', 'e il vento porta voci lontane'] }, { tipo: 'chorus', righe: ['Resta con me stanotte', 'resta con me domani'] }];

test('nessun genere e nessun file dipende da «yoga»: raccolta e voce stanno nel catalogo', () => {
  for (const c of CAT.categories) {
    assert.ok(CAT.raccolte.some((r) => r.nome === c.raccolta), c.name);
    assert.ok(['strumentale', 'vocalizzi', 'testo'].includes(c.voce), c.name);
    assert.ok(c.carattere, c.name);
  }
  for (const f of ['lib.js', 'lib-apprendimento.js', 'lib-ibroadcast.js', 'compositore/compositore.js', 'compositore/abc.js']) {
    assert.doesNotMatch(leggi('src', ...f.split('/')), /\.ambito|vocale_senza_parole|'Meditazione'|'Jazz-lounge'/, f);
  }
});

test('migrazione: cartelle e playlist restano quelle di prima; si può rilanciare', () => {
  const cat = { categories: [{ name: 'Meditazione', ambito: 'yoga' }, { name: 'Jazz-lounge', ambito: 'yoga' }, { name: 'Soul-vocalise', ambito: 'musica', vocale_senza_parole: true }] };
  migra(cat, { tieni: true });
  assert.equal(cat.categories[0].ambito, 'yoga');
  const nuovi = migra(cat);
  assert.deepEqual(nuovi, []);
  assert.deepEqual(cat.categories.slice(0, 3).map((c) => [c.raccolta, c.voce, c.carattere, c.ambito]), [['Yoga', 'strumentale', 'drone', undefined], ['Yoga', 'strumentale', 'jazz', undefined], ['Sottofondo', 'vocalizzi', 'elettro', undefined]]);
  assert.deepEqual(cat.raccolte.slice(0, 2).map((r) => r.playlist), ['Yoga', 'Musica']);
  assert.match(L.cartellaBrano('Meditazione', 't'), /[\\/]Yoga[\\/]meditativo[\\/]Meditazione/);
  assert.match(L.cartellaBrano('Synthwave', 't'), /[\\/]Sottofondo[\\/]/);
  assert.match(L.cartellaBrano('Canzone-italiana', 't'), /[\\/]Canzoni[\\/]/);
  for (const n of ['yoga', 'musica', 'canzoni', 'Yoga - X', 'Musica - X', 'Canzoni - X', 'famiglia-rock']) assert.ok(L.nostroNome(n), n);
  for (const n of ['preferiti', 'voto-5', 'musica bella']) assert.ok(!L.nostroNome(n), n);
});

test('parole: lyrics per il motore, testo incollato, sillabe, rime e controlli', () => {
  assert.equal(M.lyricsDi(VERSI), '[verse]\nLa sera scende piano sul mare\ne il vento porta voci lontane\n\n[chorus]\nResta con me stanotte\nresta con me domani');
  assert.deepEqual(M.daTesto('[Strofa 1]\nuno\ndue\n\n[Ritornello]\ntre').map((s) => [s.tipo, s.righe.length]), [['verse', 2], ['chorus', 1]]);
  assert.deepEqual(M.daTesto('uno\n\ndue').map((s) => s.tipo), ['verse', 'verse']);
  assert.equal(M.sillabe('la poesia', 'it'), 4);
  assert.equal(M.sillabe('the light of day', 'en'), 4);
  assert.deepEqual(M.schemaRime(['il mio cuore', 'un fiore', 'sul tetto'], 'it'), ['A', 'A', '-']);
  assert.ok(M.controlli([{ tipo: 'verse', righe: ['una [x]'] }], {}).some((c) => c.grave && !c.ok));
  assert.ok(M.controlli(VERSI, { lingua: 'it' }).every((c) => !c.grave || c.ok));
});

test('archivio dei testi: salva, approva, usato non si modifica, bozza dell’IA approvata solo in automatico', async () => {
  const base = banco();
  const testi = { chiedi: async () => ({ dati: { titolo: 'Maree', sezioni: [VERSI[0], VERSI[1], { tipo: 'chorus', righe: ['diverso'] }] } }) };
  const a = parole.crea({ base, testi });
  await assert.rejects(a.gestisci('salva', { genere: 'Meditazione', sezioni: VERSI }), /non ha il testo cantato/);
  await assert.rejects(a.gestisci('salva', { genere: canzone.name, sezioni: [], stato: 'approvato' }), /non approvabile/);
  const { testo } = await a.gestisci('salva', { genere: canzone.name, titolo: 'Mare', sezioni: VERSI, stato: 'approvato' });
  assert.equal(testo.lingua, 'it');
  assert.ok(testo.durata_s >= 60);
  const bozza = await a.bozza({ genere: canzone.name, approvata: true });
  assert.equal(bozza.stato, 'bozza', 'il genere è «con approvazione»');
  assert.deepEqual(bozza.sezioni[2].righe, VERSI[1].righe, 'ritornelli uguali');
  fs.writeFileSync(path.join(base, 'state', 'state.json'), JSON.stringify({ testiUsati: { [testo.id]: { titolo: 'x' } } }));
  await assert.rejects(a.gestisci('salva', { id: testo.id, genere: canzone.name, sezioni: VERSI }), /già usato/);
  assert.equal((await a.gestisci('duplica', { id: testo.id })).testo.stato, 'bozza');
  fs.writeFileSync(path.join(base, 'state', 'parole.json'), '{ rotto');
  await assert.rejects(a.gestisci('salva', { genere: canzone.name, sezioni: VERSI }), /illeggibile/);
  assert.equal(fs.readFileSync(path.join(base, 'state', 'parole.json'), 'utf8'), '{ rotto');
});

test('editor dei generi: ogni genere esistente si risalva uguale nella sostanza; nuovo nasce sospeso', async () => {
  const base = banco();
  const adattatori = path.join(base, 'lora');
  for (const id of new Set(CAT.categories.flatMap((c) => (c.lora || []).map((l) => l.name)))) {
    fs.mkdirSync(path.join(adattatori, id), { recursive: true });
    fs.writeFileSync(path.join(adattatori, id, 'adapter.json'), JSON.stringify({ name: { en: id } }));
  }
  const g = generi.crea({ base, adattatori, brani: () => ({ Meditazione: 3 }) });
  const modulo = (c) => ({
    ...c, lora: ((c.lora || [])[0] || {}).name || '', vietati: c.vietati || [], influenze: (c.influenze || []).map((i) => ({ ...i, en: ((c.en || {}).influences || {})[i.genere] })),
    strumenti: c.strumenti.map((it) => ({ it, en: ((c.en || {}).instruments || {})[it] || it, ruolo: !c.organico ? 'scelta' : c.organico.fissi.includes(it) ? 'fisso' : (c.organico.scelta || []).includes(it) ? 'scelta' : 'riserva' })),
  });
  for (const c of CAT.categories) {
    await g.gestisci('salva', modulo(c));
    const dopo = JSON.parse(fs.readFileSync(path.join(base, 'config', 'catalogo.json'), 'utf8')).categories.find((x) => x.name === c.name);
    assert.deepEqual(dopo.strumenti, c.strumenti, c.name);
    assert.deepEqual(dopo.en.instruments && Object.keys(dopo.en.instruments).sort(), [...c.strumenti].sort(), c.name);
    assert.deepEqual([dopo.lora, dopo.raccolta, dopo.voce, dopo.bpm], [c.lora, c.raccolta, c.voce, c.bpm], c.name);
  }
  const nuovo = { ...modulo(CAT.categories[0]), name: undefined, genere: 'Cumbia andina', famiglia: 'latino' };
  const r = await g.gestisci('salva', nuovo);
  assert.equal(r.nome, 'Cumbia-andina');
  assert.equal(JSON.parse(fs.readFileSync(path.join(base, 'config', 'parametri.json'), 'utf8')).generi['Cumbia-andina'].attivo, false);
  await assert.rejects(g.gestisci('salva', nuovo), /esiste già/);
  await assert.rejects(g.gestisci('salva', { ...nuovo, genere: '..\\..' }), /solo lettere/);
  await assert.rejects(g.gestisci('salva', { ...nuovo, genere: 'Altro', raccolta: 'Inventata' }), /raccolta/);
  await assert.rejects(g.gestisci('elimina', { name: 'Meditazione' }), /ha brani/);
  await g.gestisci('elimina', { name: 'Cumbia-andina' });
  await g.gestisci('raccolta', { nome: 'Feste' });
  await g.gestisci('lingua', { codice: 'es', nome: 'Spagnolo', en: 'Spanish' });
  await assert.rejects(g.gestisci('raccolta', { nome: 'a/b' }), /solo lettere/);
});

test('produzione: un genere cantato senza testo approvato resta fuori', () => {
  const dir = L.CFG.paroleFile;
  const base = banco();
  L.CFG.paroleFile = path.join(base, 'state', 'parole.json');
  const vecchie = [L.CFG.categories, L.CFG.generiOverride, L.CFG.comandi, L.CFG.root];
  try {
    L.CFG.categories = [canzone]; L.CFG.generiOverride = {}; L.CFG.comandi = {}; L.CFG.root = base;
    assert.equal(L.generePronto(canzone, {}), false);
    assert.equal(L.pickSlot({}, {}), null);
    L.CFG.categories = [canzone, CAT.categories[0]]; L.CFG.comandi = { produciGenere: canzone.name };
    assert.equal(L.pickSlot({}, {}).category.name, CAT.categories[0].name, 'senza testo si produce altro');
    L.CFG.categories = [canzone]; L.CFG.comandi = {};
    assert.equal(L.generePronto({ ...canzone, testi: 'auto' }, {}), true);
    fs.writeFileSync(L.CFG.paroleFile, JSON.stringify({ testi: [{ id: 'a', genere: canzone.name, lingua: 'it', stato: 'approvato', lyrics: '[verse]\nx' }] }));
    assert.equal(L.pickSlot({}, {}).category.name, canzone.name);
    assert.equal(L.generePronto(canzone, { testiUsati: { a: {} } }), false);
    assert.deepEqual(L.durRange({}, canzone.name), [180, 240]);
  } finally { [L.CFG.categories, L.CFG.generiOverride, L.CFG.comandi, L.CFG.root] = vecchie; L.CFG.paroleFile = dir; }
});

test('brano cantato: stile con lingua e voce, parole nel concept, LoRA con parola d’innesco', async () => {
  const stile = L.componiStile(canzone, null, ['pianoforte'], '', {}, { bpm: 80, tonalita: 'La minore' });
  assert.match(stile, /^Italian pop ballad, Italian lyrics, male lead vocal, expressive piano.*clear diction$/);
  assert.doesNotMatch(stile, /no vocals|Instrumental/i);
  const testo = { id: 'a', titolo: 'Mare', lingua: 'it', lyrics: M.lyricsDi(VERSI), durata_s: 150 };
  const entra = { state: { queue: [], cursor: 0 }, c: { titolo: 'Mare', bpm: 80 }, cat: canzone, testo, strumenti: ['pianoforte'], tonalita: 'La minore', guidance: {}, dmin: 180, dmax: 240,
    slot: { sezioni: ['[intro]'], struttura: 'onda', tipo: 't', ricetta: 'r' } };
  const input = (json) => ({ first: () => ({ json }) });
  const [r5] = await new AF('require', '$input', '$env', `${LIB}\nlog = () => {};\n${leggi('src', 'blocks', '05c-componi-concept.js')}`)(require, input(entra), {});
  const concept = r5.json.state.queue[0];
  assert.deepEqual([concept.lyrics, concept.sezioni, concept.testo, concept.vocale, concept.durata_s], [testo.lyrics, ['[verse]', '[chorus]'], 'a', true, 150]);
  assert.equal(r5.json.state.testiUsati.a.titolo, 'Mare');
  const env = {};
  const finta = `confScore = () => ({}); archivioScore = () => ({}); CFG.comandi = {}; log = () => {}; engineUp = async () => true; saveState = () => {}; gw = async () => ({});
    req = async (m, url, o) => { if (url.endsWith('/props')) return { ok: true, buf: Buffer.from(JSON.stringify({ adapters: [{ name: 'yue2-canzone-italiana' }, { name: 'yue2-instrumental-kto' }] })) };
      $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"j"}') }; };`;
  const abc = `const ScoreAbc = (() => { const module = { exports: {} };\n${leggi('src', 'compositore', 'abc.js')}\nreturn module.exports; })();`;
  await new AF('require', '$input', '$env', `${LIB}\n${abc}\n${finta}\n${leggi('src', 'blocks', '06-invia-render.js')}`)(require, input({ state: { job: null, queue: [{ ...concept }] } }), env);
  assert.match(env.corpo.style, /^cnzn, Italian pop ballad/);
  assert.deepEqual(env.corpo.adapters, [{ name: 'yue2-canzone-italiana', scale: 1, ar_scale: 1, nar_scale: 0 }]);
  assert.equal(env.corpo.lyrics, testo.lyrics);
  assert.equal(env.corpo.abc, undefined);
});
