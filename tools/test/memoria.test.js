// Memoria di composizione: brani dello stesso genere omogenei ma mai uguali, e che imparano dai voti
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../../src/compositore/compositore.js');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (...p) => fs.readFileSync(path.join(RADICE, ...p), 'utf8');
const CAT = JSON.parse(leggi('config', 'catalogo.json'));
const surf = CAT.categories.find((c) => c.name === 'Surf-rock-strumentale');
const richiesta = { cat: surf, bpm: 132, tonalita: 'Mi minore', durata_s: 200, sezioni: CAT.strutture.arco };

// Dodici brani di fila con la stessa memoria
function serie(identita, quanti = 12) {
  const precedenti = [];
  return Array.from({ length: quanti }, (_, i) => {
    const r = C.componi({ ...richiesta, seed: 100 + i, identita, precedenti: [...precedenti] });
    precedenti.push(r.firma);
    return r;
  });
}

test('identità del genere: creata una volta e conservata', () => {
  const id = C.identita(surf, undefined, {}, 5);
  assert.equal(id.progressioni.length, 3);
  assert.ok(id.celle[surf.energia].length === 4 && id.trasformazioni.length === 3);
  assert.deepEqual(C.identita(surf, id, {}, 999), id);
  assert.notDeepEqual(C.identita(surf, undefined, {}, 6), id);
});

test('stesso genere: omogenei (solo elementi dell\'identità) ma mai uguali', () => {
  const id = C.identita(surf, undefined, {}, 5);
  const brani = serie(id);
  for (const b of brani) {
    for (const p of b.parametri.progressioni) assert.ok(id.progressioni.includes(p), `progressione ${p}`);
    for (const c of b.parametri.celle) { const [l, i] = c.split(':').map(Number); assert.ok(id.celle[l].includes(i), `cella ${c}`); }
    for (const t of b.parametri.trasformazioni) assert.ok(id.trasformazioni.includes(t), t);
  }
  assert.equal(new Set(brani.map((b) => b.abc)).size, brani.length);
  assert.equal(new Set(brani.map((b) => b.firma.mosse)).size, brani.length);
  assert.ok(brani.every((b) => b.dettagli.novita > 0));
});

test('un tema già usato non torna: il revisore sceglie altro', () => {
  const id = C.identita(surf, undefined, {}, 5);
  const primo = C.componi({ ...richiesta, seed: 42, identita: id, precedenti: [] });
  const secondo = C.componi({ ...richiesta, seed: 42, identita: id, precedenti: [primo.firma] });
  assert.notEqual(secondo.abc, primo.abc);
  assert.notEqual(secondo.firma.mosse, primo.firma.mosse);
});

test('voti: gli elementi premiati pesano di più, quelli bocciati escono dall\'identità', () => {
  const id = C.identita(surf, undefined, {}, 5);
  const [buona, cattiva] = id.progressioni;
  const brani = [
    { seed: 1, parametri: { progressioni: [buona], celle: [], trasformazioni: [] } },
    { seed: 2, parametri: { progressioni: [cattiva], celle: [], trasformazioni: [] } },
    { seed: 3, parametri: { progressioni: [cattiva], celle: [], trasformazioni: [] } },
    { seed: 4, parametri: { progressioni: [buona], celle: [], trasformazioni: [] } },
  ];
  const pref = C.preferenze(brani, { 1: 5, 2: 1, 3: 2 }); // il brano 4 non ha voto
  assert.ok(C.peso(pref, `prog:${buona}`) > 1 && C.peso(pref, `prog:${cattiva}`) < 1);
  assert.equal(C.peso(pref, 'prog:99'), 1);
  const evoluta = C.identita(surf, id, pref, 7);
  const disponibili = C.quanteProgressioni(surf, 'Mi minore');
  if (disponibili > 3) assert.ok(!evoluta.progressioni.includes(cattiva));
  assert.ok(evoluta.progressioni.includes(buona) && evoluta.progressioni.length === 3);
});

