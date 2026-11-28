// Score: analisi, trasposizione, recupero degli score troncati, impostazioni, score scelti a mano e produzione.
//   node --test tools/test/score.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const A = require(path.join(RADICE, 'src', 'compositore', 'abc.js'));
const C = require(path.join(RADICE, 'src', 'compositore', 'compositore.js'));
const catalogo = JSON.parse(leggi('config', 'catalogo.json')).categories;
const surf = catalogo.find((c) => c.name === 'Surf-rock-strumentale');
const composto = C.componi({ cat: surf, bpm: 120, tonalita: 'Mi minore', durata_s: 200, sezioni: ['[intro]', '[verse]', '[chorus]', '[verse]', '[chorus]', '[outro]'], seed: 7 });

test('analisi: durata, sezioni, estensione e note dell\'accordo', () => {
  const a = A.analizza(composto.abc);
  assert.deepEqual(a.errori, []);
  assert.equal(a.secondi, composto.durata_s);
  assert.equal(a.sezioni.length, 6);
  assert.ok(a.estensione[0] < a.estensione[1] && a.accordoSulBattere > 0.6 && a.ripetizione >= 0 && a.ripetizione < 1);
  assert.equal(a.voce, false);
  assert.ok(A.analizza('niente').errori.length);
});

test('trasposizione: sposta note, accordi e tonalità, e tornando indietro è lo stesso brano', () => {
  const { score } = A.leggiAbc(composto.abc);
  const su = A.trasponi(score, 3);
  assert.equal(su.tonalita, 'Gm');
  const testo = A.scriviAbc(su);
  assert.ok(testo.includes('K:Gm') && testo.includes('"Gm'));
  const [min] = A.analizza(testo).estensione;
  assert.equal(min, A.analizza(composto.abc).estensione[0] + 3);
  assert.equal(A.scriviAbc(A.trasponi(A.leggiAbc(testo).score, -3)), composto.abc);
  assert.throws(() => A.trasponi(score, 60), /estensione/);
});

test('recupero: uno score troncato a metà di un accordo torna valido e chiude con l\'outro', () => {
  const rotto = composto.abc.slice(0, Math.floor(composto.abc.length * 0.7)) + '"E';
  assert.ok(A.leggiAbc(rotto).errori.length);
  const r = A.ripara(rotto, { obiettivo: 200, minimo: 60 });
  assert.ok(r.tagliato && r.secondi >= 60 && r.secondi < 200);
  const a = A.analizza(r.abc);
  assert.deepEqual(a.errori, []);
  assert.equal(a.sezioni.at(-1).nome, 'outro');
  assert.equal(A.ripara(rotto, { minimo: 190 }), null);
  assert.equal(A.ripara('non è uno score'), null);
});

test('recupero: uno score troppo lungo si taglia vicino alla durata richiesta; uno buono resta intero', () => {
  const r = A.ripara(composto.abc, { obiettivo: 100, minimo: 75 });
  assert.ok(Math.abs(r.secondi - 100) <= 25, String(r.secondi));
  assert.ok(r.tagliato);
  const intero = A.ripara(composto.abc, { obiettivo: 200, minimo: 100 });
  assert.equal(intero.tagliato, false);
  assert.equal(intero.abc, composto.abc);
});

test('recupero: una legatura rimasta aperta sul taglio si chiude', () => {
  const testa = composto.abc.slice(0, composto.abc.indexOf('% '));
  const t = testa + '% verse\nV: Vocal\nz32|\nV: Ins\nc32-|\nV: Vocal\nz32|\nV: Ins\nc32|';
  const r = A.ripara(t.slice(0, t.lastIndexOf('V: Vocal')), {});
  assert.ok(r && A.analizza(r.abc).battute === 1);
});

test('impostazioni: predefiniti, poi generali, poi genere; i valori sbagliati si ignorano', () => {
  const conf = { generale: { fonte: 'compositore', tentativi: 2, temperature: 9 }, generi: { A: { fonte: 'motore', tentativi: 2.5 } } };
  const a = A.impostazioni(conf, 'A');
  assert.deepEqual([a.fonte, a.tentativi, a.temperature], ['motore', 2, 0.7]);
  assert.equal(A.impostazioni(conf, 'B').fonte, 'compositore');
  const base = A.impostazioni(null, 'A');
  assert.deepEqual(A.campionamento(base), { abc_sampling: { max_tokens: 6000 } });
  assert.deepEqual(A.campionamento({ ...base, temperature: 0.9, armonia: 6 }), { abc_sampling: { max_tokens: 6000, temperature: 0.9 }, harmony: { strength: 6 } });
});

test('score a mano: velocità, tonalità, durata, stile e lyrics del brano seguono lo score', () => {
  const concept = { titolo: 'T', categoria: 'Surf-rock-strumentale', bpm: 90, tonalita: 'La minore', durata_s: 150, style: 'Instrumental, surf rock, 90 BPM, A minor, no vocals', score: { seed: 1 } };
  const c = A.applica(concept, { id: 'r1', abc: composto.abc });
  assert.deepEqual([c.bpm, c.tonalita, c.durata_s, c.scoreManuale, c.score], [120, 'Mi minore', composto.durata_s, 'r1', undefined]);
  assert.equal(c.style, 'Instrumental, surf rock, 120 BPM, E minor, no vocals');
  assert.equal(c.lyrics, composto.lyrics);
  assert.throws(() => A.applica(concept, { id: 'r2', abc: 'X:1' }), /non valido/);
  const richieste = [{ id: 'g', categoria: 'Surf-rock-strumentale' }, { id: 't', categoria: 'Surf-rock-strumentale', titolo: 'T' }, { id: 'x', categoria: 'Altro' }];
  assert.equal(A.richiestaPer(richieste, {}, concept).id, 't');
  assert.equal(A.richiestaPer(richieste, { t: 1 }, concept).id, 'g');
  assert.equal(A.richiestaPer(richieste, { t: 1, g: 1 }, concept), null);
});

