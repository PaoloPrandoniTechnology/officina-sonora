// Materiale musicale: voci di serie valide, controlli, modifiche dalla dashboard e loro uso nel compositore
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../src/compositore/abc.js');
const M = require('../../src/compositore/materiale.js');
const E = require('../../src/compositore/estro.js');

const RADICE = path.join(__dirname, '..', '..');
const CAT = JSON.parse(fs.readFileSync(path.join(RADICE, 'config', 'catalogo.json'), 'utf8'));
const dir = fs.mkdtempSync(path.join(RADICE, 'state', 'prova-composizione-'));
process.env.OFS_COMPOSIZIONE = path.join(dir, 'composizione.json');
process.env.OFS_STORICO = path.join(dir, 'storico.jsonl');
const G = require('../../gateway/composizione.js');
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const pulisci = () => fs.rmSync(process.env.OFS_COMPOSIZIONE, { force: true });
const voce = (id) => G.lettura().voci.find((v) => v.id === id);

test('le voci di serie sono tutte valide, con identificativi unici, e si ascoltano', () => {
  const voci = M.unisci({});
  assert.deepEqual(voci.filter((v) => v.errore), []);
  assert.equal(new Set(voci.map((v) => v.id)).size, voci.length);
  for (const v of voci) {
    const r = G.gestisci('prova', v);
    assert.deepEqual(A.leggiAbc(r.abc).errori, [], v.id);
  }
});

test('controlli: errori leggibili per ogni tipo', () => {
  const casi = [
    [{ tipo: 'armonia', stile: 'rock', modo: 'm', ruolo: 'rit', testo: 'i | V' }, /servono 8 battute/],
    [{ tipo: 'armonia', stile: 'rock', modo: 'm', ruolo: 'pre', testo: 'i | V | Z | i' }, /non riconosciuto/],
    [{ tipo: 'armonia', stile: 'pop', modo: 'm', ruolo: 'pre', testo: 'i | V | i | V' }, /stile non valido/],
    [{ tipo: 'motivo', andamento: 'dritto', testo: '8 8 | 16 16' }, /fanno 16 invece di 32/],
    [{ tipo: 'cadenza', testo: '16~ 16 | 32' }, /ultima nota/],
    [{ tipo: 'assolo', ritmo: '16 16', gesti: 'x' }, /servono 2 lettere/],
    [{ tipo: 'richiamo', nome: 'a', modo: 'M', accordi: 'I', note: 'Do9:32', stili: ['rock'] }, /non riconosciuta/],
    [{ tipo: 'richiamo', nome: 'a', modo: 'M', accordi: 'I | V', note: 'Do4:32', stili: ['rock'] }, /servono 1 battute/],
    [{ tipo: 'forma', nome: 'a', testo: 'gancio:4:0 rit:8:0 strofa:8:0', stili: ['rock'] }, /finale/],
    [{ tipo: 'forma', nome: '<b>', testo: 'gancio:4:0 rit:8:0 finale:4:0', stili: ['rock'] }, /con < >/],
    [{ tipo: 'altro' }, /sconosciuto/],
  ];
  for (const [v, atteso] of casi) assert.throws(() => M.controlla(v), atteso, JSON.stringify(v));
});

test('dashboard: modifica, spegni, ripristina, crea ed elimina; una voce non valida non si salva', () => {
  pulisci();
  const id = 'armonia:rock:m:rit:0';
  const originale = voce(id).testo;
  const nuovo = 'i | iv | i | iv | i | iv | V | i';
  G.gestisci('salva', { ...voce(id), testo: nuovo });
  assert.deepEqual([voce(id).testo, voce(id).modificata, voce(id).serie], [nuovo, true, true]);
  assert.throws(() => G.gestisci('salva', { ...voce(id), testo: 'i' }), /servono 8/);
  assert.equal(voce(id).testo, nuovo);
  G.gestisci('attiva', { id, attivo: false });
  assert.equal(voce(id).attivo, false);
  G.gestisci('ripristina', { id });
  assert.deepEqual([voce(id).testo, voce(id).attivo, !!voce(id).modificata], [originale, true, false]);
  assert.throws(() => G.gestisci('elimina', { id }), /si spengono/);
  const { id: tua } = G.gestisci('salva', { tipo: 'assolo', ritmo: '8 8 8 8', gesti: 'x p a c' });
  assert.deepEqual([voce(tua).serie, voce(tua).gesti], [false, 'xpac']);
  G.gestisci('elimina', { id: tua });
  assert.equal(voce(tua), undefined);
  assert.throws(() => G.gestisci('elimina', { id: 'assolo:nessuna' }), /non trovata/);
  assert.ok(fs.readFileSync(process.env.OFS_STORICO, 'utf8').includes('"composizione"'));
});

