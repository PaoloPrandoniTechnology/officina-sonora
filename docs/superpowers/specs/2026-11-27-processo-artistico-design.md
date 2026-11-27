# Officina Sonora: nuovo processo artistico (documento di progetto)

Data: 2026-11-27. Stato: **da approvare**.

## 1. Intento
Cambiare in modo drastico come nasce un brano: forme complesse e non banali, generi riconoscibili,
motore YuE2 calibrato per genere (prompt, LoRA, score ABC), molte variazioni e dettagli, lyrics sempre
compilate, un blocco dedicato a creare e revisionare lo score e un agente di ricerca che migliora la
composizione nel tempo. Il progetto cambia nome in **Officina Sonora**.

### Obiettivi
- Ogni brano ha uno score ABC scritto, revisionato, salvato e riproducibile.
- Ogni genere ha una scheda artistica propria; due generi non condividono forme, armonie e ritmi per default.
- Tutto gira in locale, senza costi e senza consumo di Claude.
- Le modifiche proposte dalla ricerca entrano in produzione solo dopo approvazione dell'utente.

### Non obiettivi
- Nessun addestramento di LoRA.
- Nessuna rinomina dei brani gia' pubblicati su iBroadcast.
- Nessun cambio a voti, copertine, Telegram e riepiloghi, salvo quanto serve al nuovo flusso.
- "yoga" resta il nome dell'**ambito** (cartella `Yoga`, tag `yoga`, playlist `Yoga - ...`).

### Fallisce se
- i brani suonano meccanici o tutti uguali, anche se lo score e' formalmente corretto;
- le voci compaiono nei brani strumentali piu' spesso di oggi;
- la produzione si ferma perche' compositore o ricerca falliscono.

## 2. Vincoli
- GPU RTX 3060 Laptop, 6 GB, condivisa tra YuE2 (yue2.cpp, YuE2 Studio) e LM Studio (gemma-4-e4b, si tiene questo).
- I blocchi n8n non hanno `fetch` e parlano solo HTTP locale: le richieste web passano dal gateway.
- Render attuale circa 4-7 minuti per brano; con brani piu' lunghi aumentera'.
- Licenza: pesi YuE2 e molte LoRA sono CC BY-NC (non commerciale). L'uso commerciale va chiarito con gli autori.

## 3. Situazione attuale (verificata)
- Nessuno score scritto: `cot: melody` (senza accordi), score del motore scartato.
- Lyrics di soli tag, tra cui `[Build] [Main] [Peak] [Release]`, estranei al vocabolario della LoRA strumentale.
- `style` misto italiano/inglese, con frasi ripetute.
- Usata 1 LoRA (`yue2-instrumental-kto`) su 37 installate.
- Nel log del motore compaiono score e token semantici troncati.
- 39 generi, 5 forme condivise.

## 4. Approcci considerati
| Approccio | Esito |
|---|---|
| **Candidati + revisore**: il codice genera molti score, li valuta, usa il migliore | **Scelto** |
| Un solo score a regole | Scartato: risultati prevedibili |
| YuE2 pianifica, il codice rielabora | Scartato: poco controllo sulla forma. Resta come termine di confronto nelle prove A/B |

Chi compone: solo codice locale (scartati Claude pianificato e API). Ricerca: DuckDuckGo + fonti scelte,
gemma-4-e4b, approvazione dell'utente.

## 5. Flusso nuovo
```
5a scegli ricetta -> 5b titolo e idea (gemma) -> 5c COMPONI SCORE (N candidati)
   -> 5d REVISIONA SCORE (voto, correzioni, scelta) -> 5e prompt, lyrics, LoRA -> 6 invia render
```
La logica sta in moduli testabili (`src/compositore/`), i blocchi la richiamano.

## 6. Score ABC (regole YuE2)
Fonti: `skills/yue2-music/references/abc-editing.md` e `docs/generation.md` del repo ufficiale;
README di yue2.cpp (porting di terze parti).

- Intestazione: `X:1`, `T:`, `M:`, `L:1/32`, `Q:1/4=bpm`, voci `Vocal` e `Ins`, `K:`.
- Due sole voci, **monofoniche**. Nessuna terza voce.
- Strumentali: tema e soli in `Ins`; `Vocal` in pausa, ma porta le **sigle degli accordi** (`"Am7"z32`).
- Accordi ammessi: maggiore, m, dim, aug, 7, maj7, m7, dim7, m7b5, sus4, sus2, 6, m6, 7sus4, m(maj7), con basso `/X`.
- Durate ammesse: 1,2,3,4,6,8,12,16,24,32,48 (le altre con legature). Battute esatte e pari tra le voci; blocchi di 1-4 battute.
- Sezioni come commenti (`% intro`, `% verse`, `% chorus`, `% bridge`, `% interlude`, `% outro`); cambi di metro e tonalita' per gruppo.
- Vietati: gruppi irregolari, abbellimenti, accordi di note, ritornelli, legature di frase, decorazioni, `w:`.
- Il motore **non corregge** uno score fornito: la validazione e' nostra.
- Lo score condiziona, non vincola al millisecondo: durata e timbro effettivi vanno verificati sull'audio.
- Richiesta: `cot: "full"` con `abc`; `cfg_scale` predefinito (1.0). `harmony` (opzione presente nel motore di Studio) solo se le prove ne mostrano il beneficio.

