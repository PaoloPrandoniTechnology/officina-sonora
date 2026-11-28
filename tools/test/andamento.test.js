// Test della sezione Andamento (calcolo puro, nessun file). Esecuzione: node --test tools/test/andamento.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const andamento = require(path.join(__dirname, '..', '..', 'gateway', 'andamento.js'));

const ORA = Date.parse('2026-11-27T12:00:00Z');
const GIORNO = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// n brani accettati nel periodo (giorni fa), con i voti indicati
function brani(giorniFa, n, campi = () => ({})) {
  return Array.from({ length: n }, (_, i) => ({
    generato_il: iso(ORA - giorniFa * GIORNO - i * 60000),
    scartato: false, categoria: 'Yin', voto: null, durata_s: 200, render_s: 300, ...campi(i),
  }));
}
const conVoti = (giorniFa, voti) => brani(giorniFa, voti.length, (i) => ({ voto: voti[i] }));
const esito = (lista) => andamento.calcola({ brani: lista, errori: [], modifiche: [], genere: '', passo: '', ora: ORA }).esito;
const ripeti = (n, v) => Array(n).fill(v);

test('andamento: voto, servono 10 voti per periodo e 0,2 stelle di differenza', () => {
  assert.equal(esito([...conVoti(10, ripeti(9, 3)), ...conVoti(2, ripeti(9, 4))]).voto, 'dati insufficienti');
  // 10 voti con media 3,3: 7 da 3 e 3 da 4
  const tre3 = [...ripeti(7, 3), ...ripeti(3, 4)];
  assert.equal(esito([...conVoti(10, ripeti(10, 3)), ...conVoti(2, tre3)]).voto, 'migliora');
  const tre1 = [...ripeti(9, 3), 4];
  assert.equal(esito([...conVoti(10, ripeti(10, 3)), ...conVoti(2, tre1)]).voto, 'stabile');
  const tre5 = [...ripeti(5, 3), ...ripeti(5, 4)];
  assert.equal(esito([...conVoti(10, tre5), ...conVoti(2, ripeti(10, 3))]).voto, 'peggiora');
});

test('andamento: scarti, servono 30 brani per periodo e 5 punti di differenza', () => {
  const periodo = (giorniFa, n, scartati) => brani(giorniFa, n, (i) => ({ scartato: i < scartati }));
  assert.equal(esito([...periodo(10, 30, 9), ...periodo(2, 30, 6)]).scarti, 'migliora');
  assert.equal(esito([...periodo(10, 30, 6), ...periodo(2, 30, 9)]).scarti, 'peggiora');
  assert.equal(esito([...periodo(10, 30, 9), ...periodo(2, 30, 8)]).scarti, 'stabile');
  assert.equal(esito([...periodo(10, 29, 9), ...periodo(2, 30, 6)]).scarti, 'dati insufficienti');
});

test('andamento: resa e quota di scarti di un intervallo', () => {
  const lista = [
    { generato_il: iso(ORA - 3600000), scartato: false, categoria: 'Yin', voto: 4, durata_s: 200, render_s: 300 },
    { generato_il: iso(ORA - 3500000), scartato: true, categoria: 'Yin', voto: 1, durata_s: 50, render_s: 100 },
  ];
  const r = andamento.calcola({ brani: lista, errori: [], modifiche: [], genere: '', passo: 'ora', ora: ORA });
  assert.equal(r.passo, 'ora');
  const p = r.punti.find((x) => x.brani > 0);
  assert.equal(p.resa, 2);
  assert.equal(p.scartoPct, 50);
  assert.equal(p.voto, 4, 'il voto viene solo dai brani accettati');
  assert.equal(p.votati, 1);
  const vuoto = r.punti.find((x) => x.brani === 0);
  assert.deepEqual([vuoto.voto, vuoto.scartoPct, vuoto.resa], [null, null, null]);
});

