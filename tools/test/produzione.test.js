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
async function invia(categoria, { props, vocale = false, attempts = 0 } = {}) {
  const finta = `
    CFG.comandi = {}; log = () => {}; engineUp = async () => true;
    req = async (m, url, o) => {
      if (url.endsWith('/props')) { if (!$env.props) throw new Error('no'); return { ok: true, status: 200, buf: Buffer.from(JSON.stringify($env.props)) }; }
      $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"j1"}') };
    };`;
  const env = { props };
  const concept = { titolo: 't', categoria, durata_s: 300, style: 's', lyrics: '[verse]', vocale, attempts };
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
    { name: 'yue2-instrumental', scale: 1, ar_scale: 1, nar_scale: 0 },
    { name: 'yue2-epic-trailer', scale: 1, ar_scale: 0.5, nar_scale: 0.375 },
  ]);
  assert.deepEqual(job.adapters, corpo.adapters);
  assert.ok(corpo.semantic_sampling.max_tokens <= 9000 && corpo.duration <= 360);
});

test('genere vocale senza parole: nessuna LoRA strumentale', async () => {
  const { corpo } = await invia('Vocalise-coro', { props: elenco('yue2-instrumental'), vocale: true });
  assert.equal(corpo.adapters, undefined);
});

test('LoRA assente: il brano parte senza; manca la strumentale: KTO', async () => {
  const { corpo } = await invia('Score-cinematico', { props: elenco('yue2-instrumental-kto') });
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
  assert.deepEqual(secondo.corpo.adapters.map((a) => a.name), ['yue2-instrumental']);
  const terzo = await invia('Score-cinematico', { props, attempts: 2 });
  assert.equal(terzo.corpo.cot, 'melody');
  assert.deepEqual(terzo.corpo.adapters.map((a) => a.name), ['yue2-instrumental-kto']);
});
