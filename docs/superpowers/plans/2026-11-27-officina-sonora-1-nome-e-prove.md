# Officina Sonora, piano 1: rinomina e prove sul motore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rinominare il progetto in Officina Sonora e scoprire con render veri come YuE2 risponde a score ABC scritti da noi, lyrics e LoRA.

**Architecture:** prima la rinomina (codice e macchina) a produzione ferma. Poi `src/compositore/abc.js` (scrittura e validazione dello score, base del futuro compositore) e un runner di prove che genera una griglia A/B con pagina di ascolto.

**Tech Stack:** Node 24 (CommonJS, `node:test`), n8n, PowerShell 5.1, yue2.cpp su `http://127.0.0.1:18087`, `gh`.

**Spec:** `docs/superpowers/specs/2026-11-27-processo-artistico-design.md` (copre qui le fasi 1 e 2).

Piani successivi, scritti dopo le prove perche' dipendono dai loro esiti: 2 compositore e revisore;
3 schede dei generi, prompt, lyrics, LoRA e passaggio in produzione; 4 dashboard, apprendimento e ricerca.

## Global Constraints
- Nome: `Officina Sonora`; slug `officina-sonora`; cartella `E:\n8n\officina-sonora`.
- L'id del workflow resta `yogaMusicFactory01`.
- `yoga` resta ambito: cartella `Yoga`, tag `yoga`, playlist `Yoga - <categoria>`, `E:\Musica di sottofondo` invariata.
- Brani gia' pubblicati non toccati. Nessuna nuova dipendenza npm.
- Tutto locale; nessuna chiamata a Claude o a servizi a pagamento.
- ABC: `L:1/32`, voci `Vocal` e `Ins` monofoniche; durate `1,2,3,4,6,8,12,16,24,32,48`; accordi: `"" m dim aug 7 maj7 m7 dim7 m7b5 sus4 sus2 6 m6 7sus4 m(maj7)`, basso `/X`.
- Lyrics: solo `intro, verse, pre-chorus, chorus, bridge, outro`.
- Test: `node --test tools/test/*.test.js` (oggi 91 verdi) verde alla fine di ogni attivita'.
- Commit solo dei file dell'attivita' (non `config/history/controllo.jsonl`), poi `git push` (repo privata).

## Review Focus
1. Rinomina con processi ancora attivi: la cartella non si sposta a meta'; ci si ferma e si verifica prima.
2. Dopo la rinomina il supervisore o i vbs puntano al percorso vecchio: la produzione deve ripartire anche dopo un riavvio.
3. Alterazioni nella battuta (stessa lettera in ottave diverse, legature oltre la stanghetta): lette come le intende YuE2 (Task 3).
4. Prova fallita a meta' (motore spento, LoRA assente, job fallito): le altre prove continuano e la produzione viene ripristinata (Task 4).
5. Score o audio troncati dal motore: segnalati nella pagina di ascolto, non scambiati per risultati buoni (Task 4).

---

### Task 1: Rinomina nel codice e della cartella

**Files:**
- Create: `tools/test/nome.test.js`
- Modify: tutti i file tracciati che contengono il vecchio nome (elenco: `git grep -il yoga -- . ':!docs' ':!config/history'`); `yoga-workflow.json` diventa `officina-sonora-workflow.json`