## 7. Compositore
Deterministico dato il seed.

1. **Forma**: scelta dalla grammatica del genere, 7-14 sezioni (es. intro, esposizione, sviluppo, interludio,
   solo, ripresa variata, coda), con lunghezze asimmetriche quando il genere lo consente.
2. **Piano energetico**: densita', registro e tensione per sezione; un climax principale posizionato.
3. **Armonia**: progressioni per funzione di sezione; sostituzioni, prestiti modali, pedali,
   dominanti secondarie, modulazioni, secondo il genere.
4. **Tema**: 1-3 cellule motiviche (ritmo + contorno) nella scala o modo del genere.
5. **Sviluppo**: trasposizione, sequenza, inversione, aumentazione, diminuzione, frammentazione,
   spostamento ritmico, domanda e risposta, ornamento in note reali.
6. **Chicche**: eventi rari dal catalogo del genere (break, stop-time, anacrusi, fill, cambio di metro,
   falsa ripresa, coda trasformata); da 3 a 8 per brano, mai lo stesso insieme di fila.
7. **Durata**: per genere, 3-6 minuti; battute = durata x bpm / (60 x battiti per battuta).

## 8. Revisore
- **Controlli bloccanti**: sintassi, battute, legature, accordi e durate ammesse, estensione dello strumento.
- **Punteggio 0-100**: ritorno riconoscibile del tema senza ripetizione eccessiva; contrasto tra sezioni;
  salti risolti e note dell'accordo sui tempi forti; varieta' ritmica e armonica; posizione del climax;
  cadenza finale; aderenza alla scheda del genere; **novita'** rispetto agli ultimi score del genere.
- Genera 40 candidati, tiene il migliore sopra soglia; correzioni locali, poi nuovo giro.
- Dopo 3 giri senza superare la soglia usa il migliore **valido** e registra un avviso.
- Se nessuno e' valido, il motore compone da se' (`cot: "full"` senza `abc`) e l'errore va negli avvisi.

## 9. Schede artistiche dei generi
`config/generi/<categoria>.json`, in aggiunta a `catalogo.json`:
`forme`, `metri`, `modi`, `progressioni`, `cellule_ritmiche`, `contorni`, `tecniche_sviluppo`,
`chicche`, `registri`, `strumenti_solisti`, `prompt` (vocabolario in inglese: sottogenere, timbro,
strumenti, tecnica esecutiva, spazio/mix, dinamica, per-sezione), `lora`, `soglie_revisore`, `durata`.

Le 39 schede si scrivono durante lo sviluppo, con ricerca per genere, e partono tutte insieme.
Un test impedisce che due generi abbiano forme + progressioni + cellule sovrapposte oltre il 40%.

