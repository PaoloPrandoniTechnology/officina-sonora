# Ascolto, voto e andamento: piano di realizzazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ascoltare e votare i brani dalla dashboard, con voti sul brano giusto, e vedere nel tempo se il sistema migliora.

**Architecture:** l'unica fonte dei voti è il `.json` di ogni brano, identificato da `numero_traccia`. Un solo punto scrive i voti di dashboard e Telegram (gateway); il blocco 10 applica iBroadcast con la regola "vince l'ultimo". L'andamento è calcolato al volo dal gateway.

**Tech Stack:** Node.js 24 (solo librerie standard), blocchi n8n, HTML/JS senza librerie, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-27-ascolto-e-voto-design.md`

## Global Constraints
- Nessuna nuova dipendenza. Testi in italiano, nello stile esistente.
- Sviluppo in un worktree su ramo `ascolto-voto`: in `E:\n8n\yoga` il gateway legge `dashboard.html` dal vivo e il watchdog può riavviare `server.js`.
- I test non scrivono nella libreria vera: `E:\Musica di sottofondo` si sostituisce con la variabile `YMF_LIBRERIA` (cartella temporanea) per `gateway/voti.js`.
- `lib.js` e `lib-apprendimento.js` sono incollati nei blocchi: niente `require` di file del progetto.
- Gateway: `Host` ammesso solo `127.0.0.1:5790` o `localhost:5790`; `POST` con `Origin` diverso da `http://` + quei due rifiutata; senza `Origin` ammessa.
- Voto intero 1-5; nota massimo 300 caratteri, senza `<` o `>`.
- Scritture dei `.json` da gateway e script: file `.tmp` poi `rename`.
- Test: `node --test tools/test/*.test.js`. Prima delle modifiche: 20 passano, fallisce solo `rotazione: i generi senza brani vengono scelti` (preesistente, non va toccato).
- Ogni task termina con commit e push del ramo; messaggio chiuso dalla riga `Co-Authored-By` della sessione.

## Review Focus
- Voto dato mentre il blocco 3d3 attende iBroadcast: il voto deve restare (Task 2).
- Pulsante Telegram vecchio, con nome file al posto del numero: messaggio chiaro, nessun voto scritto (Task 3).
- Aggiornamento della pagina ogni 5/30 s durante ascolto o scrittura della nota: audio e testo restano (Task 5).
- `Range` oltre la fine del file o malformato: risposta 416 o file intero, mai un errore del gateway (Task 3).
- Libreria con un solo punto temporale o senza voti: grafici con "dati insufficienti", nessun `NaN` (Task 6).

---

### Task 1: voti nella scheda del brano

**Files:** Modify `src/lib.js` (via `readVotes`, `CFG.feedbackFile`), `src/lib-apprendimento.js`, `src/blocks/04-feedback.js`, `05a-scegli-ricetta.js`, `09-riflessione.js`, `10-voti-ibroadcast.js`; Test `tools/test/voti.test.js`.

**Interfaces (Produces, in `lib-apprendimento.js`):**
- `votoUtente(track) -> 1..5 | null` (solo `track.meta.voto`)
- `recipeStats(tracks)`, `varianteStats(tracks, nomeCategoria)`, `pickVariante(cat, tracks)`
- `applicaSegnale(meta, segnale /* {voto, fonte} | null */, oraIso) -> boolean` (true se `meta.voto` è cambiato)
- `firmaVoti(tracks) -> string` = `"<numero di voti>|<voto_il più recente o vuoto>"`

- [ ] **Step 1: test** (carica le librerie con `vm` come `lib.test.js`)
  - `omonimi: il voto resta su un solo brano`: due tracce `audio: 'eco'`, una con `voto: 5`; `votoUtente` dà `5` e `null`.
  - `vince l'ultimo`: partendo da `{voto:null}`, segnale 4 → `voto 4`, `voto_ib 4`, `voto_fonte`, `voto_il`, true. Poi `voto=2, voto_fonte='dashboard'`, stesso segnale 4 → false, resta 2. Segnale 5 → 5. Segnale `null` → false, voto 5, `voto_ib null`. Di nuovo 5 → `voto_ib 5`, false, `voto_il` invariato.
  - `firma`: cambia correggendo un voto (stesso conteggio, `voto_il` nuovo).
