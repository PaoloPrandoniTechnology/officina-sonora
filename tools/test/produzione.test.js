// Richiesta di render in produzione: sezioni riconosciute, score con accordi, LoRA di genere, score salvato
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const LIB = leggi('src', 'lib.js') + '\n' + leggi('src', 'lib-apprendimento.js');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const L = new Function('require', LIB + '\nreturn { CFG, extractAbc, componiStile };')(require);
const TAG = ['[intro]', '[verse]', '[pre-chorus]', '[chorus]', '[bridge]', '[outro]'];

// Esegue il blocco 6 con un motore finto; ritorna il corpo inviato a /synth e lo stato
async function invia(categoria, { props, vocale = false, attempts = 0, abc, corti = 0, pianoFallito } = {}) {
  const finta = `
    CFG.comandi = {}; log = () => {}; engineUp = async () => true; saveState = () => {}; gw = async () => ({});
    req = async (m, url, o) => {
      if (url.endsWith('/props')) { if (!$env.props) throw new Error('no'); return { ok: true, status: 200, buf: Buffer.from(JSON.stringify($env.props)) }; }
      $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"j1"}') };
    };`;
  const env = { props };
  const concept = { titolo: 't', categoria, durata_s: 300, style: 's', lyrics: '[verse]', vocale, attempts, abc, tentativi_render: corti, pianoFallito };
  const input = { first: () => ({ json: { state: { job: null, queue: [concept] } } }) };
  const [r] = await new AF('require', '$input', '$env', LIB + finta + '\n' + leggi('src', 'blocks', '06-invia-render.js'))(require, input, env);
  return { corpo: env.corpo, job: r.json.state.job };
}
const elenco = (...nomi) => ({ adapters: nomi.map((name) => ({ name, ok: true })) });

test('strutture: solo i sei tag riconosciuti, forme di almeno cinque sezioni', () => {
  assert.deepEqual(L.CFG.sections, TAG);
  for (const [nome, sezioni] of Object.entries(L.CFG.strutture)) {
    assert.ok(sezioni.length >= 5, nome);
    for (const s of sezioni) assert.ok(TAG.includes(s), `${nome}: ${s}`);
  }
  for (const c of L.CFG.categories) for (const s of c.strutture) assert.ok(L.CFG.strutture[s], `${c.name}: ${s}`);
});

test('strumentale: score con accordi, LoRA strumentale e LoRA del genere', async () => {
  const { corpo, job } = await invia('Score-cinematico', { props: elenco('yue2-instrumental', 'yue2-instrumental-kto', 'yue2-epic-trailer') });
  assert.equal(corpo.cot, 'full');
  assert.deepEqual(corpo.adapters, [
    { name: 'yue2-instrumental-kto', scale: 1, ar_scale: 1, nar_scale: 0 },
    { name: 'yue2-epic-trailer', scale: 1, ar_scale: 0.5, nar_scale: 0.375 },
  ]);
  assert.deepEqual(job.adapters, corpo.adapters);
  assert.ok(corpo.semantic_sampling.max_tokens <= 9000 && corpo.duration <= 360);
});

test('genere vocale senza parole: nessuna LoRA strumentale', async () => {
  const { corpo } = await invia('Vocalise-coro', { props: elenco('yue2-instrumental'), vocale: true });
  assert.equal(corpo.adapters, undefined);
});