test('file rovinato: il gateway non lo sovrascrive; voci non valide ignorate in produzione', () => {
  fs.writeFileSync(process.env.OFS_COMPOSIZIONE, '{ rotto');
  assert.throws(() => G.gestisci('salva', { tipo: 'cadenza', testo: '32 | 32' }), /illeggibile/);
  assert.equal(fs.readFileSync(process.env.OFS_COMPOSIZIONE, 'utf8'), '{ rotto');
  const p = M.pronto({ modifiche: { 'cadenza:0': { testo: 'xxx' } }, nuove: [{ id: 'assolo:z', tipo: 'assolo', ritmo: '1', gesti: 'x' }] });
  assert.ok(!p.cadenze.includes('xxx') && p.lick.every(([r]) => r !== '1'));
  pulisci();
});

test('il compositore usa le modifiche: accordi, richiami e forme tue; un gruppo tutto spento usa quelli di serie', () => {
  const cat = CAT.categories.find((c) => c.name === 'Hard-rock-strumentale');
  const serie = M.unisci({});
  const spente = Object.fromEntries(serie.filter((v) => (v.tipo === 'armonia' && v.stile === 'rock') || v.tipo === 'forma' || v.tipo === 'richiamo').map((v) => [v.id, { attivo: false }]));
  const mio = (ruolo, i) => ({ id: `armonia:mio${i}`, tipo: 'armonia', stile: 'rock', modo: 'm', ruolo, testo: ruolo === 'pre' ? 'bII | bII | bII | bII' : 'bII | bII | bII | bII | bII | bII | bII | bII' });
  const utente = {
    modifiche: spente,
    nuove: [...['strofa', 'pre', 'rit', 'ponte'].map(mio),
      { id: 'forma:mia', tipo: 'forma', nome: 'Mia', testo: 'gancio:4:0 strofa:8:0 ponte:8:0 finale:4:0', stili: ['rock'] },
      { id: 'richiamo:mio', tipo: 'richiamo', nome: 'Il mio', modo: 'm', accordi: 'i', note: 'Do4:16 Sol4:16', stili: ['rock'] }],
  };
  const materiale = M.pronto(utente);
  let conRichiamo = null;
  for (let seed = 1; seed <= 20 && !conRichiamo; seed++) {
    const r = E.componi({ cat, bpm: 120, tonalita: 'La minore', durata_s: 60, estro: 2, seed, materiale, candidati: 3 });
    assert.equal(r.parametri.forma, 'mia');
    assert.match(r.abc, /"Bb"/);
    if (r.cameo) conRichiamo = r;
  }
  assert.equal(conRichiamo.cameo.nome, 'Il mio');
  // tutto spento e niente di nuovo: restano i valori di serie
  assert.deepEqual(M.pronto({ modifiche: spente }).armonia.rock.m.rit, M.pronto({}).armonia.rock.m.rit);
});

test('prova di una forma: un brano intero del genere scelto', () => {
  const r = G.gestisci('prova', { tipo: 'forma', nome: 'x', testo: 'gancio:4:0 rit:8:0 finale:4:0', stili: ['jazz'] });
  assert.ok(r.genere);
  assert.deepEqual(A.leggiAbc(r.abc).errori, []);
});

test('lettura: stili con i generi che li usano, e la pagina è collegata', () => {
  const l = G.lettura();
  assert.ok(l.stili.find((s) => s.id === 'rock').generi.some((g) => g.nome === 'Hard-rock-strumentale'));
  const html = fs.readFileSync(path.join(RADICE, 'gateway', 'dashboard.html'), 'utf8');
  const server = fs.readFileSync(path.join(RADICE, 'gateway', 'server.js'), 'utf8');
  assert.ok(html.includes('t-composizione') && html.includes('/composizione-pagina.js'));
  assert.ok(server.includes("'/composizione-pagina.js'") && server.includes('/api/composizione/'));
});

// ---- editor a pulsanti: il suo modello deve rileggere ogni voce senza alterarla ----
const Ed = require('../../gateway/composizione-editor.js');