- [ ] **Step 2:** `node --test tools/test/voti.test.js` → FAIL.
- [ ] **Step 3: implementare.** `applicaSegnale`: se `(segnale?.voto ?? null) === (meta.voto_ib ?? null)` non fa nulla; altrimenti aggiorna `voto_ib` e, solo se il segnale non è nullo e diverso da `voto`, scrive `voto`, `voto_fonte`, `voto_il`.
  - Blocco 10: usa `applicaSegnale` con il segnale calcolato come oggi; toglie tutto il CSV.
  - Blocco 04: toglie `readVotes` e la copia dei voti; riparte se `firmaVoti` differisce da `state.lastVoteMark` (sostituisce `lastVoteCount`); i 30 brani votati sono ordinati per `voto_il || generato_il`.
  - Blocchi 05a e 09: nuove firme; in 09 `voti_totali` = brani con voto.
  - Rimuovere `readVotes` e `CFG.feedbackFile` (dopo il Task 3, `grep -rn "readVotes\|feedbackFile" src` non deve trovare nulla).
- [ ] **Step 4:** tutti i test come da vincoli. **Step 5:** commit.

### Task 2: i blocchi non cancellano un voto appena dato

**Files:** Modify `src/blocks/03d3-recupero-tag.js`, `src/lib-apprendimento.js`; Test `tools/test/voti.test.js`.

**Interfaces (Produces):** `aggiornaScheda(jsonPath, campi) -> void`: rilegge il file, applica `Object.assign` dei soli `campi`, scrive in modo atomico.