## 10. Prompt, lyrics, LoRA
**Style**: inglese, ordine fisso (trigger LoRA, sottogenere, strumenti e come suonano, ritmo, armonia,
dinamica e sviluppo, spazio e mix, BPM e tonalita' coerenti con lo score), senza ripetizioni ne' negazioni
vocali; sinonimi e dettagli ruotano a ogni brano. Le note del produttore date da Telegram o dashboard restano.

**Lyrics**: sempre compilate, solo tag `intro, verse, pre-chorus, chorus, bridge, outro`, ricavati dallo
score (le altre sezioni si mappano sul tag piu' vicino). Da provare: tag semplici, tag con tempi
(`[verse 0:15-0:45]`, indicati dall'autore della LoRA come la guida piu' forte alla struttura) e tag con
indicazioni. Le indicazioni si adottano solo se non fanno comparire voci.

**LoRA** (ipotesi di partenza, da confermare a orecchio; le scale partono da quelle di `adapter.json`):

| Generi | Candidate |
|---|---|
| Tutti gli strumentali | `yue2-instrumental` (pensata per lo score) oppure `-kto`; mai insieme |
| Metal, Hard rock | slider-metal, industrial-rock (scala ridotta) |
| Industrial techno | industrial-rock |
| Indie rock, Post-rock | slider-indie-rock |
| Techno minimale | slider-house |
| Synthwave | keygen-music (scala ridotta) |
| Hip-hop, Trip-hop | slider-lofi |
| Funk | slider-disco-funk |
| Afro-latin | slider-afrobeats |
| Folk, Celtic | slider-acoustic-folk |
| Score cinematico | epic-trailer (AR 0.5, NAR 0.375) |
| Reggae/dub | militant-reggae (rischio voce) |
| Vocalise, canto | bulgarian-voices o nessuna; niente LoRA strumentali |

Gli altri generi usano solo la strumentale. Se una LoRA manca sul motore, il brano parte senza e si avvisa.

**Parametri**: `semantic_sampling.max_tokens` calcolato sulla durata (25 al secondo, margine, tetto 9000);
via `abc_sampling` quando forniamo lo score. La durata richiesta deve coincidere con quella dello score.

## 11. Salvataggio e apprendimento
Accanto a ogni mp3: `.abc`; nel `.json`: lyrics, LoRA e scale, forma, chicche, punteggio del revisore, seed.
I voti pesano anche su forma, tecniche, chicche e LoRA, oltre alla ricetta di oggi.
La dashboard mostra score, sezioni e punteggio del brano.

## 12. Agente di ricerca (locale)
- Workflow n8n: un genere al giorno (frequenza e ora modificabili dalla dashboard), solo tra un render e l'altro.
- Il gateway cerca su DuckDuckGo, con priorita' a un elenco di fonti di teoria e composizione.
  Solo URL pubblici http/https (no indirizzi locali o privati, redirect inclusi), limiti di tempo e dimensione.
- gemma estrae **proposte nei campi della scheda** (progressioni, cellule, forme, chicche, parole per il prompt).
- Il codice valida (vocabolario ammesso, teoria, duplicati). Il testo delle pagine e' solo dato:
  non puo' toccare codice, LoRA, parametri o file fuori dalle proposte.
- Dashboard, scheda "Ricerca": proposta, fonte, effetto, Approva / Rifiuta. Le approvate sono versionate e annullabili.
- Limite dichiarato: gemma-4-e4b estrae spunti, non compone; la qualita' delle proposte sara' modesta
  e il vero salto arriva da compositore e schede.

## 13. Rinomina in Officina Sonora
Produzione ferma e backup, poi: cartella `E:\n8n\yoga` -> `E:\n8n\officina-sonora` (e worktree git da riparare),
vbs e script PowerShell, attivita' pianificata `YogaMusicSupervisor`, percorsi e guardie in `lib.js`,
nome del workflow (stesso id, per non duplicarlo), `yoga-workflow.json` -> `officina-sonora-workflow.json`,
dashboard, messaggi, prompt di sistema, artista dei nuovi brani, README e LEGGIMI, repo GitHub
`officina-sonora` e remote. Il nome del bot Telegram, se contiene "yoga", lo cambia l'utente da BotFather.
Verifica finale: nessun riferimento residuo oltre all'ambito `yoga`.

## 14. Fasi
1. Rinomina.
2. Prove sul motore (pochi render, produzione in pausa): score accettato, `yue2-instrumental` contro `-kto`,
   forme delle lyrics, LoRA di genere, confronto con lo score nativo. L'utente ascolta e sceglie.
3. Compositore e revisore, con test.
4. Schede dei 39 generi, prompt, LoRA, durate; passaggio in produzione di tutti insieme.
5. Dashboard e apprendimento.
6. Agente di ricerca.

**Modifica del 27/11 (decisione dell'utente):** la produzione non si ferma per le prove della fase 2.
I miglioramenti vanno direttamente in produzione, a piccoli passi, e si giudicano con ascolto e voti.
Primo passo applicato: tag riconosciuti e forme piu' lunghe, `cot: full`, `yue2-instrumental` con LoRA di
genere (campo `lora` di `catalogo.json`), score `.abc` salvato, stile senza ripetizioni.

## 15. Verifiche
Test automatici: ogni score generato (39 generi, molti seed) supera il parser; durata entro il 5%;
distinzione tra generi; lyrics coerenti con lo score; proposte malevole rifiutate; produzione che continua
quando compositore o LoRA falliscono. L'ascolto e i voti restano il giudizio finale.

## 16. Scelte lasciate a chi sviluppa (modificabili)
40 candidati, soglie del revisore, pesi dell'apprendimento, nomi dei moduli, elenco iniziale delle fonti.

## 17. Rischi e punti aperti
- Non e' dimostrato quanto fedelmente YuE2 segua uno score scritto da regole, ne' come reagisca a cambi di
  metro: lo decide la fase 2. Se suona meccanico, si ripiega sullo score nativo con controllo del revisore.
- Le schede LoRA sono dichiarazioni degli autori, non provate.
- Brani piu' lunghi: meno brani al giorno.