// ---- Blocchi veri, dal workflow generato, con una memoria di prova ----
const AF = Object.getPrototypeOf(async function () {}).constructor;
const FILE = path.join(RADICE, 'state', 'memoria-prova.json');
async function blocco(nome, json) {
  const uscita = path.join(RADICE, 'state', 'wf-prova-memoria.json');
  require('child_process').execFileSync('node', ['build-workflow.mjs', uscita], { cwd: RADICE, stdio: 'ignore' });
  const wf = JSON.parse(fs.readFileSync(uscita, 'utf8'));
  const codice = wf.nodes.find((n) => n.name === nome).parameters.jsCode
    .replace('// BLOCCO', `CFG.comandi = {}; log = () => {}; aggiornaComandi = () => {}; CFG.memoriaFile = ${JSON.stringify(FILE)};\n// BLOCCO`);
  const [r] = await new AF('require', '$input', '$env', codice)(require, { first: () => ({ json }) }, {});
  return r.json;
}

test('blocchi 5a e 5d: la memoria si salva e rende i brani coerenti e diversi', async () => {
  fs.rmSync(FILE, { force: true });
  try {
    const concept = () => ({ titolo: 't', categoria: surf.name, bpm: 132, tonalita: 'Mi minore', durata_s: 200, sezioni: CAT.strutture.arco, lyrics: 'x', vocale: false, attempts: 0 });
    const a = (await blocco('5d Componi score', { state: { job: null, queue: [concept()] } })).state.queue[0];
    const dopoUno = JSON.parse(fs.readFileSync(FILE, 'utf8')).generi[surf.name];
    const b = (await blocco('5d Componi score', { state: { job: null, queue: [concept()] } })).state.queue[0];
    const g = JSON.parse(fs.readFileSync(FILE, 'utf8')).generi[surf.name];
    assert.deepEqual(g.identita, dopoUno.identita);
    assert.equal(g.brani.length, 2);
    assert.notEqual(a.abc, b.abc);
    assert.deepEqual(g.brani[1].parametri, b.score.parametri);

    // strumenti: due fissi per il genere, gli altri cambiano
    const scelte = [];
    for (let i = 0; i < 4; i++) {
      const r = await blocco('5a Scegli ricetta', { state: { job: null, queue: [], recent: [], experiments: [] } });
      if (!scelte.length || r.cat.name === scelte[0].genere) scelte.push({ genere: r.cat.name, strumenti: r.strumenti });
    }
    const memoria = JSON.parse(fs.readFileSync(FILE, 'utf8')).generi;
    for (const [nome, gen] of Object.entries(memoria)) if (gen.nucleo) assert.equal(gen.nucleo.length, 2, nome);
    for (const s of scelte) for (const x of memoria[s.genere].nucleo) assert.ok(s.strumenti.includes(x), `${s.genere}: ${x}`);
  } finally { fs.rmSync(FILE, { force: true }); }
});

test('strumenti: nucleo stabile e combinazione mai ripetuta di seguito', () => {
  const L = new Function('require', leggi('src', 'lib.js') + '\n' + leggi('src', 'lib-apprendimento.js') + '\nreturn { strumentiDelGruppo };')(require);
  const g = {};
  const cat = { strumenti: ['a', 'b', 'c', 'd', 'e'] };
  const scelte = Array.from({ length: 20 }, () => L.strumentiDelGruppo(cat, g));
  for (const s of scelte) assert.ok(g.nucleo.every((x) => s.includes(x)) && s.length >= 3 && new Set(s).size === s.length);
  for (let i = 1; i < scelte.length; i++) assert.notDeepEqual([...scelte[i]].sort(), [...scelte[i - 1]].sort());
});

test('brano troppo corto: il ritento riparte da uno score nostro nuovo', () => {
  const qc = leggi('src', 'blocks', '03a-controllo-qualita.js');
  assert.match(qc, /attempts: 0, tentativi_render: tentativi/);
  assert.doesNotMatch(qc, /abc: meta\.abc/);
});