test('editor: ogni voce di serie, letta e riscritta, resta identica per il compositore', () => {
  for (const v of M.unisci({})) {
    const campi = Ed.campiDi(Ed.modelloDi(v));
    const dopo = M.controlla({ ...v, ...campi });
    const prima = M.controlla(v);
    if (v.tipo === 'armonia') assert.deepEqual(M.periodoDi(dopo.testo, v.ruolo === 'pre' ? 4 : 8), M.periodoDi(prima.testo, v.ruolo === 'pre' ? 4 : 8), v.id);
    else if (v.tipo === 'richiamo') {
      assert.deepEqual(M.noteDi(dopo.note), M.noteDi(prima.note), v.id);
      assert.deepEqual(M.periodoDi(dopo.accordi, M.noteDi(dopo.note).length), M.periodoDi(prima.accordi, M.noteDi(prima.note).length), v.id);
    } else assert.deepEqual(dopo, prima, v.id);
  }
});

test('editor: note posizionate e figure sono la stessa cosa, per ogni voce di serie', () => {
  for (const v of M.unisci({}).filter((x) => ['motivo', 'cadenza', 'assolo', 'richiamo'].includes(x.tipo))) {
    const m = Ed.modelloDi(v);
    const figure = m.figure.map((b) => Ed.inFigure(Ed.inNote(b), v.tipo));
    assert.deepEqual(Ed.campiDi({ ...m, figure }), Ed.campiDi(m), v.id);
  }
});

test('editor: posare, spostare e allungare note a caso lascia battute complete a voce sola', () => {
  let seme = 11;
  const caso = (n) => { seme = (seme * 48271) % 2147483647; return seme % n; };
  for (const tipo of ['motivo', 'assolo', 'richiamo']) {
    const base = M.unisci({}).find((v) => v.tipo === tipo);
    const m = Ed.modelloDi(base);
    const note = m.figure.map(Ed.inNote);
    for (let passo = 0; passo < 600; passo++) {
      const b = caso(note.length), pos = caso(32), d = 1 + caso(32 - pos);
      const nuova = { pos, d, app: !caso(4), ant: !caso(4), ...(tipo === 'richiamo' ? { midi: Ed.MIN + caso(37) } : {}), ...(tipo === 'assolo' ? { g: 'xpnascr'[caso(7)] } : {}) };
      if (caso(5) === 0 && note[b].length > 1) note[b].splice(caso(note[b].length), 1); else note[b] = Ed.posa(note[b], nuova);
      note[b].forEach((n, i) => assert.ok(n.d >= 1 && n.pos >= 0 && n.pos + n.d <= 32 && (!i || n.pos >= note[b][i - 1].pos + note[b][i - 1].d), `${tipo} ${passo}: ${JSON.stringify(note[b])}`));
      const campi = Ed.campiDi({ ...m, figure: note.map((x) => Ed.inFigure(x, tipo)) });
      assert.doesNotThrow(() => M.controlla({ ...base, ...campi }), `${tipo} passo ${passo}: ${JSON.stringify(campi)}`);
    }
  }
});

test('editor: una nota posata sopra accorcia, sposta o cancella quelle sotto', () => {
  const n = (pos, d) => ({ pos, d });
  assert.deepEqual(Ed.posa([n(0, 8), n(8, 8), n(16, 16)], n(4, 16)), [n(0, 4), n(4, 16), n(20, 12)]);
  assert.deepEqual(Ed.posa([n(0, 32)], n(8, 8)), [n(0, 8), n(8, 8)]);
  assert.equal(Ed.scriviRitmo([Ed.inFigure([{ pos: 4, d: 4 }, { pos: 24, d: 8, ant: true }], 'motivo')]), '-4 4 -16 8~');
});

test('prova di una forma: tante battute quante ne sono disegnate, per ogni forma di serie', () => {
  for (const v of M.unisci({}).filter((x) => x.tipo === 'forma')) {
    const attese = M.formaDi(v.testo).reduce((a, x) => a + x.battute, 0);
    assert.equal(A.analizza(G.gestisci('prova', v).abc).battute, attese, v.id);
  }
});

// ---- timeline di riproduzione: ciò che mostra è ciò che si sente ----
const Lt = require('../../gateway/composizione-lettore.js');

