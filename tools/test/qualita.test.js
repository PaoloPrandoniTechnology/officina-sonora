// Qualità: prompt in inglese, score scritto dal modello e reso strumentale, durata, mastering
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../src/compositore/abc.js');
const { master, FFMPEG } = require('../../gateway/master.js'); // prima di lib.js, che blocca le letture del gateway

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const CAT = JSON.parse(leggi('config', 'catalogo.json'));
const LIB = leggi('src', 'lib.js') + '\n' + leggi('src', 'lib-apprendimento.js');
const AF = Object.getPrototypeOf(async function () {}).constructor;
const L = new Function('require', LIB + '\nreturn { componiStile, recipeKey, recipeStats, tipoDi, extractAbc };')(require);

// Score come lo scrive il motore (L:1/16), con la melodia nella voce cantata
function scoreMotore(battute = 80, bpm = 120) {
  const riga = (v) => Array.from({ length: Math.min(4, v) });
  let out = `X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=${bpm}\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:Cm\n% intro\nV: Vocal\nZ4|\nV: Ins\nG16|G16|G16|A16|\n% verse\n`;
  for (let i = 4; i < battute; i += 4) {
    out += `V: Vocal\n${riga(4).map(() => '"Cm"c8z8|').join('')}\nV: Ins\n${riga(4).map(() => 'G16|').join('')}\n`;
  }
  return out;
}

test('score del motore: melodia spostata su Ins, accordi in Vocal, durata e lyrics', () => {
  const r = A.strumentale(scoreMotore());
  assert.equal(r.secondi, 160);
  const { errori, score } = A.leggiAbc(r.abc);
  assert.deepEqual(errori, []);
  const verse = score.sezioni[1].battute[0];
  assert.equal(verse.vocal, null);
  assert.equal(verse.accordi[0].sigla, 'Cm');
  // il canto (Do, mezza battuta) vince; il resto della nota di Ins resta
  assert.deepEqual(verse.ins.map((e) => [e.midi, e.durata]), [[72, 16], [67, 16]]);
  assert.equal(r.lyrics, '[intro]\n\n[verse]');
});

test('score illeggibile: errore, non uno score rovinato', () => {
  assert.throws(() => A.strumentale('X:1\nK:C'), /score non valido/);
});