// Visto in produzione: con yue2-instrumental il motore chiudeva i brani a 30 secondi
test('LoRA assente: il brano parte senza; yue2-instrumental non viene usata', async () => {
  const { corpo } = await invia('Score-cinematico', { props: elenco('yue2-instrumental', 'yue2-instrumental-kto') });
  assert.deepEqual(corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});

test('/props non disponibile: solo la strumentale KTO', async () => {
  const { corpo } = await invia('Score-cinematico', {});
  assert.deepEqual(corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});

test('score restituito dal motore: estratto dalla risposta', () => {
  const buf = Buffer.from('--XX\r\nContent-Type: application/json\r\n\r\n{"abc":"X:1\\nK:C"}\r\n--XX\r\nContent-Type: audio/mpeg\r\n\r\nAAA\r\n--XX--\r\n');
  assert.equal(L.extractAbc(buf, 'multipart/mixed; boundary=XX'), 'X:1\nK:C');
  assert.equal(L.extractAbc(Buffer.from('AAA'), 'audio/mpeg'), null);
});

test('stile: nessuna frase ripetuta', () => {
  const cat = { stile: 'heavy riffs, double bass drums', ritmica: 'x', varianti: [] };
  const s = L.componiStile(cat, { keywords: 'Heavy riffs, double bass drums' }, ['basso'], '', {});
  assert.equal(s.match(/heavy riffs/gi).length, 1, s);
  assert.equal(s.match(/double bass drums/g).length, 1, s);
});

// Visto in produzione: LoRA sovrapposte possono scrivere uno score che il motore non riesce a cantare
test('dopo un render fallito si riducono le LoRA, poi si torna alla configurazione sicura', async () => {
  const props = elenco('yue2-instrumental', 'yue2-instrumental-kto', 'yue2-epic-trailer');
  const secondo = await invia('Score-cinematico', { props, attempts: 1 });
  assert.equal(secondo.corpo.cot, 'full');
  assert.deepEqual(secondo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
  const terzo = await invia('Score-cinematico', { props, attempts: 2 });
  assert.equal(terzo.corpo.cot, 'melody');
  assert.deepEqual(terzo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});

// Esegue il blocco 5d cosi' come finisce nel workflow generato
async function componiScore(concept) {
  const uscita = path.join(RADICE, 'state', 'wf-prova-produzione.json');
  require('child_process').execFileSync('node', ['build-workflow.mjs', uscita], { cwd: RADICE, stdio: 'ignore' });
  const wf = JSON.parse(fs.readFileSync(uscita, 'utf8'));
  const memoria = path.join(RADICE, 'state', 'memoria-prova-produzione.json');
  const codice = wf.nodes.find((n) => n.name === '5d Componi score').parameters.jsCode
    .replace('// BLOCCO 5d', `CFG.comandi = {}; log = () => {}; CFG.memoriaFile = ${JSON.stringify(memoria)};\n// BLOCCO 5d`);
  assert.ok(wf.connections['5c Componi concept'].main[0].some((l) => l.node === '5d Componi score'));
  assert.ok(wf.connections['5d Componi score'].main[0].some((l) => l.node === '6 Invia render'));
  const input = { first: () => ({ json: { state: { job: null, queue: [concept] } } }) };
  const [r] = await new AF('require', '$input', '$env', codice)(require, input, {});
  fs.rmSync(memoria, { force: true });
  return r.json.state.queue[0];
}
const conceptSurf = () => ({ titolo: 't', categoria: 'Surf-rock-strumentale', bpm: 130, tonalita: 'Mi minore', durata_s: 200, sezioni: L.CFG.strutture.arco, lyrics: 'x', vocale: false, attempts: 0 });

test('blocco 5d: scrive score, lyrics e durata del brano strumentale', async () => {
  const c = await componiScore(conceptSurf());
  assert.match(c.abc, /^X:1\n/);
  assert.ok(c.score.punteggio > 60 && Math.abs(c.durata_s - 200) <= 16);
  assert.equal(c.lyrics.split('\n\n').length, L.CFG.strutture.arco.length);
});

test('blocco 5d: voci e richieste non componibili restano al motore', async () => {
  assert.equal((await componiScore({ ...conceptSurf(), vocale: true })).abc, undefined);
  const rotto = await componiScore({ ...conceptSurf(), sezioni: ['[Main]'] });
  assert.equal(rotto.abc, undefined);
  assert.equal(rotto.lyrics, 'x');
});

test('blocco 6: prima il solo score; col ripiego il nostro; dopo un fallimento lo scrive il motore', async () => {
  const props = elenco('yue2-instrumental-kto');
  const primo = await invia('Surf-rock-strumentale', { props, abc: 'X:1' });
  assert.equal(primo.corpo.duration, 1);
  assert.equal(primo.corpo.abc, undefined);
  assert.equal(primo.job.fase, 'piano');
  const ripiego = await invia('Surf-rock-strumentale', { props, abc: 'X:1', pianoFallito: true });
  assert.equal(ripiego.corpo.abc, 'X:1');
  assert.equal(ripiego.corpo.semantic_sampling.min_tokens, 6750);
  assert.equal(ripiego.job.abcNostro, true);
  const secondo = await invia('Surf-rock-strumentale', { props, abc: 'X:1', attempts: 1 });
  assert.equal(secondo.corpo.abc, undefined);
  assert.equal(secondo.corpo.output_format, 'mp3');
  assert.ok(secondo.corpo.abc_sampling.max_tokens > 0);
});

test('secondo ritento di un brano corto: senza LoRA di genere', async () => {
  const props = elenco('yue2-instrumental-kto', 'yue2-epic-trailer');
  const primo = await invia('Score-cinematico', { props, corti: 1 });
  assert.equal(primo.corpo.adapters.length, 2);
  const secondo = await invia('Score-cinematico', { props, corti: 2 });
  assert.deepEqual(secondo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});
