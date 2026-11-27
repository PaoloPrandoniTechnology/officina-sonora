# Copertine e metadati iBroadcast — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pubblicare su iBroadcast brani con tag ID3 completi e copertine AI identificative del genere.

**Architecture:** Gli sfondi si generano in anticipo con la WebUI. Il gateway compone sfondo + testi in JPEG; il blocco di caricamento chiede la copertina al gateway e la scrive nel file. Un tool separato e riprendibile ripubblica i brani già online.

**Tech Stack:** Node 24 (`node --test`, CommonJS), `@resvg/resvg-wasm` (in `E:\n8n\node_modules`), ffmpeg (`E:\MusicAI\ffmpeg\bin\ffmpeg.exe`), WebUI A1111 `--api`.

**Spec:** `docs/superpowers/specs/2026-11-27-copertine-e-metadati-design.md`

## Global Constraints

- Nessuna dipendenza nuova. Percorsi relativi a `E:\n8n\yoga`; libreria `E:\Musica di sottofondo`.
- Copertina JPEG 1000x1000; sfondi 768x768, 8 per genere, in `assets\sfondi\<categoria>\NN.jpg`, `assets/` in `.gitignore`.
- WebUI: porta 7861, `--api --lowvram`, mai `--share`, modello `Deliberate_v6`, `DPM++ 2M` Karras, 28 passi, cfg 7.
- Nessuna generazione AI mentre un render musicale è in corso.
- Una vecchia copia si cestina solo dopo che la nuova ha `ibroadcast.organizzato === true`.
- I blocchi n8n non hanno `fetch`: usano `gw()`. I token restano nel gateway.
- Dopo ogni task: `powershell -ExecutionPolicy Bypass -File tools\pubblica.ps1 -Messaggio "..."` (è il commit).

## Review Focus

- Titolo lunghissimo, parola unica lunga o con `& < > "`: tutto dentro il riquadro, SVG valido (Task 1).
- Gateway spento, sfondi assenti o ffmpeg fallito: il brano si carica con `coverPng` e `copertina: "provvisoria"` (Task 2).
- Genere aggiunto da Telegram senza campo `copertina`: etichetta, prompt e font di ripiego (Task 1).
- Interruzione a metà di sfondi o ripubblicazione: il rilancio non duplica e non perde nulla; la pausa torna com'era (Task 3, 4).
- Brano vecchio senza `bpm`, `tonalita`, `durata_s` o `seed`: frame omessi, mai "undefined" (Task 2).

---

### Task 1: Descrizioni per genere e composizione nel gateway

**Files:** Create `gateway/copertina.js`, `tools/copertine-catalogo.js` (scrive il campo nel catalogo, rilanciabile), `tools/test/copertina.test.js`; Modify `config/catalogo.json`, `gateway/server.js`.

**Interfaces — Produces:**
- Catalogo: `categories[i].copertina = { etichetta, prompt, font, corsivo }`; `font` ∈ Georgia, Impact, Bahnschrift, Segoe UI.
- `stileCopertina(categoria: string) -> {etichetta, prompt, font, corsivo, colore}`; ripiego: nome con `-` sostituiti da spazi, `stile` come prompt, Georgia; `colore` = `colori[2]` o `#ffffff`.
- `svgCopertina({titolo, stile, sfondo: Buffer}) -> string`
- `componi({categoria, titolo, numero}, cartella = assets/sfondi) -> Promise<{jpeg: Buffer, sfondo: string} | null>` (`null` se non ci sono sfondi; sfondo = file ordinati, indice `numero % n`).
- HTTP `POST /copertina {categoria, titolo, numero}` -> `{ok:true, jpeg:"<base64>"}` oppure `{ok:false, error}`.

- [ ] **Step 1: test che fallisce**

```js
test('stile: i 39 generi hanno etichetta, prompt e font', () => {
  for (const c of cat) { assert.ok(c.copertina.etichetta && c.copertina.prompt, c.name); assert.match(c.copertina.font, /^(Georgia|Impact|Bahnschrift|Segoe UI)$/); }
  assert.equal(new Set(cat.map((c) => c.copertina.etichetta)).size, cat.length);
  assert.equal(stileCopertina('Genere-Nuovo').etichetta, 'Genere Nuovo');
});
test('svg: testi speciali e lunghi', () => {
  const svg = svgCopertina({ titolo: 'A & B <C> "D" ' + 'Supercalifragilistichespiralidoso'.repeat(2), stile: stileCopertina('Meditazione'), sfondo });
  assert.ok(svg.includes('A &amp; B &lt;C&gt;'));
  for (const [, size, testo] of svg.matchAll(/font-size="(\d+)" fill="#fff">([^<]*)</g)) assert.ok(testo.replace(/&\w+;/g, 'x').length * size * 0.6 <= 880);
});
test('componi: JPEG 1000x1000, null senza sfondi', async () => { /* cartella temporanea con un PNG 8x8 */ 
  assert.equal(await componi({ categoria: 'Meditazione', titolo: 'x', numero: 1 }, vuota), null);
  const r = await componi({ categoria: 'Meditazione', titolo: 'Prova', numero: 9 }, piena);
  assert.equal(r.jpeg.readUInt16BE(0), 0xffd8);
  // dimensioni lette dal marker SOF0/SOF2 = 1000x1000
});
```