const ITALIANO = /\b(chitarra|basso|batteria|pianoforte|melodia|accordi?|modo|di|con|lento|lenta|nessun[ao]?|crescita|archi|percussioni|campane|flauto|voce|voci)\b/i;
const TONALITA = /\b[A-G](#|b)? (major|minor)\b/;

test('stile: inglese, con bpm e tonalità, senza etichette né negazioni, per tutti i generi', () => {
  assert.equal(CAT.categories.length, 39);
  for (const c of CAT.categories) {
    for (const s of c.strumenti) assert.ok(c.en?.instruments?.[s], `${c.name}: manca la traduzione di "${s}"`);
    for (const v of c.varianti) {
      const stile = L.componiStile(c, v, c.strumenti.slice(0, 4), c.influenze[0].genere, {}, { bpm: 98, tonalita: c.tonalita[0] });
      assert.doesNotMatch(stile, ITALIANO, `${c.name}: ${stile}`);
      assert.doesNotMatch(stile, /(melody|chords|rhythm|emphasis|instruments|influence):/, c.name);
      assert.doesNotMatch(stile.replace(/no vocals|no lyrics|no words/g, ''), /\bno \w/, `${c.name}: ${stile}`);
      assert.match(stile, /98 BPM/);
      assert.match(stile, TONALITA, `${c.name}: ${stile}`);
      assert.ok(stile.startsWith(c.vocale_senza_parole ? 'Wordless vocals, ' : 'Instrumental, '), stile);
    }
  }
});

test('ricette: solo ciò che arriva al motore; i voti con le chiavi vecchie contano ancora', () => {
  assert.equal(L.recipeKey('Meditazione', 'onda', 1), 'Meditazione|onda|b1');
  const s = L.recipeStats([{ meta: { ricetta: 'Meditazione|ambient-pad|onda|b1', voto: 5 } }]);
  assert.equal(s['Meditazione|onda|b1'].nu, 1);
  assert.equal(L.tipoDi(1), 'ambient-pad');
  assert.equal(L.tipoDi(5), 'ritmico-energico');
});

test('score estratto da una risposta con audio pesante', () => {
  const buf = Buffer.concat([Buffer.from('--XX\r\nContent-Type: audio/wav\r\n\r\n'), Buffer.alloc(1024), Buffer.from('\r\n--XX\r\nContent-Type: application/json\r\n\r\n{"abc":"X:1"}\r\n--XX--\r\n')]);
  assert.equal(L.extractAbc(buf, 'multipart/mixed; boundary=XX'), 'X:1');
});

// Esegue il blocco 2 su un job di solo score, con un motore finto
async function controlla(job, abc, stato = 'done') {
  const finta = `CFG.comandi = {}; log = () => {}; saveState = () => {};
    gw = async () => ({ ok: true });
    getJson = async () => ({ status: ${JSON.stringify(stato)} });
    req = async (m, url, o) => {
      if (url.includes('result=1')) return { ok: true, status: 200, headers: { 'content-type': 'multipart/mixed; boundary=XX' }, buf: Buffer.from('--XX\\r\\nContent-Type: application/json\\r\\n\\r\\n' + JSON.stringify({ abc: $env.abc }) + '\\r\\n--XX--\\r\\n') };
      $env.corpo = o.body; return { ok: true, status: 200, buf: Buffer.from('{"id":"nuovo"}') };
    };`;
  const blocco = `const ScoreAbc = require(${JSON.stringify(path.join(RADICE, 'src', 'compositore', 'abc.js'))});\n${leggi('src', 'blocks', '02-controlla-render.js')}`;
  const env = { abc };
  const input = { first: () => ({ json: { state: { job, queue: [] } } }) };
  const [r] = await new AF('require', '$input', '$env', LIB + finta + '\n' + blocco)(require, input, env);
  return { ...r.json, corpo: env.corpo };
}
const piano = (extra = {}) => ({ id: 'p1', fase: 'piano', pianoN: 1, submittedAt: Date.now(), adapters: [], concept: { titolo: 't', categoria: 'x', style: 's', lyrics: '[verse]', durata_s: 180, abc: 'compositore', score: { seed: 1 } }, ...extra });

test('score pronto: parte il render con lo score del modello e la durata che ne deriva', async () => {
  const r = await controlla(piano(), scoreMotore());
  assert.equal(r.outcome, 'running');
  assert.equal(r.state.job.id, 'nuovo');
  assert.equal(r.state.job.fase, undefined);
  assert.equal(r.state.job.scoreFonte, 'modello');
  assert.equal(r.state.job.concept.durata_s, 160);
  assert.equal(r.state.job.concept.score, undefined);
  assert.equal(r.corpo.abc, r.state.job.concept.abc);
  assert.equal(r.corpo.semantic_sampling.min_tokens, 3600);
  assert.equal(r.corpo.duration, 184);
  assert.equal(r.corpo.output_format, 'wav32');
});

test('score troppo corto: si chiede un altro score, al terzo si passa al ripiego', async () => {
  const corto = scoreMotore(40);
  const primo = await controlla(piano({ concept: { ...piano().concept, style: 'Instrumental, surf rock, 132 BPM, no vocals' } }), corto);
  assert.equal(primo.corpo.style, 'surf rock, 132 BPM', 'nel ritento lo score si chiede come per una canzone');
  assert.match(primo.state.job.concept.style, /^Instrumental/, 'il render resta strumentale');
  assert.equal(primo.state.job.pianoN, 2);
  assert.equal(primo.corpo.duration, 1);
  const ultimo = await controlla(piano({ pianoN: 3 }), corto);
  assert.equal(ultimo.state.job, null);
  assert.equal(ultimo.state.queue[0].pianoFallito, true);
  assert.equal(ultimo.state.queue[0].abc, 'compositore');
  assert.ok(!ultimo.state.queue[0].attempts);
});

test('score fallito sul motore: non conta come render fallito', async () => {
  const r = await controlla(piano({ pianoN: 3 }), '', 'failed');
  assert.ok(!r.state.queue[0].attempts);
  assert.equal(r.state.queue[0].pianoFallito, true);
});

test('mastering: MP3 a 320 kbps con loudness uniforme', async (t) => {
  if (!fs.existsSync(FFMPEG)) return t.skip('ffmpeg assente');
  const dir = fs.mkdtempSync(path.join(RADICE, 'state', 'prova-master-'));
  const wav = path.join(dir, 'a.wav'), mp3 = path.join(dir, 'a.mp3');
  require('child_process').execFileSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', wav]);
  try {
    const r = await master(wav, mp3);
    assert.ok(fs.statSync(mp3).size > 12 * 36000);
    assert.ok(Math.abs(r.lufs - -16) < 1.5, `lufs ${r.lufs}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('modello di testo: margine di token per il ragionamento, risposta troncata segnalata', async () => {
  const prova = (finish, content) => new AF('require', LIB + `let corpo;
    req = async (m, u, o) => { corpo = o.body; return { ok: true, buf: Buffer.from(${JSON.stringify(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] }))}) }; };
    return { j: await llmJson('s', 'u', 1500), corpo };`)(require);
  const r = await prova('stop', '```json\n{"a":1}\n```');
  assert.deepEqual(r.j, { a: 1 });
  assert.equal(r.corpo.max_tokens, 7500);
  await assert.rejects(prova('length', '{"a":{"b":1}, "c'), /troncata/);
});

test('revisione: i bpm proposti restano entro 15 dalla fascia del genere', async () => {
  const dir = fs.mkdtempSync(path.join(RADICE, 'state', 'prova-guida-'));
  const proposta = { bpm_range: { 'Vinyasa-dinamico': '90-180', Meditazione: '20-55', 'Power-yoga': '60-70' } };
  const finta = `log = () => {}; gw = async () => ({ ok: true }); libraryTracks = () => [{ meta: { voto: 5, titolo: 't' } }];
    CFG.guidanceFile = ${JSON.stringify(path.join(dir, 'guidance.json'))}; CFG.historyDir = ${JSON.stringify(dir)};
    llmJson = async () => (${JSON.stringify(proposta)});`;
  const input = { first: () => ({ json: { outcome: 'saved', state: { done: 1, lastVoteMark: 'x' } } }) };
  try {
    await new AF('require', '$input', LIB + finta + '\n' + leggi('src', 'blocks', '04-feedback.js'))(require, input);
    const g = JSON.parse(fs.readFileSync(path.join(dir, 'guidance.json'), 'utf8'));
    // Vinyasa 96-112, Meditazione 45-62, Power-yoga 118-130: una proposta tutta fuori fascia si ignora
    assert.deepEqual(g.bpm_range, { 'Vinyasa-dinamico': '90-127', Meditazione: '30-55' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
