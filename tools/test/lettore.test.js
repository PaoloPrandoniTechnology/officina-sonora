// Coda di ascolto (casuale, ripeti, coda a mano) e playlist salvate dal gateway.
//   node --test tools/test/lettore.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GW = path.join(__dirname, '..', '..', 'gateway');
const C = require(path.join(GW, 'coda.js'));
const playlist = require(path.join(GW, 'playlist.js'));

const caso = () => 0; // mescolanza prevedibile
const parti = (lista, numero, extra = {}) => { const s = Object.assign(C.nuova(), extra); C.avvia(s, lista, numero, 'Prova', caso); return s; };
const giro = (s, quanti, auto = true) => Array.from({ length: quanti }, () => C.avanti(s, auto, caso));

test('coda: scorre l\'elenco e si ferma in fondo', () => {
  const s = parti([1, 2, 3], 2);
  assert.deepEqual(giro(s, 2), [3, null]);
  assert.equal(s.corrente, 3);
  assert.equal(C.indietro(s), 2);
  assert.equal(C.indietro(s), 1);
  assert.equal(C.indietro(s), null);
});

test('coda: ripeti tutto ricomincia, ripeti uno resta ma «avanti» passa oltre', () => {
  const s = parti([1, 2], 2, { ripeti: 'tutti' });
  assert.deepEqual(giro(s, 3), [1, 2, 1]);
  assert.equal(C.indietro(s), 2);
  s.ripeti = 'uno';
  assert.deepEqual(giro(s, 2), [2, 2]);
  assert.equal(C.avanti(s, false), 1);
});

test('coda: i brani messi in coda passano davanti, poi l\'elenco riprende', () => {
  const s = parti([1, 2, 3], 1);
  C.accoda(s, [8], false);
  C.accoda(s, [9], true);
  assert.deepEqual(giro(s, 4), [9, 8, 2, 3]);
  const t = parti([1, 2], 1);
  C.accoda(t, [9], false);
  C.avanti(t, false);
  assert.equal(C.indietro(t), 1);
  assert.equal(C.avanti(t, false), 9);
});

test('coda: casuale tiene il brano in corso, suona tutti una volta, e spento torna in ordine', () => {
  const s = parti([1, 2, 3, 4, 5], 3);
  C.casuale(s, true, Math.random);
  assert.equal(s.ordine[0], 3);
  const suonati = giro(s, 4);
  assert.deepEqual([3, ...suonati].sort(), [1, 2, 3, 4, 5]);
  assert.equal(C.avanti(s, true), null);
  C.casuale(s, false);
  assert.deepEqual(s.ordine, [1, 2, 3, 4, 5]);
  assert.equal(s.ordine[s.i], s.corrente);
  const t = parti([1, 2, 3], null, { casuale: true, ripeti: 'tutti' });
  let prima = t.corrente;
  for (let i = 0; i < 40; i++) { const n = C.avanti(t, true); assert.notEqual(n, prima); prima = n; }
});

test('coda: togli, sposta e salta valgono su coda a mano ed elenco', () => {
  const s = parti([1, 2, 3, 4], 1);
  C.accoda(s, [7, 8, 9], false);
  C.sposta(s, 'coda', 2, 0);
  C.togli(s, 'coda', 1);
  assert.deepEqual(s.prossimi, [9, 8]);
  C.sposta(s, 'dopo', 2, 0);
  C.togli(s, 'dopo', 1);
  assert.deepEqual(C.dopo(s), [4, 3]);
  C.casuale(s, true, caso);
  C.casuale(s, false);
  assert.deepEqual(C.dopo(s), [4, 3]); // l'ordine scelto a mano resta
  assert.equal(C.salta(s, 'coda', 1), 8);
  assert.deepEqual(s.prossimi, []);
  assert.equal(C.salta(s, 'dopo', 1), 3);
  assert.equal(C.salta(s, 'dopo', 5), null);
});

test('coda: i brani spariti si tolgono e lo stato salvato rovinato si scarta', () => {
  const s = parti([1, 2, 3, 4], 3);
  C.accoda(s, [2, 9], false);
  C.pulisci(s, (n) => n !== 2);
  assert.deepEqual([s.ordine, s.ordine[s.i], s.prossimi], [[1, 3, 4], 3, [9]]);
  assert.deepEqual(C.ripristina(JSON.parse(JSON.stringify(s))), s);
  for (const rotto of [null, 'x', { lista: 'no' }, { lista: [], ordine: [{}], prossimi: [] }]) assert.deepEqual(C.ripristina(rotto), C.nuova());
});

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pl-')), 'playlist.json');

test('playlist: crea, aggiunge senza doppioni, riordina, toglie, elimina', () => {
  const f = file();
  const { id } = playlist.gestisci('crea', { nome: '  Lezione  ', brani: [2, 2, 1] }, f);
  assert.equal(playlist.gestisci('aggiungi', { id, brani: [1, 3] }, f).aggiunti, 1);
  playlist.gestisci('ordina', { id, brani: [3, 1, 2] }, f);
  assert.throws(() => playlist.gestisci('ordina', { id, brani: [3, 1] }, f), /cambiata/);
  playlist.gestisci('togli', { id, brani: [1] }, f);
  playlist.gestisci('modifica', { id, nome: 'Yin', descrizione: 'sera' }, f);
  const [p] = playlist.leggi(f).playlist;
  assert.deepEqual([p.nome, p.descrizione, p.brani], ['Yin', 'sera', [3, 2]]);
  assert.deepEqual(playlist.gestisci('elimina', { id }, f).dati.playlist, []);
  assert.throws(() => playlist.gestisci('elimina', { id }, f), /non trovata/);
});

test('playlist: i preferiti vanno in testa e si tolgono', () => {
  const f = file();
  playlist.gestisci('preferito', { brani: [1], si: true }, f);
  playlist.gestisci('preferito', { brani: [2], si: true }, f);
  playlist.gestisci('preferito', { brani: [2], si: true }, f);
  assert.deepEqual(playlist.leggi(f).preferiti, [2, 1]);
  assert.deepEqual(playlist.gestisci('preferito', { brani: [2], si: false }, f).dati.preferiti, [1]);
});

test('playlist: dati non validi rifiutati; un file rovinato non viene sovrascritto', () => {
  const f = file();
  for (const [azione, r] of [['crea', { nome: ' ' }], ['crea', { nome: 'x'.repeat(81) }], ['crea', { nome: 'a', brani: ['1'] }], ['preferito', { brani: [-1], si: true }], ['boh', {}]]) {
    assert.throws(() => playlist.gestisci(azione, r, f));
  }
  assert.equal(fs.existsSync(f), false);
  fs.writeFileSync(f, '{ rotto');
  assert.throws(() => playlist.gestisci('crea', { nome: 'a' }, f), /illeggibile/);
  assert.equal(fs.readFileSync(f, 'utf8'), '{ rotto');
});

test('esportazione M3U: una riga di descrizione e il percorso per brano', () => {
  assert.equal(playlist.m3u([{ titolo: 'Alba\nnuova', durata_s: 61.4, percorso: 'E:\\a.mp3' }]), '#EXTM3U\r\n#EXTINF:61,Alba nuova\r\nE:\\a.mp3\r\n');
});