Etichette: nome italiano leggibile senza "strumentale" (es. "Yin & Savasana", "Metal", "Bossa nova"). Prompt: soggetto + tecnica + colori, in inglese; partire dai 4 dei campioni in `state/copertine-prova-ai/genera.js`, corretti come da spec §1.

- [ ] **Step 2:** `node --test tools/test/copertina.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementare partendo da `genera.js` (layout approvato, font da `C:\Windows\Fonts`, wasm inizializzato una sola volta); il corpo del titolo è il minore tra 108 e quello che fa stare la riga più lunga in 880 px; massimo 4 righe, parole oltre 24 caratteri spezzate. Aggiungere la rotta in `server.js`.
- [ ] **Step 4:** stesso comando → PASS; `node --test tools/test/` → PASS.
- [ ] **Step 5:** pubblicare.

### Task 2: Tag ID3 completi e copertina nel caricamento

**Files:** Modify `src/lib-ibroadcast.js`, `src/blocks/03d1-prepara-caricamento.js`, `src/blocks/03d4-notifica-caricamento.js`; Create `tools/test/id3.test.js`; Delete `tools/prova-apic.js`, `tools/cover-integra.js` (superati).

**Interfaces — Consumes:** `/copertina`, `categories[].copertina.etichetta`.
**Produces:**
- `async copertinaPer(meta) -> {mime, dati: Buffer, definitiva: boolean}` (ripiego `coverPng`, `image/png`).
- `tagFile(file, meta, cop) -> number`; `apicFrame(dati, mime = 'image/png')`.
- `.json`: `id3_versione: 2`, `id3_frames`, `copertina: "ai" | "provvisoria"` (scritti da 3d1, così valgono anche per il tool del Task 4).
- `chiaveId3(tonalita) -> string`: Do..Si → C..B, `#`/`b` mantenuti, minore → suffisso `m`; testo non riconosciuto → `''`.

- [ ] **Step 1: test che fallisce** — il test carica lib + libIb + cover con `AsyncFunction` come `tools/prova-apic.js`, lavora su un file temporaneo e rilegge i frame.

```js
assert.equal(f.TALB, 'Yin & Savasana'); assert.equal(f.TKEY, 'Cm'); assert.equal(f.TLEN, '210000');
assert.equal(f.TLAN, 'zxx'); assert.equal(f.TDAT, '2711'); assert.equal(f.TYER, '2026'); assert.equal(f.TRCK, '161');
for (const k of ['TIT2','TPE1','TPE2','TCON','TIT1','TIT3','TBPM','TCOM','TPUB','TCOP','TENC','COMM','APIC']) assert.ok(k in f, k);
assert.deepEqual(Object.keys(f.TXXX).sort(), ['ATTIVITA','ENERGIA','MOOD','SEED','STRUMENTI','STRUTTURA','VARIANTE']);
assert.equal(f.APIC.mime, 'image/jpeg');
assert.equal(fnvAudio(dopo), fnvAudio(prima));          // anche ritaggando due volte
assert.ok(!JSON.stringify(fMinimo).includes('undefined')); // meta con solo titolo e categoria
assert.equal((await copertinaPer(meta)).definitiva, false); // con gw che lancia
```

Valori: `TCOM`/`TPUB`/`TENC` = `Yoga Music Factory`; `TCOP` = `<anno> Yoga Music Factory`; `MOOD` = `MOOD_BY_ENERGIA`; `TLEN` da `qualita.durata_reale_s`, altrimenti `durata_s`; `TDAT` formato GGMM.

- [ ] **Step 2:** `node --test tools/test/id3.test.js` → FAIL.
- [ ] **Step 3:** implementare. La scansione `retagScanned` non cambia: i brani vecchi si aggiornano solo col Task 4.
- [ ] **Step 4:** test → PASS; `node build-workflow.mjs`.
- [ ] **Step 5:** riavviare il gateway (lo rilancia il watchdog), import del workflow e `publish:workflow --id=yogaMusicFactory01` (LEGGIMI.md); controllare in `state/tick.log` un giro senza errori; pubblicare. Finché mancano gli sfondi i brani nuovi escono con copertina provvisoria.

