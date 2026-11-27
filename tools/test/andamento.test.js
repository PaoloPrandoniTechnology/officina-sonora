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
  // storia sotto 7 giorni: passo automatico per ora, al massimo 48 punti
  const auto = andamento.calcola({ brani: lista, errori, modifiche, genere: '', passo: '', ora: ORA });
  assert.equal(auto.passo, 'ora');
  assert.equal(auto.punti.length, 48);
  assert.ok(JSON.stringify(auto).indexOf('NaN') < 0);
});
