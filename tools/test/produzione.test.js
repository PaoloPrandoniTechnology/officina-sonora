// Richiesta di render in produzione: sezioni riconosciute, score con accordi, LoRA di genere, score salvato
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const LIB = leggi('src', 'lib.js') + '\n' + leggi('src', 'lib-apprendimento.js');
const SCORE = `const ScoreAbc = (() => { const module = { exports: {} };
${leggi('src', 'compositore', 'abc.js')}
return module.exports; })();`;
const AF = Object.getPrototypeOf(async function () {}).constructor;
const L = new Function('require', LIB + '\nreturn { CFG, extractAbc, componiStile };')(require);
const TAG = ['[intro]', '[verse]', '[pre-chorus]', '[chorus]', '[bridge]', '[outro]'];

// Esegue il blocco 6 con un motore finto; ritorna il corpo inviato a /synth e lo stato
async function invia(categoria, { props, vocale = false, attempts = 0, abc, corti = 0, pianoFallito = true, lora } = {}) {
  const finta = `
    confScore = () => (${JSON.stringify(lora ? { generale: { lora } } : {})}); archivioScore = () => ({});
    CFG.comandi = {}; log = () => {}; engineUp = async () => true; saveState = () => {}; gw = async () => ({});
    req = async (m, url, o) => {
      if (url.endsWith('/props')) { if (!$env.props) throw new Error('no'); return { ok: true, status: 200, buf: Buffer.from(JSON.stringify($env.props)) }; }
      $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"j1"}') };
    };`;
  const env = { props };
  const concept = { titolo: 't', categoria, durata_s: 300, style: 's', lyrics: '[verse]', vocale, attempts, abc, tentativi_render: corti, pianoFallito };
  const input = { first: () => ({ json: { state: { job: null, queue: [concept] } } }) };
  const [r] = await new AF('require', '$input', '$env', LIB + SCORE + finta + '\n' + leggi('src', 'blocks', '06-invia-render.js'))(require, input, env);
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

const KTO = { name: 'yue2-instrumental-kto', scale: 1, ar_scale: 1, nar_scale: 0 };
const EPICA = { name: 'yue2-epic-trailer', scale: 1, ar_scale: 0.5, nar_scale: 0.375 };
const TUTTE = () => elenco('yue2-instrumental', 'yue2-instrumental-kto', 'yue2-epic-trailer');

test('una sola LoRA per brano: di serie la strumentale; a scelta quella del genere al suo posto, o nessuna', async () => {
  const { corpo, job } = await invia('Score-cinematico', { props: TUTTE() });
  assert.equal(corpo.cot, 'full');
  assert.deepEqual(corpo.adapters, [KTO]);
  assert.deepEqual(job.adapters, corpo.adapters);
  assert.ok(corpo.semantic_sampling.max_tokens <= 9000 && corpo.duration <= 360);
  assert.deepEqual((await invia('Score-cinematico', { props: TUTTE(), lora: 'genere' })).corpo.adapters, [EPICA]);
  assert.equal((await invia('Score-cinematico', { props: TUTTE(), lora: 'nessuna' })).corpo.adapters, undefined);
  // un genere senza LoRA propria resta con la strumentale
  assert.deepEqual((await invia('Surf-rock-strumentale', { props: TUTTE(), lora: 'genere' })).corpo.adapters, [KTO]);
  // in nessun genere e con nessuna scelta ne partono due
  for (const c of L.CFG.categories) {
    for (const lora of ['strumentale', 'genere', 'nessuna']) {
      const r = await invia(c.name, { props: elenco('yue2-instrumental-kto', ...(c.lora || []).map((x) => x.name)), lora, vocale: !!c.vocale_senza_parole, abc: 'X:1' });
      assert.ok((r.job.adapters || []).length <= 1, `${c.name} ${lora}`);
    }
  }
});

test('genere vocale senza parole: nessuna LoRA strumentale', async () => {
  const { corpo } = await invia('Vocalise-coro', { props: elenco('yue2-instrumental'), vocale: true });
  assert.equal(corpo.adapters, undefined);
});

// Visto in produzione: con yue2-instrumental il motore chiudeva i brani a 30 secondi
test('LoRA del genere assente: si usa la strumentale; yue2-instrumental mai', async () => {
  const { corpo } = await invia('Score-cinematico', { props: elenco('yue2-instrumental', 'yue2-instrumental-kto'), lora: 'genere' });
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

test('dopo un render fallito si torna alla strumentale, anche se la scelta era un altra', async () => {
  for (const lora of ['strumentale', 'genere', 'nessuna']) {
    const secondo = await invia('Score-cinematico', { props: TUTTE(), attempts: 1, lora });
    assert.equal(secondo.corpo.cot, 'full');
    assert.deepEqual(secondo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto'], lora);
    const terzo = await invia('Score-cinematico', { props: TUTTE(), attempts: 2, lora });
    assert.equal(terzo.corpo.cot, 'melody');
    assert.deepEqual(terzo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto'], lora);
  }
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

const conceptQuiete = () => ({ ...conceptSurf(), categoria: 'Hatha-base', bpm: 84 });

test('blocco 5d: genere creativo, forma e score li decide il compositore estro, lo stile resta', async () => {
  const c = await componiScore({ ...conceptSurf(), style: 'Instrumental, surf rock, 130 BPM, E minor, no vocals', descrizione: 'd' });
  assert.match(c.abc, /^X:1\n/);
  assert.ok(c.score.parametri.forma && c.score.parametri.trovate.includes('solo'));
  assert.deepEqual(c.sezioni, c.lyrics.split('\n\n'));
  assert.equal(c.style, 'Instrumental, surf rock, 130 BPM, E minor, no vocals');
  assert.equal(/Richiamo nascosto/.test(c.descrizione), Boolean(c.score.parametri.cameo));
});

test('blocco 5d: scrive score, lyrics e durata del brano strumentale', async () => {
  const c = await componiScore(conceptQuiete());
  assert.match(c.abc, /^X:1\n/);
  assert.ok(c.score.punteggio > 60 && Math.abs(c.durata_s - 200) <= 16);
  assert.equal(c.lyrics.split('\n\n').length, L.CFG.strutture.arco.length);
});

test('blocco 5d: voci e richieste non componibili restano al motore', async () => {
  assert.equal((await componiScore({ ...conceptSurf(), vocale: true })).abc, undefined);
  const rotto = await componiScore({ ...conceptQuiete(), sezioni: ['[Main]'] });
  assert.equal(rotto.abc, undefined);
  assert.equal(rotto.lyrics, 'x');
});

test('blocco 6: prima il solo score; col ripiego il nostro; dopo un fallimento lo scrive il motore', async () => {
  const props = elenco('yue2-instrumental-kto');
  // un genere creativo parte subito col nostro score, senza chiedere quello del modello
  assert.equal((await invia('Surf-rock-strumentale', { props, abc: 'X:1', pianoFallito: false })).corpo.abc, 'X:1');
  assert.equal((await invia('Surf-rock-strumentale', { props, abc: 'X:1', attempts: 1 })).corpo.abc, 'X:1');
  assert.equal((await invia('Surf-rock-strumentale', { props, abc: 'X:1', attempts: 2 })).corpo.abc, undefined);
  const primo = await invia('Hatha-base', { props, abc: 'X:1', pianoFallito: false });
  assert.equal(primo.corpo.duration, 1);
  assert.equal(primo.corpo.abc, undefined);
  assert.equal(primo.job.fase, 'piano');
  assert.equal(primo.corpo.adapters, undefined, 'lo score si chiede senza LoRA');
  assert.ok(primo.job.adapters.length, 'le LoRA restano per il render');
  const ripiego = await invia('Hatha-base', { props, abc: 'X:1', pianoFallito: true });
  assert.equal(ripiego.corpo.abc, 'X:1');
  assert.equal(ripiego.corpo.semantic_sampling.min_tokens, 6750);
  assert.equal(ripiego.job.abcNostro, true);
  const secondo = await invia('Hatha-base', { props, abc: 'X:1', attempts: 1 });
  assert.equal(secondo.corpo.abc, undefined);
  assert.equal(secondo.corpo.output_format, 'mp3');
  assert.ok(secondo.corpo.abc_sampling.max_tokens > 0);
});

test('secondo ritento di un brano corto: la LoRA di genere lascia il posto alla strumentale', async () => {
  const props = elenco('yue2-instrumental-kto', 'yue2-epic-trailer');
  const primo = await invia('Score-cinematico', { props, corti: 1, lora: 'genere' });
  assert.deepEqual(primo.corpo.adapters.map((a) => a.name), ['yue2-epic-trailer']);
  const secondo = await invia('Score-cinematico', { props, corti: 2, lora: 'genere' });
  assert.deepEqual(secondo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});