- [ ] **Step 1: test che fallisce** (`tools/test/nome.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const VIETATI = /yoga music|yoga-music|n8n[\\/]+yoga|yogaMusicSupervisor|yoga-workflow|YMF_|__yoga|musica per (il )?yoga|per centri yoga/i;

test('nessun riferimento al vecchio nome', () => {
  const file = execSync('git ls-files', { cwd: RADICE, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/^(docs|config\/history)\//.test(f) && f !== 'tools/test/nome.test.js' && !/\.(png|jpg|mp3)$/.test(f));
  const trovati = file.filter((f) => fs.existsSync(path.join(RADICE, f)) && VIETATI.test(fs.readFileSync(path.join(RADICE, f), 'utf8')));
  assert.deepEqual(trovati, []);
});
```

- [ ] **Step 2:** `node --test tools/test/nome.test.js` → FAIL con l'elenco dei file.
- [ ] **Step 3: fermare la produzione** senza che il supervisore la riavvii: attendere che `state/state.json` abbia `job: null` (pausa dalla dashboard), poi `wscript E:\n8n\ferma-automazione.vbs`, poi `Disable-ScheduledTask -TaskName YogaMusicSupervisor`. Verifica: nessun ascolto sulle porte 5678, 5790, 18087 e nessun processo `yue-server`.
- [ ] **Step 4: backup e spostamento** dalla cartella `E:\n8n`: copia di `yoga` (con `state`, `config`, `secrets`) e di `data\.n8n\database.sqlite*` in `E:\n8n\backup-rinomina\`; `Move-Item E:\n8n\yoga E:\n8n\officina-sonora`; in quella cartella `git worktree repair .claude/worktrees/ascolto-voto`. Spostare la sessione sulla nuova cartella.
- [ ] **Step 5: sostituzioni** (tutte le grafie dei percorsi: `\`, `\\`, `/`):

| Da | A |
|---|---|
| `n8n\yoga` | `n8n\officina-sonora` |
| `Yoga Music Factory` / `YOGA MUSIC FACTORY` | `Officina Sonora` / `OFFICINA SONORA` |
| `yoga-music-factory` | `officina-sonora` |
| `yoga-workflow.json` (con `git mv`) | `officina-sonora-workflow.json` |
| `YogaMusicSupervisor`, `YogaMusicSupervisore` | `OfficinaSonoraSupervisor` |
| `YMF_` | `OFS_` |
| `__yogaGuard`, `__yogaReadGuard` | `__osGuard`, `__osReadGuard` |

A mano: prompt di sistema in `04-feedback.js`, `05b-titolo-modello.js`, `08a-comandi-telegram.js`, `09-riflessione.js` ("... di musica di sottofondo"); `README.md` e `LEGGIMI.md` (centri yoga come uno degli usi); in `src/lib.js` `ZONE_SCRITTURA = ['E:\\Musica di sottofondo', 'E:\\n8n\\officina-sonora']` (oggi cita `E:\Yoga Music`, inesistente).

- [ ] **Step 6:** `node build-workflow.mjs` → `officina-sonora-workflow.json creato`; `node --test tools/test/*.test.js` → tutti verdi (incluso `nome`).
- [ ] **Step 7: commit** "Rinomina del progetto in Officina Sonora" e push.

### Task 2: Rinomina sulla macchina e su GitHub

**Files:** Modify: `E:\n8n\avvia-automazione.vbs`, `E:\n8n\ferma-automazione.vbs` (fuori repo)

**Interfaces:** Consumes: cartella e workflow del Task 1.

- [ ] **Step 1:** nei due vbs sostituire percorsi e commenti.
- [ ] **Step 2: attivita' pianificata.** `Export-ScheduledTask YogaMusicSupervisor`, registrare la stessa definizione come `OfficinaSonoraSupervisor` con il nuovo percorso di `supervisore.vbs`; eliminare la vecchia solo dopo lo Step 5. Cercare anche altri richiami al vecchio percorso (attivita' pianificate, cartella Esecuzione automatica, collegamenti sul desktop) e aggiornarli.
- [ ] **Step 3: n8n** (da `E:\n8n`, stesse variabili di `tools/riorganizza-tutto.sh`): `import:workflow --input=E:/n8n/officina-sonora/officina-sonora-workflow.json`, poi `publish:workflow --id=yogaMusicFactory01`.
- [ ] **Step 4: GitHub:** `gh repo rename officina-sonora --yes`; verificare `git remote -v` e `git fetch`.
- [ ] **Step 5: riavvio e verifica:** `wscript E:\n8n\avvia-automazione.vbs`, abilitare la nuova attivita', togliere la pausa. Atteso: `state\tick.log` con un nuovo "job ... inviato" e poi "salvato E:\Musica di sottofondo\..."; dashboard `http://127.0.0.1:5790/dashboard` con titolo "Officina Sonora"; `Get-ScheduledTaskInfo OfficinaSonoraSupervisor` con `LastTaskResult` 0.
- [ ] **Step 6:** dire all'utente di cambiare, se vuole, il nome del bot da BotFather.

### Task 3: Scrittura e validazione dello score

**Files:** Create: `src/compositore/abc.js`, `tools/test/abc.test.js`

**Interfaces — Produces:**
```
Nota    = { midi: number|null, durata: number /* in 1/32 */, lega?: boolean }
Battuta = { accordi: [{ pos: number, sigla: string }], vocal: Nota[]|null, ins: Nota[]|null }  // null = battuta di pausa
Sezione = { nome: 'intro'|'verse'|'pre-chorus'|'chorus'|'bridge'|'interlude'|'outro', metro?: string, tonalita?: string, battute: Battuta[] }
Score   = { bpm: number, metro: string, tonalita: string /* 'Am', 'G', 'F#m' */, sezioni: Sezione[] }
scriviAbc(score): string                 // lancia Error se il risultato non supera leggiAbc
leggiAbc(testo): { errori: string[], score: Score|null }
durataSecondi(score): number
lyricsDaScore(score, { forma: 'semplice'|'tempi'|'indicazioni', note?: string[] }): string
```
Regole: gruppi di 1-4 battute `V: Vocal` poi `V: Ins`; accordo davanti alla nota in `Vocal`, spezzando nota o pausa (con legatura se nota) quando cade in mezzo; durate non ammesse spezzate e legate; alterazioni relative all'armatura, valide fino a fine battuta e per lettera in tutte le ottave. `interlude` nelle lyrics diventa `bridge`.

- [ ] **Step 1: test che falliscono**

```js
const A = require('../../src/compositore/abc.js');
const n = (midi, durata, lega) => ({ midi, durata, ...(lega ? { lega } : {}) });
const base = (ins, extra = {}) => ({ bpm: 120, metro: '4/4', tonalita: 'G', sezioni: [{ nome: 'verse', battute: [{ accordi: [{ pos: 0, sigla: 'Gmaj7' }, { pos: 16, sigla: 'Am7' }], vocal: null, ins }] }], ...extra });

