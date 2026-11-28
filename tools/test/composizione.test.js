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

test('pagina: l’editor a pulsanti riscrive ogni accordo di serie con lo stesso significato', () => {
  const js = fs.readFileSync(path.join(RADICE, 'gateway', 'composizione-pagina.js'), 'utf8');
  const parte = js.slice(js.indexOf('const GRADI_ROM'), js.indexOf('// riquadro:'));
  const { smonta, monta } = new Function(parte + 'return { smonta, monta };')();
  const { grado } = require('../../src/compositore/armonia.js');
  const accordi = M.unisci({}).filter((v) => v.tipo === 'armonia' || v.tipo === 'richiamo').flatMap((v) => (v.tipo === 'armonia' ? v.testo : v.accordi).split(/[|\s]+/).filter(Boolean));
  assert.ok(accordi.length > 1000);
  for (const a of accordi) assert.deepEqual(grado(monta(smonta(a))), grado(a), a);
});