### Task 3: Generatore degli sfondi

**Files:** Create `tools/genera-sfondi.js`, `tools/test/sfondi.test.js`; Modify `.gitignore`.

**Interfaces — Consumes:** `stileCopertina`. **Produces:** `mancanti(categorie: string[], cartella, n = 8) -> [{categoria, file, seed}]`; `async conPausa(fn)`; CLI `node tools/genera-sfondi.js [--genere X] [--max N]`.

- [ ] **Step 1: test che fallisce** — `mancanti` su cartella temporanea con `01.jpg` e `03.jpg` restituisce 02,04..08; `conPausa` con `fn` che lancia ripristina `comandi.json` (assente → assente, `pausa:true` → resta), usando un percorso comandi passato come secondo argomento.
- [ ] **Step 2:** `node --test tools/test/sfondi.test.js` → FAIL.
- [ ] **Step 3:** implementare. Pausa via `POST /api/controllo/comando` con `X-Controllo: 1`; attesa finché `state.json` ha `job: null` (massimo 20 min, poi stop); avvio `call .\environment.bat && cd webui && python launch.py --api --lowvram --port 7861` da `E:\StableDiffusion\webui`, chiusura con `taskkill /T /F` in `finally` e su Ctrl+C. Richiesta con `node:http` senza timeout di 300 s (`fetch` ha fallito sul campione 8). Un errore su un'immagine si registra e si continua; PNG → JPEG con ffmpeg; negative prompt dei campioni. Ordine: prima i generi con brani in libreria. Alla fine di ogni genere `assets/sfondi/<categoria>/_foglio.jpg` (escluso dalla scelta sfondi in Task 1: solo `NN.jpg`).
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** prova vera `--genere Metal-strumentale --max 2`; controllare le immagini e che la produzione riprenda. Pubblicare.
- [ ] **Step 6:** **chiedere all'utente quando fermare la produzione**, generare il resto (anche a tranche), mostrare i fogli e rifare le immagini scartate.

### Task 4: Ripubblicazione dei brani online

**Files:** Create `tools/ripubblica.js`, `tools/test/ripubblica.test.js`; Modify `gateway/server.js` (aggiungere `ratetrack` a `IB_MODI`).

**Interfaces — Consumes:** blocchi 3d1–3d4 eseguiti come in `tools/ricarica-ordinata.js`, `id3_versione`, `ibroadcast_precedente`.
**Produces:** `daRipubblicare(brani) -> brani` (con `track_id`, `id3_versione` < 2 oppure cambio non concluso; ordinati per `numero_traccia`); `prossimoPasso(riga) -> 'carica'|'attendi'|'voto'|'playlist'|'cestina'|'fatto'`; mappa in `state/ripubblica.json` `{ "<jsonPath>": {vecchio, nuovo, rating, voto_ok, playlist_ok, cestinato} }`, scritta dopo ogni passo. CLI `node tools/ripubblica.js --prova a.json b.json c.json` | `--tutti`.

- [ ] **Step 1: test che fallisce** — `prossimoPasso`: senza `nuovo` → `carica`; nuovo non organizzato → `attendi`; organizzato con `rating>0` e `voto_ok` falso → `voto`; poi `playlist`; poi `cestina`; mai `cestina` se organizzato è falso o il voto non è confermato. `daRipubblicare` esclude i brani `fatto`.
- [ ] **Step 2:** `node --test tools/test/ripubblica.test.js` → FAIL.
- [ ] **Step 3:** implementare. Rating e playlist del vecchio id letti da `/ib/library` prima del caricamento. Voto: `ratetrack {track_id, rating}` (fonte non ufficiale), confermato rileggendo la libreria; se il valore non coincide, fermarsi senza cestinare. Playlist utente = non di sistema e non `Yoga - `/`Musica - `: `appendplaylist` col nuovo id. Si ferma se il genere non ha 8 sfondi o la copertina risulta `provvisoria`. Prende il lock `pipeline` (`acquireLock`) per ogni brano e lo rilascia, così non corre insieme al workflow; un `.json` vecchio non finisce nella coda automatica. `numero_traccia` invariato.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** `--prova` su 3 brani di generi diversi, di cui uno votato. Verificare con `/ib/library`: `artwork_id`, nome album, genere, rating, vecchio id cestinato. **Fermarsi e chiedere l'OK all'utente** (copertina di brano e album nell'app).
- [ ] **Step 6:** solo dopo l'OK, `--tutti`; confronto finale: brani vivi = brani locali, nessun voto perso. Aggiornare `LEGGIMI.md` e `README.md` (copertine, tag, due tool nuovi), pubblicare.