test('andamento: la resa conta solo i brani con render_s', () => {
  const lista = [
    { generato_il: iso(ORA - 3600000), scartato: false, categoria: 'Yin', voto: null, durata_s: 200, render_s: 300 },
    { generato_il: iso(ORA - 3500000), scartato: false, categoria: 'Yin', voto: null, durata_s: 200, render_s: null },
  ];
  const r = andamento.calcola({ brani: lista, errori: [], modifiche: [], genere: '', passo: 'ora', ora: ORA });
  assert.equal(r.punti.find((x) => x.brani > 0).resa, 1.5);
  const senza = andamento.calcola({ brani: [lista[1]], errori: [], modifiche: [], genere: '', passo: 'ora', ora: ORA });
  assert.equal(senza.punti.find((x) => x.brani > 0).resa, null);
});

test('andamento: fine dell\'ora legale, le due ore 02:00 restano separate', () => {
  const { spawnSync } = require('child_process');
  const codice = `
    const a = require(${JSON.stringify(path.join(__dirname, '..', '..', 'gateway', 'andamento.js'))});
    const b = (t) => ({ generato_il: t, scartato: false, categoria: 'Yin', voto: null, durata_s: 100, render_s: 100 });
    // 00:30Z = 02:30 ora legale, 01:30Z = 02:30 ora solare (Roma, 25 ottobre 2026)
    const r = a.calcola({ brani: [b('2026-10-24T22:10:00Z'), b('2026-10-25T00:30:00Z'), b('2026-10-25T01:30:00Z')], errori: [], modifiche: [], genere: '', passo: 'ora', ora: Date.parse('2026-10-25T03:30:00Z') });
    console.log(JSON.stringify(r.punti.map((p) => [p.da, p.brani])));`;
  const out = spawnSync(process.execPath, ['-e', codice], { env: { ...process.env, TZ: 'Europe/Rome' }, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const punti = JSON.parse(out.stdout);
  assert.deepEqual(punti.map((p) => p[0]), ['2026-10-24T22:00:00.000Z', '2026-10-24T23:00:00.000Z', '2026-10-25T00:00:00.000Z', '2026-10-25T01:00:00.000Z', '2026-10-25T02:00:00.000Z', '2026-10-25T03:00:00.000Z']);
  assert.deepEqual(punti.map((p) => p[1]), [1, 0, 1, 1, 0, 0]);
});

test('andamento: una modifica delle linee guida dalla plancia compare una volta', () => {
  const T = Date.parse('2026-11-20T10:00:00Z');
  const modifiche = [{ ts: iso(T), sezione: 'linee guida', chiave: 'style_extra' }];
  andamento.aggiungiGuide(modifiche, [
    { nome: 'guidance.json', versione: 3, aggiornato: iso(T + 2000) },
    { nome: 'guidance-v2.json', versione: 2, aggiornato: iso(T - 86400000) },
    { nome: 'guidance-v2b.json', versione: 2, aggiornato: iso(T - 86400000) },
    { nome: 'guidance-x.json' },
  ]);
  assert.deepEqual(modifiche.map((m) => m.chiave), ['style_extra', 'versione 2']);
});

test('andamento: soglia del voto senza arrotondamenti, giudizio uguale per ora e per giorno', () => {
  // 3,0 contro 3,196: differenza 0,196, sotto 0,2
  const dopo = [...ripeti(49, 4), ...ripeti(201, 3)];
  assert.equal(esito([...conVoti(10, ripeti(10, 3)), ...conVoti(2, dopo)]).voto, 'stabile');
  // 14 giorni di dati: i punti per ora sono solo 48, ma il giudizio usa tutti i brani
  const lista = [...conVoti(12, ripeti(10, 3)), ...conVoti(5, [...ripeti(7, 3), ...ripeti(3, 4)])];
  const per = (passo) => andamento.calcola({ brani: lista, errori: [], modifiche: [], genere: '', passo, ora: ORA }).esito;
  const orari = andamento.calcola({ brani: lista, errori: [], modifiche: [], genere: '', passo: 'ora', ora: ORA });
  assert.deepEqual([orari.punti.length, orari.troncato], [168, true]);
  assert.deepEqual(per('ora'), per('giorno'));
  assert.equal(per('ora').voto, 'migliora');
});

test('andamento: lista vuota e filtro genere', () => {
  const r = andamento.calcola({ brani: [], errori: [{ ts: iso(ORA - 1000) }], modifiche: [], genere: '', passo: '', ora: ORA });
  assert.deepEqual(r.punti, []);
  assert.deepEqual(r.esito, { voto: 'dati insufficienti', scarti: 'dati insufficienti' });

  const lista = [...brani(3, 4), ...brani(1, 2, () => ({ categoria: 'Power' }))];
  const errori = [{ ts: iso(ORA - 2 * GIORNO) }, { ts: iso(ORA - GIORNO / 2) }, { ts: 'non una data' }];
  const modifiche = [
    { ts: iso(ORA - GIORNO), sezione: 'parametri', chiave: 'durMin' },
    { ts: iso(ORA - GIORNO), sezione: 'voti', chiave: '5 X' },
    { ts: iso(ORA - GIORNO), sezione: 'comandi', chiave: 'pausa' },
    { ts: iso(ORA - 400 * GIORNO), sezione: 'generi', chiave: 'Yin' },
  ];
  const tutti = andamento.calcola({ brani: lista, errori, modifiche, genere: '', passo: 'giorno', ora: ORA });
  const power = andamento.calcola({ brani: lista, errori, modifiche, genere: 'Power', passo: 'giorno', ora: ORA });
  assert.deepEqual(power.punti.map((p) => p.errori), tutti.punti.map((p) => p.errori));
  assert.equal(tutti.punti.reduce((a, p) => a + p.errori, 0), 2);
  assert.equal(power.punti.reduce((a, p) => a + p.brani, 0), 2);
  assert.deepEqual(tutti.modifiche.map((m) => m.sezione), ['parametri']);
  // storia sotto 7 giorni: passo automatico per ora, dal primo brano a adesso
  const auto = andamento.calcola({ brani: lista, errori, modifiche, genere: '', passo: '', ora: ORA });
  assert.equal(auto.passo, 'ora');
  assert.deepEqual([auto.punti.length, auto.troncato], [74, false]);
  assert.ok(JSON.stringify(auto).indexOf('NaN') < 0);
});

test('andamento: filtro periodo, confronto con il periodo precedente e filtri combinati', () => {
  const lista = [
    ...brani(1, 3, (i) => ({ tipo: 'drone', ambito: 'yoga', scartato: i === 0, problemi: i === 0 ? ['durata 69s troppo corta rispetto a 260s'] : [], voto: i === 1 ? 5 : null, tentativi: i, richiesta_s: 250, caricato: i > 0, ascolti: 2 })),
    ...brani(10, 2, () => ({ tipo: 'drone', ambito: 'yoga' })),
    ...brani(1, 4, () => ({ tipo: 'loop', ambito: 'sottofondo', categoria: 'Power' })),
  ];
  const base = { brani: lista, errori: [{ ts: iso(ORA - GIORNO), key: 'x' }, { ts: iso(ORA - 9 * GIORNO), key: 'x' }], modifiche: [], ora: ORA };
  const r = andamento.calcola({ ...base, periodo: '7', ambito: 'yoga', tipo: 'drone' });
  assert.deepEqual([r.riepilogo.brani, r.riepilogo.scartati, r.precedente.brani, r.riepilogo.errori, r.precedente.errori], [3, 1, 2, 1, 1]);
  assert.deepEqual([r.riepilogo.voto, r.riepilogo.coperturaPct, r.riepilogo.rigeneratiPct, r.riepilogo.durataPct, r.riepilogo.caricatiPct, r.riepilogo.ascolti], [5, 50, 66.7, 80, 100, 4]);
  assert.deepEqual(r.distribuzione, [0, 0, 0, 0, 1]);
  assert.deepEqual(r.motivi, [{ nome: 'durata #s troppo corta rispetto a #s', valore: 1 }]);
  assert.deepEqual(r.erroriTop, [{ nome: 'x', valore: 1 }]);
  assert.deepEqual(r.perGenere.map((g) => [g.genere, g.brani]), [['Yin', 3]]);
  assert.equal(r.punti.reduce((a, p) => a + p.brani, 0), 3);
  const tutto = andamento.calcola({ ...base, periodo: '' });
  assert.deepEqual([tutto.riepilogo.brani, tutto.precedente], [9, null]);
  // oltre 7 giorni il passo e' per giorno anche se richiesto per ora
  assert.equal(andamento.calcola({ ...base, periodo: '30', passo: 'ora' }).passo, 'giorno');
});