// ---- blocchi di produzione ----
const AF = Object.getPrototypeOf(async function () {}).constructor;
const MODULO = `const ScoreAbc = (() => { const module = { exports: {} };\n${leggi('src', 'compositore', 'abc.js')}\nreturn module.exports; })();`;
const LIB = leggi('src', 'lib.js') + '\n' + leggi('src', 'lib-apprendimento.js') + '\n' + MODULO;
const FINTA = `CFG.comandi = {}; log = () => {}; engineUp = async () => true; saveState = () => {}; gw = async () => ({});
  confScore = () => $env.conf || {}; archivioScore = () => $env.archivio || {}; CFG.dir = $env.dir;
  req = async (m, url, o) => {
    if (url.endsWith('/props')) return { ok: true, status: 200, buf: Buffer.from('{}') };
    if (url.includes('result=1')) return { ok: true, status: 200, headers: { 'content-type': 'multipart/mixed; boundary=XX' }, buf: Buffer.from('--XX\\r\\nContent-Type: application/json\\r\\n\\r\\n' + JSON.stringify({ abc: $env.abc }) + '\\r\\n--XX--\\r\\n') };
    if (m === 'GET') return { ok: true };
    $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"j2"}') };
  };
  getJson = async () => ({ status: 'done' });`;
async function blocco(nome, state, env) {
  // i blocchi scrivono solo dentro le cartelle del progetto
  env.dir ||= fs.mkdtempSync(path.join(RADICE, 'state', 'prova-score-'));
  const [r] = await new AF('require', '$input', '$env', `${LIB}\n${FINTA}\n${leggi('src', 'blocks', nome)}`)(require, { first: () => ({ json: { state } }) }, env);
  return { ...r.json, env };
}
const concept = (extra) => ({ titolo: 't', categoria: 'Surf-rock-strumentale', durata_s: 200, style: 's, 90 BPM, A minor', lyrics: '[verse]', ...extra });

test('blocco 6: lo score scelto a mano salta il modello e risulta usato', async () => {
  const archivio = { richieste: [{ id: 'r1', categoria: 'Surf-rock-strumentale', abc: composto.abc }] };
  const { state, env } = await blocco('06-invia-render.js', { job: null, queue: [concept()] }, { archivio });
  fs.rmSync(env.dir, { recursive: true, force: true });
  assert.equal(env.corpo.abc, composto.abc);
  assert.equal(state.job.scoreFonte, 'manuale');
  assert.equal(state.job.fase, undefined);
  assert.equal(state.scoreUsati.r1.titolo, 't');
});

test('blocco 6: la fonte scelta nelle impostazioni decide chi scrive', async () => {
  const con = async (fonte) => { const r = await blocco('06-invia-render.js', { job: null, queue: [concept({ abc: composto.abc })] }, { conf: { generale: { fonte } } }); fs.rmSync(r.env.dir, { recursive: true, force: true }); return r; };
  assert.equal((await con('modello')).state.job.fase, 'piano');
  assert.equal((await con('compositore')).env.corpo.abc, composto.abc);
  assert.equal((await con('motore')).env.corpo.abc, undefined);
});

test('blocco 2: uno score troncato del modello si recupera; senza recupero si richiede e si conserva', async () => {
  const rotto = composto.abc.slice(0, Math.floor(composto.abc.length * 0.93)) + '"E';
  const job = () => ({ id: 'j1', fase: 'piano', pianoN: 1, submittedAt: Date.now(), concept: concept(), adapters: [] });
  const si = await blocco('02-controlla-render.js', { job: job() }, { abc: rotto });
  assert.equal(si.state.job.scoreRiparato, true);
  assert.ok(A.analizza(si.env.corpo.abc).secondi >= 150);
  const no = await blocco('02-controlla-render.js', { job: job() }, { abc: rotto, conf: { generale: { ripara: false } } });
  assert.equal(no.state.job.pianoN, 2);
  const conservati = fs.readdirSync(path.join(no.env.dir, 'state', 'score-scartati'));
  assert.equal(conservati.length, 1);
  for (const d of [si.env.dir, no.env.dir]) fs.rmSync(d, { recursive: true, force: true });
});

test('blocco 6: una richiesta inutilizzabile risulta consumata e il brano parte lo stesso', async () => {
  const archivio = { richieste: [{ id: 'r9', categoria: 'Surf-rock-strumentale', abc: 'rotto' }] };
  const { state, env } = await blocco('06-invia-render.js', { job: null, queue: [concept()] }, { archivio });
  fs.rmSync(env.dir, { recursive: true, force: true });
  assert.match(state.scoreUsati.r9.errore, /non valido/);
  assert.equal(state.job.fase, 'piano');
});
