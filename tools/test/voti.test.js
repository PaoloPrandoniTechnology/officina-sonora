// Test dei voti: l'unica fonte e' il .json del brano. Scritture solo su un file temporaneo in state\ del repository.
//   node --test tools/test/voti.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');
const codice = ['lib.js', 'lib-apprendimento.js']
  .map((f) => fs.readFileSync(path.join(RADICE, 'src', f), 'utf8'))
  .join('\n');
const ctx = vm.createContext({ require, console, process, Buffer, setTimeout, clearTimeout, URL, Promise });
vm.runInContext(codice, ctx);
const L = vm.runInContext('({ votoUtente, applicaSegnale, firmaVoti, aggiornaScheda })', ctx);

test('omonimi: il voto resta su un solo brano', () => {
  const a = { audio: 'eco', meta: { voto: 5 } };
  const b = { audio: 'eco', meta: { voto: null } };
  assert.equal(L.votoUtente(a), 5);
  assert.equal(L.votoUtente(b), null);
});

test('vince l\'ultimo', () => {
  const meta = { voto: null };
  const segnale = (voto) => ({ voto, fonte: 'valutazione iBroadcast' });
  assert.equal(L.applicaSegnale(meta, segnale(4), 't1'), true);
  assert.deepEqual(meta, { voto: 4, voto_ib: 4, voto_fonte: 'valutazione iBroadcast', voto_il: 't1' });

  meta.voto = 2;
  meta.voto_fonte = 'dashboard';
  assert.equal(L.applicaSegnale(meta, segnale(4), 't2'), false);
  assert.equal(meta.voto, 2);

  assert.equal(L.applicaSegnale(meta, segnale(5), 't3'), true);
  assert.equal(meta.voto, 5);

  assert.equal(L.applicaSegnale(meta, null, 't4'), false);
  assert.equal(meta.voto, 5);
  assert.equal(meta.voto_ib, null);

  assert.equal(L.applicaSegnale(meta, segnale(5), 't5'), false);
  assert.equal(meta.voto_ib, 5);
  assert.equal(meta.voto_il, 't3');
});

test('firma: cambia correggendo un voto', () => {
  const tracce = [
    { meta: { voto: 4, voto_il: '2026-11-01T10:00:00.000Z' } },
    { meta: { voto: 3 } },
    { meta: { voto: null } },
  ];
  assert.equal(L.firmaVoti(tracce), '2|2026-11-01T10:00:00.000Z');
  tracce[1].meta = { voto: 1, voto_il: '2026-11-02T10:00:00.000Z' };
  assert.equal(L.firmaVoti(tracce), '2|2026-11-02T10:00:00.000Z');
  assert.equal(L.firmaVoti([]), '0|');
});

// Esegue un blocco vero su una libreria temporanea, con il gateway finto.
// dopoLettura simula un altro processo che scrive appena il blocco ha letto una scheda.
async function eseguiBlocco(nome, { gw, input = {}, dopoLettura = () => {}, cfg = {} }, dir) {
  const finto = { ...fs, readFileSync: (f, ...a) => { const r = fs.readFileSync(f, ...a); dopoLettura(f); return r; } };
  const c = vm.createContext({ require: (m) => (m === 'fs' ? finto : require(m)), console, process, Buffer, setTimeout, clearTimeout, URL, Promise });
  vm.runInContext(codice, c);
  Object.assign(vm.runInContext('CFG', c), { dir, root: path.join(dir, 'libreria'), scartati: path.join(dir, 'libreria', '_scartati'), ...cfg });
  c.gw = gw;
  c.log = () => {};
  const blocco = fs.readFileSync(path.join(RADICE, 'src', 'blocks', nome), 'utf8');
  const esegui = vm.runInContext(`(async function ($input) {\n${blocco}\n})`, c);
  return esegui({ first: () => ({ json: input }) });
}