- [ ] **Step 1: test** su file temporaneo in `state\`: scheda con `voto: null`; si legge `meta`; si scrive sul file `voto: 5`; `aggiornaScheda(f, {ibroadcast: {track_id: '1'}})` → il file ha `voto 5` e `ibroadcast`.
- [ ] **Step 2:** FAIL. **Step 3:** implementare; in 3d3 sostituire la scrittura finale con `aggiornaScheda(full, { ibroadcast: ib })`. Controllare con `grep -n "await\|writeFileSync" src/blocks/*.js` che nessun altro blocco riscriva una scheda di brano con più di 15 minuti letta prima di un `await`; correggere allo stesso modo.
- [ ] **Step 4:** test. **Step 5:** commit.

### Task 3: gateway (protezione, audio, voto) e Telegram

**Files:** Create `gateway/protezione.js`, `gateway/voti.js`; Modify `gateway/server.js`, `gateway/controllo.js`, `src/blocks/08a-comandi-telegram.js`; Test `tools/test/gateway.test.js`.

**Interfaces (Produces):**
- `protezione.ammessa(method, headers) -> boolean`
- `voti.vota({numero, voto, nota, fonte}) -> {ok:true, numero, titolo, prima:{voto,nota}, dopo:{voto,nota}}`; lancia `Error` in italiano. `fonte`: `'telegram'` o, per ogni altro valore, `'dashboard'`. Scrive `voto`, `voto_fonte`, `voto_il`, `nota_utente` (nota assente = invariata); non tocca `voto_ib`.
- `voti.elenco(oraMs) -> {coda: Brano[], votati: Brano[]}`, `Brano = {numero, titolo, categoria, durata_s, generato_il, voto, nota, voto_il}`. `coda`: senza voto e generati da almeno 15 minuti, ordinati per voti del genere (crescente) poi `generato_il` (decrescente). `votati`: ultimi 20 per `voto_il`.
- `voti.inviaAudio(req, res, numero) -> void`
- Rotte: `GET /api/voti`; `GET /audio/brano?n=<intero>`; `POST /api/controllo/voto` (con `X-Controllo: 1`); `POST /voto` per Telegram. Entrambe le `POST` passano da `controllo.gestisci('/api/controllo/voto', dati)`, che registra nello Storico con sezione `voti`.

- [ ] **Step 1: test** (impostare `YMF_LIBRERIA` prima del `require`; il test usa `voti.vota`, non `gestisci`, per non scrivere nello Storico vero)
  - `ammessa`: `Host: evil.test` false; `127.0.0.1:5790` e `localhost:5790` true; `POST` con `Origin: https://evil.test` o `null` false; `Origin: http://localhost:5790` true; senza `Origin` true.
  - `vota`: scrive i campi; rifiuta `voto` 0, 6, 2.5, `'3'`, numero inesistente o `NaN`, nota di 301 caratteri o con `<`.
  - `elenco`: esclude un brano di 5 minuti fa; il genere senza voti viene prima.
  - `inviaAudio` dietro un `http.createServer` su porta 0: intero 200; `bytes=0-9` → 206, 10 byte, `Content-Range`; `bytes=999999-` → 416; `bytes=abc` → 200; numero inesistente → 404.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. La libreria si legge in `voti.js` (`process.env.YMF_LIBRERIA || 'E:\\Musica di sottofondo'`), saltando `_scartati`; il file audio è la scheda con estensione mp3, flac, wav o ogg; lettura con `fs.createReadStream`. In `server.js` il controllo `ammessa` viene prima di ogni rotta (403).
  - Blocco 08a: il menu "vota" elenca gli ultimi 8 brani di `libraryTracks()` per `generato_il`, pulsanti con `numero_traccia`; voto e nota via `gw('/voto', {numero, voto, nota, fonte:'telegram'})`; `tgs.flow` conserva `numero` e `voto`; se `ok` è falso risponde "Non ho salvato il voto: …". Eliminare `setVote`.
- [ ] **Step 4:** test, più il `grep` del Task 1. **Step 5:** commit.

### Task 4: pulizia dei voti copiati

**Files:** Create `tools/pulisci-voti.js`; Test `tools/test/voti.test.js`.

**Interfaces (Produces):** `pulisci(meta, oraIso) -> 'rimosso' | 'ibroadcast' | null` (modifica `meta`).

- [ ] **Step 1: test:** voto senza `voto_fonte` → `voto null`, senza `nota_utente`, `'rimosso'`; fonte `valutazione iBroadcast` (o che inizia con `tag`, `playlist`, `cestino`) → `voto_ib = voto`, `voto_il = oraIso`, toglie `nota_utente` uguale alla fonte, `'ibroadcast'`; senza voto o fonte `dashboard`/`telegram` → `null`; seconda esecuzione senza effetti su un brano rimosso.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. Senza argomenti è una prova a vuoto che stampa i numeri; con `--applica` copia prima schede e CSV in `state/backup/voti-<data>/`, scrive, rinomina il CSV in `feedback.csv.vecchio`.
- [ ] **Step 4:** test; poi `node tools/pulisci-voti.js` (a vuoto) → attesi 4 rimossi (14, 18, 35, 123) e 11 di iBroadcast, salvo nuovi voti. **Step 5:** commit.

### Task 5: dashboard, ascolto e voto

**Files:** Modify `gateway/dashboard.html`, `gateway/analisi.js`; Test `tools/test/analisi.test.js`.

**Interfaces:** Consumes le rotte del Task 3. Produces: ogni elemento di `libreria.timeline` è `{giorno, brani, ore, voti}` (`voti` contati per giorno di `voto_il`).

- [ ] **Step 1: test:** ogni punto della timeline ha `ore` e `voti` numerici. **Step 2:** FAIL. **Step 3:** implementare in `analisi.js`.
- [ ] **Step 4: interfaccia**, in cima alla scheda Voti: card "Da votare (N)" con filtro genere, `<audio controls>`, 5 pulsanti stella con `aria-label`, nota, "Salta"; card "Votati ora" per riaprire e correggere. Tasti 1-5 solo nella scheda Voti e fuori da campi di testo. Dopo il voto: brano successivo e `play()` (errore ignorato). Il lettore non viene ridisegnato dagli aggiornamenti periodici: la coda si ricarica solo aprendo la scheda, dopo un voto o cambiando filtro. "Solo lettura" → "Solo da questo PC". Sparkline: "ore" usa `ore`, "voti" usa `voti`, quella di "voto medio" è rimossa.
- [ ] **Step 5:** verifica nel browser con il gateway del worktree su porta libera e `YMF_LIBRERIA` su una copia di pochi brani (la porta diventa `process.env.YMF_PORTA || 5790` in `server.js` e `protezione.js`; se 5790 è occupata dal vero gateway). Controllare: ascolto, spostamento, voto, tasti, 40 s di attesa senza interruzioni, larghezza 400 px, console senza errori. Commit.

### Task 6: sezione Andamento

**Files:** Create `gateway/andamento.js`; Modify `gateway/server.js`, `gateway/dashboard.html`; Test `tools/test/andamento.test.js`.

**Interfaces (Produces):**
- `andamento.calcola({brani, errori, modifiche, genere, passo, ora}) -> {passo, punti, esito:{voto, scarti}, modifiche}`
  - `brani: [{generato_il, scartato, categoria, voto, durata_s, render_s}]`; `errori: [{ts}]`; `modifiche: [{ts, sezione, chiave}]`; `genere` stringa o `''`; `passo` `'ora' | 'giorno' | ''` (vuoto: ora se la storia è sotto 7 giorni); `ora` in ms.
  - `punti: [{da, brani, scartati, scartoPct, voto, votati, resa, errori}]`, intervalli in ora locale, compresi quelli vuoti, ultimi 48 (ora) o 60 (giorno).
  - `resa` = somma `render_s` di tutti i brani / somma `durata_s` dei soli accettati; `null` senza durata.
  - `voto` e `votati` solo dai brani accettati. Valori senza dati: `null`.
  - `esito.voto`, `esito.scarti`: `'migliora' | 'stabile' | 'peggiora' | 'dati insufficienti'`.
  - `modifiche`: solo sezioni diverse da `voti` e `comandi`, dentro l'intervallo dei punti.
- `andamento.leggi({genere, passo})`: raccoglie schede (anche `_scartati`; `durata_s` = `qualita.durata_reale_s || durata_s`), `errori.jsonl` e `.jsonl.1`, `config/history/controllo.jsonl` e le date `aggiornato` delle `guidance*.json` (sezione `linee guida`).
- Rotta `GET /api/andamento?genere=&passo=`.

- [ ] **Step 1: test** con dati finti e `ora` fissa:
  - 9 voti per periodo → `dati insufficienti`; 10 per periodo con medie 3,0 e 3,3 → `migliora`; 3,0 e 3,1 → `stabile`; 3,5 e 3,0 → `peggiora`.
  - 30 brani per periodo, scarti da 30% a 20% → `migliora`; 29 → `dati insufficienti`.
  - un accettato (200 s, render 300) e uno scartato (render 100) → `resa 2`, `scartoPct 50`.
  - lista vuota → `punti []`, esiti `dati insufficienti`; il filtro `genere` non cambia `errori`.
- [ ] **Step 2:** FAIL. **Step 3:** implementare modulo e rotta.
- [ ] **Step 4: interfaccia.** Caricare prima la skill `dataviz`. Voce di menu e scheda `andamento`: filtro genere, passo, riquadro esito, quattro grafici a linea SVG con titoli "Voto medio", "Brani scartati (%)", "Secondi di render per secondo di musica buona", "Errori". Interruzione della linea sui `null`; punti con `votati < 5` vuoti; modifiche come linee verticali con `<title>`; nota "Il filtro genere non si applica agli errori". Aggiornamento ogni 30 s solo a scheda aperta.
- [ ] **Step 5:** verifica nel browser come nel Task 5; test; commit.

### Task 7: documentazione e pubblicazione

**Files:** Modify `README.md` (sezioni 5, 6, 7, 12), `LEGGIMI.md` (via `feedback.csv`), `yoga-workflow.json`.

- [ ] **Step 1:** documentare ascolto, voto, regola "vince l'ultimo", Andamento, fine del CSV. `node build-workflow.mjs`; test; commit.
- [ ] **Step 2:** **chiedere conferma all'utente**: la pubblicazione ferma la produzione.
- [ ] **Step 3:** senza `state\pipeline.lock` e con `state.json` senza `job`: `ferma-automazione.vbs` e verifica che non restino processi n8n, watchdog, gateway.
- [ ] **Step 4:** unire il ramo in `master` in `E:\n8n\yoga`; `node tools/pulisci-voti.js`, poi `--applica`.
- [ ] **Step 5:** con `N8N_USER_FOLDER=E:\n8n\data`: `import:workflow --input=yoga-workflow.json`, `publish:workflow --id=yogaMusicFactory01`; `avvia-automazione.vbs`.
- [ ] **Step 6:** attesi: dashboard aperta, voti totali = 11 più i nuovi, un voto di prova scelto dall'utente resta dopo 12 minuti, un brano nuovo completato, nessun errore nuovo in `state\errori.jsonl`. Eseguire `tools\pubblica.ps1` e il push.