test('riproduzione: accordo, nota, battuta e battito giusti istante per istante', () => {
  const score = { bpm: 120, metro: '4/4', tonalita: 'C', sezioni: [{ nome: 'verse', battute: [
    { accordi: [{ pos: 0, sigla: 'C' }, { pos: 16, sigla: 'G7' }], vocal: null, ins: [{ midi: 60, durata: 8 }, { midi: null, durata: 8 }, { midi: 64, durata: 16, lega: true }] },
    { accordi: [{ pos: 0, sigla: 'Am' }], vocal: null, ins: [{ midi: 64, durata: 32 }] },
  ] }] };
  const ev = Lt.eventi(score);
  assert.equal(ev.totale, 4);
  assert.deepEqual(ev.note.map((n) => [n.midi, n.t, n.durata]), [[60, 0, 0.5], [64, 1, 3]], 'le note legate sono una sola');
  const a = (t) => { const p = Lt.posizione(ev, t); return [p.battuta, p.battito, p.nota < 0 ? null : ev.note[p.nota].midi, Lt.nomeAccordo(ev.accordi[p.accordo].sigla)]; };
  assert.deepEqual(a(0), [0, 0, 60, 'Do maggiore']);
  assert.deepEqual(a(0.75), [0, 1, null, 'Do maggiore']);
  assert.deepEqual(a(1.5), [0, 3, 64, 'Sol settima']);
  assert.deepEqual(a(2.6), [1, 1, 64, 'La minore']);
  assert.deepEqual(a(3.999), [1, 3, 64, 'La minore'], 'fino all’ultimo istante');
  assert.deepEqual(['Bbm7', 'F#m7b5', 'D/F#', 'Ebmaj7'].map(Lt.nomeAccordo), ['Sib minore settima', 'Fa# semidiminuito', 'Re maggiore, basso Fa#', 'Mib maggiore settima']);
});

test('riproduzione: ogni voce di serie si lascia seguire dall\'inizio alla fine, e la pagina carica il lettore', () => {
  for (const v of M.unisci({}).filter((_, i) => i % 7 === 0)) {
    const ev = Lt.eventi(A.leggiAbc(G.gestisci('prova', v).abc).score);
    assert.ok(ev.battute.length && ev.accordi.length, v.id);
    for (let t = 0; t < ev.totale; t += ev.totale / 50) {
      const p = Lt.posizione(ev, t);
      assert.ok(p.battuta >= 0 && p.quota >= 0 && p.quota < 1 && p.accordo >= 0, `${v.id} ${t}`);
    }
  }
  for (const f of ['dashboard.html', 'server.js']) assert.ok(fs.readFileSync(path.join(RADICE, 'gateway', f), 'utf8').includes('composizione-lettore.js'), f);
});

test('riproduzione: i tasti accesi sono quelli che suonano e la tastiera li contiene tutti', () => {
  for (const v of M.unisci({}).filter((_, i) => i % 5 === 0)) {
    const ev = Lt.eventi(A.leggiAbc(G.gestisci('prova', v).abc).score);
    const [min, max] = Lt.estensione(ev);
    assert.deepEqual([min % 12, max % 12], [0, 11], v.id);
    for (let i = 0; i < 40; i++) {
      const t = (i * ev.totale) / 40;
      const p = Lt.posizione(ev, t), k = Lt.tastiDi(ev, p);
      assert.equal(k.melodia, p.nota < 0 ? null : ev.note[p.nota].midi, v.id);
      for (const m of [...k.accordo, ...(k.melodia === null ? [] : [k.melodia])]) assert.ok(m >= min && m <= max, `${v.id}: ${m}`);
      assert.ok(k.accordo.length >= 4, v.id);
    }
  }
});

test('riproduzione: la riga segue ciò che esce dalle casse, mai più avanti dell’orologio audio', () => {
  // la scheda audio dice cosa sta uscendo: 2,0 s al millisecondo 1000; 40 ms dopo sono 2,04
  const ctx = { currentTime: 2.1, getOutputTimestamp: () => ({ contextTime: 2, performanceTime: 1000 }) };
  assert.ok(Math.abs(Lt.tempoUdibile(ctx, 1040) - 2.04) < 1e-9);
  assert.equal(Lt.tempoUdibile(ctx, 9000), 2.1);
  // senza quella informazione si toglie il ritardo dichiarato
  assert.ok(Math.abs(Lt.tempoUdibile({ currentTime: 3, outputLatency: 0.2 }, 0) - 2.8) < 1e-9);
  assert.ok(Math.abs(Lt.tempoUdibile({ currentTime: 3, baseLatency: 0.01, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 5) - 2.99) < 1e-9);
});