test('intestazione e voci', () => {
  const t = A.scriviAbc(base([n(67, 32)]));
  for (const r of ['X:1', 'M:4/4', 'L:1/32', 'Q:1/4=120', 'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"', 'V: Ins clef=treble name="Ins Melody" snm="Inst."', 'K:G', '% verse']) assert.ok(t.split('\n').includes(r), r);
  assert.ok(t.includes('"Gmaj7"z16"Am7"z16|'));
});
test('armatura e alterazioni per lettera', () => {
  // in Sol: Fa# senza segno, Fa naturale col segno, e vale anche all'ottava sopra
  const t = A.scriviAbc(base([n(66, 8), n(65, 8), n(77, 8), n(78, 8)]));
  assert.ok(t.includes('F8=F8f8^f8|'), t);
});
test('durata 10 spezzata e legata', () => {
  assert.ok(A.scriviAbc(base([n(60, 10), n(null, 22)])).includes('C8-C2'));
});
test('andata e ritorno', () => {
  const s = base([n(66, 16), n(69, 16)]);
  const r = A.leggiAbc(A.scriviAbc(s));
  assert.deepEqual(r.errori, []);
  assert.deepEqual(r.score.sezioni[0].battute[0].ins, s.sezioni[0].battute[0].ins);
});
test('errori', () => {
  assert.throws(() => A.scriviAbc(base([n(60, 31)])), /battuta/);
  assert.throws(() => A.scriviAbc(base([n(60, 32, true)])), /legatura/);
  const buono = A.scriviAbc(base([n(60, 32)]));
  for (const rotto of [buono.replace('Gmaj7', 'Gmaj9'), buono.replace('C32', '[CE]32'), buono.replace('C32', '(3CCC'), buono + 'V: Basso\n'])
    assert.notDeepEqual(A.leggiAbc(rotto).errori, []);
});
test('durata e lyrics', () => {
  const s = base([n(60, 32)]);
  assert.equal(A.durataSecondi(s), 2);
  assert.equal(A.lyricsDaScore(s, { forma: 'semplice' }), '[verse]');
  assert.equal(A.lyricsDaScore(s, { forma: 'tempi' }), '[verse 0:00-0:02]');
  assert.equal(A.lyricsDaScore(s, { forma: 'indicazioni', note: ['guitar theme'] }), '[verse - guitar theme]');
});
```
Aggiungere: metro `3/4` e `7/8` in una sezione (battute da 24 e 28), cambio di tonalita', legatura attraverso la stanghetta (la nota legata mantiene l'altezza), e lettura senza errori dell'esempio ufficiale a due battute riportato nella spec dell'ABC (`"Gmaj7"B8d8"Am7"c8A8|"D7"F16"G"G16|` con `Z2|`).

- [ ] **Step 2:** `node --test tools/test/abc.test.js` → FAIL "Cannot find module".
- [ ] **Step 3:** implementare le quattro funzioni.
- [ ] **Step 4:** test verdi.
- [ ] **Step 5: commit** "Score ABC: scrittura e validazione per YuE2".

### Task 4: Runner delle prove

**Files:** Create: `tools/prove/score-prova.js`, `tools/prove/prove-motore.js`, `tools/test/prove.test.js`

**Interfaces:**
- Consumes: Task 3.
- Produces: `score-prova.js` esporta `{ surf: Score, cinematico: Score }`; `prove-motore.js` esporta `griglia(): Prova[]` (`{ id, brano, variante, body }`) ed `esegui({ prove, motore, cartella, attesaMs }): Esito[]` (`{ id, stato: 'ok'|'fallita'|'saltata', motivo?, file?, troncato?: boolean }`).

Score di prova (circa 120 s ciascuno, scritti con le strutture del Task 3):
- `surf`: 136 bpm, 4/4, Mi minore; intro, verse, chorus, verse variato (sequenza del tema), bridge in stop-time, chorus, outro; tema di 2 battute in `Ins`, accordi Em, C, B7, Am7.
- `cinematico`: 92 bpm, Re minore; intro 3/4, tema 4/4, interlude 7/8, ripresa in Fa maggiore, climax, outro rarefatto; tema esposto, aumentato e frammentato.

Griglia (seed fisso 424242, stesso `style` inglese per brano, `output_format: 'mp3'`, `semantic_sampling.max_tokens = min(9000, ceil(durata*25*1.15))`):

| Variante | Richiesta | Brani |
|---|---|---|
| A attuale | `cot: melody`, senza abc, `-kto`, tag come oggi | entrambi |
| B score nativo | `cot: full`, senza abc, `yue2-instrumental` | entrambi |
| C nostro, tag semplici | `cot: full`, abc, `yue2-instrumental` | entrambi |
| D tag con tempi | come C, forma `tempi` | entrambi |
| E tag con indicazioni | come C, forma `indicazioni` | entrambi |
| F KTO | come C, `-kto` | entrambi |
| G LoRA di genere | come C + `yue2-epic-trailer` (`ar_scale 0.5, nar_scale 0.375`) | cinematico |
| H slider | come C + `yue2-slider-indie-rock` (`ar_scale 0.25, nar_scale 0`) | surf |

Adapter strumentali: `{ name, scale: 1, ar_scale: 1, nar_scale: 0 }`. L'opzione `harmony` non si prova: i suoi parametri non sono documentati.

- [ ] **Step 1: test che falliscono**, con un motore finto (`http.createServer`):
  - `griglia()` ha 14 prove, id unici; ogni `body.abc` supera `leggiAbc` senza errori; durata di ogni score tra 105 e 135 s;
  - nessuna lyrics di C-H contiene tag fuori dai sei ammessi;
  - con `/synth` che risponde 400 alla seconda prova, `esegui` ritorna `fallita` per quella e `ok` per le altre;
  - con adapter assente da `GET /props` (o 400 sull'adapter) lo stato e' `saltata` col nome in `motivo`;
  - un risultato la cui durata audio e' sotto l'85% di quella dello score ha `troncato: true`.
- [ ] **Step 2:** `node --test tools/test/prove.test.js` → FAIL.
- [ ] **Step 3:** implementare. Un job alla volta (`POST /synth`, `GET /job?id=`, `GET /job?id=&result=1`); per ogni prova salvare in `E:\Musica di sottofondo\_prove\<data>\<id>\` `richiesta.json`, `audio.mp3` e le parti JSON del multipart (contengono lo score restituito; riusare l'estrazione di `extractAudio` in `src/lib.js` per l'audio). Durata audio con `E:\MusicAI\ffmpeg\bin\ffprobe.exe` se presente, altrimenti dai byte a 128 kbps. Generare `index.html` con un player per prova, richiesta, avvisi e campi voto "tema seguito / struttura / voci / qualita'" (1-5) salvabili come testo da copiare. Le prove gia' `ok` non si ripetono al rilancio. Verificare che `libraryTracks`, voti e analisi ignorino `_prove` (i file si chiamano `richiesta.json` senza `titolo`: aggiungere un test su `libraryTracks` che salta `_prove` come `_scartati`).
- [ ] **Step 4:** test verdi, tutta la suite verde.
- [ ] **Step 5: commit** "Prove sul motore: score, griglia A/B e pagina di ascolto".

### Task 5: Esecuzione delle prove e decisioni

**Files:** Create: `docs/superpowers/specs/2026-11-27-esito-prove-motore.md`

- [ ] **Step 1:** pausa dalla dashboard, attendere `job: null`; `ferma-automazione.vbs`; creare `state\STOP` (cosi' il supervisore non riavvia).
- [ ] **Step 2:** avviare solo `yue-server.exe` con gli stessi argomenti di `watchdog.ps1`; verificare `/health`.
- [ ] **Step 3:** `node tools/prove/prove-motore.js` in background (circa 14 render, 1-2 ore).
- [ ] **Step 4:** ripristinare **sempre**, anche se le prove falliscono: eliminare `state\STOP`, `avvia-automazione.vbs`, togliere la pausa; verificare un nuovo "job ... inviato".
- [ ] **Step 5:** dare all'utente il link a `index.html` e attendere i suoi ascolti. Non decidere al posto suo: l'audio non e' verificabile dai test.
- [ ] **Step 6:** scrivere l'esito: LoRA strumentale scelta, forma delle lyrics, score nostro contro nativo, cambi di metro e tonalita' seguiti o no, LoRA di genere, troncamenti. Se lo score nostro risulta peggiore del nativo, aggiornare la spec (ripiego del punto 17) prima del piano 2.
- [ ] **Step 7: commit** "Esito delle prove sul motore".