async function conLibreria(prova) {
  const dir = path.join(RADICE, 'state', `test-blocchi-${process.pid}`);
  fs.mkdirSync(path.join(dir, 'libreria'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  try {
    await prova(dir, path.join(dir, 'libreria'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const leggi = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const vota = (f) => fs.writeFileSync(f, JSON.stringify({ ...leggi(f), voto: 5, voto_fonte: 'dashboard' }));

test('blocco 10: un voto scritto dopo la lettura resta', () => conLibreria(async (dir, lib) => {
  const a = path.join(lib, 'a.json');
  const b = path.join(lib, 'b.json');
  const c = path.join(lib, 'c.json');
  for (const [f, id] of [[a, '1'], [b, '2'], [c, '3']]) fs.writeFileSync(f, JSON.stringify({ titolo: id, voto: null, ibroadcast: { track_id: id } }));
  let fatto = false;
  const r = await eseguiBlocco('10-voti-ibroadcast.js', {
    gw: async () => ({ json: { library: { tracks: { 1: { plays: 7 }, 2: { plays: 2, rating: 4 }, 3: { plays: 1 } }, playlists: {}, tags: {} } } }),
    // letta l'ultima scheda: arriva un voto sulla prima e la terza diventa illeggibile
    dopoLettura: (f) => {
      if (f !== c || fatto) return;
      fatto = true;
      vota(a);
      fs.writeFileSync(c, '{ troncato');
    },
  }, dir);
  assert.equal(leggi(a).voto, 5);
  assert.equal(leggi(a).ascolti, 7);
  assert.equal(leggi(a).ibroadcast.ascolti, 7);
  assert.equal(leggi(b).voto, 4);
  assert.equal(leggi(b).voto_ib, 4);
  assert.equal(fs.readFileSync(c, 'utf8'), '{ troncato');
  assert.equal(r[0].json.aggiornati, 1);
  assert.equal(fs.readdirSync(lib).some((n) => n.endsWith('.tmp')), false);
}));

// Frame MP3 validi (MPEG1 layer III, 128 kbps, 44100 Hz): 38 frame fanno circa 1 secondo
const mp3Valido = () => Buffer.concat(Array.from({ length: 38 }, () => {
  const f = Buffer.alloc(417);
  f.set([0xff, 0xfb, 0x90, 0x00]);
  return f;
}));

for (const [caso, audio, esito] of [['tenuto', mp3Valido(), 'ok'], ['scartato', Buffer.from('rotto'), 'scartato']]) {
  test(`blocco 3a: il voto dato durante l'analisi resta (brano ${caso})`, () => conLibreria(async (dir, lib) => {
    const file = path.join(lib, 'eco.mp3');
    const scheda = path.join(lib, 'eco.json');
    fs.writeFileSync(file, audio);
    fs.writeFileSync(scheda, JSON.stringify({ titolo: 'Eco', categoria: 'Prova', tipo: 't', durata_s: 1, tentativi_render: 2, voto: null }));
    await eseguiBlocco('03a-controllo-qualita.js', {
      input: { state: { queue: [] }, outcome: 'saved', file },
      gw: async () => { vota(scheda); return { rms_db: -20, picco_db: -1, frazione_silenzio: 0, frazione_clip: 0 }; },
    }, dir);
    const dove = esito === 'ok' ? scheda : path.join(lib, '_scartati', 'Prova', 't', 'eco.json');
    assert.equal(leggi(dove).voto, 5);
    assert.equal(leggi(dove).qualita.esito, esito);
    assert.equal(fs.existsSync(scheda), esito === 'ok');
  }));
}

test('blocco 8a: voto e nota passano dal gateway col numero di traccia', () => conLibreria(async (dir, lib) => {
  for (let n = 1; n <= 10; n++) {
    fs.writeFileSync(path.join(lib, `b${n}.json`), JSON.stringify({ titolo: `T${n}`, categoria: 'Prova', numero_traccia: n, generato_il: `2026-11-${String(n).padStart(2, '0')}` }));
  }
  const telegramFile = path.join(dir, 'telegram.json');
  fs.writeFileSync(telegramFile, JSON.stringify({ chat_id: 7 }));
  let seq = 0;
  // un giro del blocco con un solo aggiornamento Telegram; ritorna i voti inviati e i messaggi mandati
  const giro = async (update, esito = { ok: true, titolo: 'T9' }) => {
    const voti = [], detti = [];
    await eseguiBlocco('08a-comandi-telegram.js', {
      cfg: { telegramFile },
      gw: async (rotta, corpo) => {
        if (rotta === '/voto') { voti.push({ ...corpo }); return esito; }
        assert.equal(rotta, '/tg');
        if (corpo.method === 'getUpdates') return { result: [{ update_id: ++seq, ...update }] };
        if (corpo.method === 'sendMessage') detti.push(JSON.parse(JSON.stringify(corpo.body)));
        return { ok: true };
      },
    }, dir);
    return { voti, detti };
  };
  const premi = (data, esito) => giro({ callback_query: { id: 'c', from: { id: 7 }, data } }, esito);
  const scrivi = (text, esito) => giro({ message: { chat: { id: 7 }, text } }, esito);

  const menu = (await premi('m:vota')).detti[0].reply_markup.inline_keyboard;
  assert.deepEqual(menu.map((riga) => riga[0].callback_data), [10, 9, 8, 7, 6, 5, 4, 3].map((n) => `v:${n}`));
  assert.equal((await premi('v:9')).detti[0].reply_markup.inline_keyboard[0][4].callback_data, 'vv:5:9');

  for (const vecchio of ['v:eco.mp3', 'vv:5:eco.mp3']) {
    const r = await premi(vecchio);
    assert.deepEqual(r.voti, []);
    assert.match(r.detti[0].text, /non e' piu' valido/);
  }

  assert.deepEqual((await premi('vv:5:9')).voti, [{ numero: 9, voto: 5, fonte: 'telegram' }]);
  const rifiutata = await scrivi('a<b', { ok: false, error: 'nota: no' });
  assert.match(rifiutata.detti[0].text, /^Non ho salvato il voto: nota: no/);
  assert.deepEqual((await scrivi('calma; bella')).voti, [{ numero: 9, voto: 5, nota: 'calma; bella', fonte: 'telegram' }]);

  const ko = await premi('vv:2:9', { ok: false, error: 'brano non trovato' });
  assert.match(ko.detti[0].text, /^Non ho salvato il voto: brano non trovato/);
}));

test('aggiornaScheda: non cancella un voto scritto dopo la lettura', () => {
  const dir = path.join(RADICE, 'state');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `test-scheda-${process.pid}.json`);
  try {
    fs.writeFileSync(f, JSON.stringify({ titolo: 'Eco', voto: null }));
    const meta = JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(f, JSON.stringify({ ...meta, voto: 5 })); // il voto arriva durante l'attesa
    L.aggiornaScheda(f, { ibroadcast: { track_id: '1' } });
    assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { titolo: 'Eco', voto: 5, ibroadcast: { track_id: '1' } });
    assert.equal(fs.existsSync(f + '.tmp'), false);

    // scheda illeggibile o sparita: errore, e nessun file ridotto ai soli campi
    fs.writeFileSync(f, '{ troncato');
    assert.throws(() => L.aggiornaScheda(f, { voto: 1 }), { name: 'SyntaxError' });
    assert.equal(fs.readFileSync(f, 'utf8'), '{ troncato');
    fs.rmSync(f);
    assert.throws(() => L.aggiornaScheda(f, { voto: 1 }), { code: 'ENOENT' });
    assert.equal(fs.existsSync(f), false);
  } finally {
    fs.rmSync(f, { force: true });
  }
});
