# Yoga Music Factory

Un sistema automatico che **crea musica di sottofondo strumentale** (e vocale senza parole) in modo continuo,
la organizza in una libreria ordinata e la pubblica su **iBroadcast** con copertine, tag e playlist.
Pensato per i centri yoga, ma utilizzabile per qualsiasi sottofondo.

Il sistema lavora da solo: crea un brano alla volta, lo controlla, lo carica, ti avvisa su Telegram
e impara dai voti che dai su iBroadcast e su Telegram.

---

## Indice

1. [Cosa fa, in breve](#1-cosa-fa-in-breve)
2. [Come funziona](#2-come-funziona)
3. [Cosa serve per farlo girare](#3-cosa-serve-per-farlo-girare)
4. [Avvio e arresto](#4-avvio-e-arresto)
5. [Dove guardare: dashboard, iBroadcast, Telegram](#5-dove-guardare-dashboard-ibroadcast-telegram)
6. [Come votare i brani](#6-come-votare-i-brani)
7. [Struttura delle cartelle](#7-struttura-delle-cartelle)
8. [Generi, famiglie e categorie](#8-generi-famiglie-e-categorie)
9. [Aggiungere un genere](#9-aggiungere-un-genere)
10. [Sicurezza e segreti](#10-sicurezza-e-segreti)
11. [Risoluzione dei problemi](#11-risoluzione-dei-problemi)
12. [Per chi sviluppa](#12-per-chi-sviluppa)
13. [Cosa non è in questo repository](#13-cosa-non-e-in-questo-repository)

---

## 1. Cosa fa, in breve

- Genera brani di musica in continuo, uno alla volta, con il motore **YuE2** in esecuzione sul tuo PC.
- Ogni brano riceve un titolo e una descrizione scritti da un modello linguistico locale (**LM Studio**, modello gemma).
- Controlla ogni file (durata, integrità, livello del suono, silenzi) e scarta quelli difettosi.
- Assegna un **numero progressivo unico**, che non si ripete mai.
- Salva il brano nella libreria, con i metadati (titolo, genere, bpm, tonalità, durata, ecc.) e la copertina.
- Lo carica su **iBroadcast** con tag e playlist.
- Ti manda un messaggio **Telegram** per ogni brano caricato.
- Legge i tuoi voti su iBroadcast e su Telegram, e usa i voti per decidere i generi e le ricette da produrre.
- Ogni giorno, dopo le 8, invia un **rapporto** con lo stato del sistema.

Non devi fare nulla di manuale: una volta avviato, continua da solo e si riprende in caso di blocchi.

---

## 2. Come funziona

```
            ogni minuto
   n8n  ─────────────────►  scelta del genere (rotazione tra i generi)
    │                              │
    │                              ▼
    │                        titolo e descrizione (gemma, LM Studio)
    │                              │
    │                              ▼
    │                        render del brano (YuE2)
    │                              │
    │                              ▼
    │                        controllo qualità (durata, file, suono)
    │                              │
    │                 ┌────────────┴────────────┐
    │                 ▼                         ▼
    │          scartato (_scartati)     metadati + copertina
    │                                           │
    │                                           ▼
    │                                  upload su iBroadcast
    │                                  (tag e playlist dopo qualche minuto)
    │                                           │
    │                                           ▼
    └──────────────────────────────────  notifica Telegram
```

Oltre al ciclo di produzione, n8n esegue in parallelo:

| Attività | Frequenza | Cosa fa |
|---|---|---|
| Voti da iBroadcast | ogni 10 minuti | legge stelle, tag e playlist che hai messo sui brani |
| Comandi Telegram | ogni minuto | risponde ai tuoi comandi e alle tue risposte |
| Avvisi Telegram | ogni minuto | ti scrive solo per errori gravi che richiedono il tuo intervento |
| Rapporto giornaliero | una volta al giorno, dopo le 8 | riepilogo di brani, voti, errori, stato del sistema |

**Il meccanismo di apprendimento.** Ogni ricetta (genere, tipo, struttura, fascia di bpm) ha un punteggio.
I tuoi voti pesano molto più dei dati automatici. Il sistema prova anche ricette nuove, in quantità limitata,
per non restare sempre sulle stesse. Le linee guida (stile, bpm, strutture preferite) vengono riviste periodicamente
e ogni versione viene archiviata.

**Il meccanismo di rotazione dei generi.** Il genere del prossimo brano viene scelto dando più peso a quelli
con meno brani in libreria. Così i generi nuovi vengono prodotti per primi e nessun genere domina.

---

## 3. Cosa serve per farlo girare

Il sistema è pensato per **Windows 11** con questi componenti installati:

| Componente | Dove si trova | Note |
|---|---|---|
| **n8n** 2.x | `E:\n8n` (installato con npm) | è il "direttore d'orchestra" del ciclo di produzione |
| **Node.js** 24 | nel PATH di Windows | serve per il gateway e i test |
| **YuE2 Studio** | `E:\MusicAI\YuE2 Studio` | il motore che genera la musica (su GPU) |
| **LM Studio** | installato, server su `127.0.0.1:1234` | modello `google/gemma-4-e4b` |
| **Account iBroadcast** | [ibroadcast.com](https://ibroadcast.com) | dove vengono caricati i brani |
| **Bot Telegram** | creato con [@BotFather](https://t.me/BotFather) | per i messaggi e i comandi |

La libreria dei brani va in `E:\Musica di sottofondo`.

---

## 4. Avvio e arresto

I due file di avvio si trovano in `E:\n8n` (accanto alla cartella di installazione di n8n), **non** in questo repository:

- **`avvia-automazione.vbs`**: avvia tutto in background, senza finestre. Il watchdog tiene in vita gateway, n8n,
  LM Studio e il motore YuE2.
- **`ferma-automazione.vbs`**: ferma tutto. LM Studio resta acceso.

Per l'avvio e l'arresto basta fare doppio clic sul file.

**Controllo automatico.** Un'attività pianificata di Windows, chiamata `YogaMusicSupervisore`, controlla ogni
5 minuti che il watchdog sia vivo e lo riavvia se si è bloccato. Se hai fermato l'automazione a mano, non la riavvia.

---

## 5. Dove guardare: dashboard, iBroadcast, Telegram

### Dashboard (stato in tempo reale)

**[http://127.0.0.1:5790/dashboard](http://127.0.0.1:5790/dashboard)**

Si apre nel browser **solo dal tuo PC** (l'indirizzo `127.0.0.1` non è raggiungibile da altri dispositivi).
Si aggiorna da sola ogni 5 secondi e mostra:

- quali servizi sono attivi (n8n, motore YuE2, LM Studio, modello gemma);
- il render in corso: titolo, genere, tempo trascorso, stima di avanzamento;
- la coda, i brani generati e quelli scartati, lo spazio su disco;
- il battito del watchdog e l'ultimo controllo del supervisore;
- le ultime esecuzioni di n8n e le ultime righe del log di produzione.

Se la pagina non si apre, l'automazione è ferma: avviala con `avvia-automazione.vbs`.

### iBroadcast

**[https://ibroadcast.com](https://ibroadcast.com)**: accedi con il tuo account per ascoltare i brani.
Ogni brano ha:

- **titolo**, **copertina** e un **numero di traccia** progressivo, unico per tutta la libreria;
- **album**: il nome della categoria (per esempio *Vinyasa-dinamico*);
- **tag**: ambito (`yoga` o `musica`), famiglia, categoria, energia, struttura, tipo;
- **playlist**: una per categoria, con nome `Yoga - <categoria>` o `Musica - <categoria>`.

I tag e le playlist vengono applicati alcuni minuti dopo il caricamento, perché iBroadcast deve prima elaborare il brano.

### Telegram

Il bot ti scrive:

- **a ogni brano caricato**: titolo, categoria, genere, tipo, durata, bpm, tonalità, numero e tempo di render;
- **ogni giorno dopo le 8**: il rapporto giornaliero;
- **solo per errori gravi** che richiedono il tuo intervento (per esempio token scaduto o disco pieno).

Comandi disponibili:

| Comando | Cosa fa |
|---|---|
| `/stato` | a che punto siamo: brani, coda, errori |
| `/annulla` | scarta le modifiche in attesa |
| `/aiuto` | elenco dei comandi |

Puoi anche scrivere in italiano cosa vuoi cambiare, per esempio: *"Vinyasa più ritmato, bpm tra 100 e 120"*.

---

## 6. Come votare i brani

Vota direttamente dall'app iBroadcast, con le stesse regole per tutti i generi:

- **Stelle** (da 1 a 5) sul brano.
- **Tag** `preferito`, `scarta` oppure `voto-N` (N da 1 a 5).
- **Playlist** con lo stesso nome dei tag.
- **Tag** `piu-veloce` o `piu-lento`: spostano il bpm del genere di 6, entro un limite di 15 dalla fascia base.
- **Cestino**: un brano nel cestino vale come voto 1, se non c'è un segnale migliore.

I tag e le playlist creati dal sistema (`yoga`, `musica`, `famiglia-*`, `categoria-*`, ecc.) **non contano** come voti.

I voti vengono letti ogni 10 minuti. Puoi anche votare da Telegram con i comandi del bot.

---

## 7. Struttura delle cartelle

### Questo repository (`E:\n8n\yoga`)

| Cartella / file | Contenuto |
|---|---|
| `src\blocks\` | i blocchi del ciclo di produzione, uno per ogni nodo di n8n |
| `src\lib.js`, `src\lib-apprendimento.js`, `src\lib-ibroadcast.js` | funzioni condivise: scelta delle ricette, file audio, upload, tag |
| `src\cover.js` | generazione delle copertine PNG |
| `config\catalogo.json` | l'elenco dei generi: stile, strumenti, bpm, varianti, colori |
| `config\guidance.json` | le linee guida correnti (stile, bpm, strutture preferite) |
| `config\history\` | archivio delle versioni precedenti delle linee guida |
| `gateway\` | il servizio locale che tiene i token e parla con iBroadcast e Telegram |
| `gateway\dashboard.html`, `gateway\stato.js` | la dashboard di stato |
| `tools\` | script di manutenzione usati nel tempo (correzioni, migrazioni, prove) |
| `tools\test\` | test automatici |
| `watchdog.ps1`, `supervisore.ps1`, `supervisore.vbs`, `stop.ps1` | sorveglianza e arresto |
| `build-workflow.mjs` | genera il workflow di n8n dai blocchi in `src\` |
| `yoga-workflow.json` | il workflow generato, pronto per essere importato in n8n |

### Fuori dal repository

| Cartella | Contenuto |
|---|---|
| `E:\Musica di sottofondo\` | la **libreria** dei brani (non va su Git: sono file audio) |
| `E:\Musica di sottofondo\_scartati\` | brani scartati dal controllo qualità |
| `E:\Musica di sottofondo\feedback.csv` | voti manuali (file; voto; nota) |
| `E:\n8n\yoga\state\` | stato in esecuzione: coda, log, contatori, battito (non va su Git) |
| `E:\n8n\yoga\secrets\` | token cifrati con DPAPI (non va su Git) |

**Organizzazione della libreria:**
```
E:\Musica di sottofondo\
  Yoga\<famiglia>\<categoria>\<tipo>\        brano.mp3 + brano.json
  Sottofondo\<famiglia>\<categoria>\<tipo>\  brano.mp3 + brano.json
```

---

## 8. Generi, famiglie e categorie

Ogni brano appartiene a tre livelli:

1. **Ambito** (il target): `Yoga` per la pratica yoga, `Sottofondo` per tutto il resto.
2. **Famiglia** (il carattere): `meditativo`, `ritmico`, `rock`, `elettronico`, `orchestrale`, `world`, `jazz`.
3. **Categoria** (il genere preciso): per esempio *Vinyasa-dinamico*, *Synthwave* o *Gamelan ambient*.

Il catalogo oggi contiene **39 generi**: quelli per lo yoga (meditazione, respiro, asana, rilassamento) e
quelli per il sottofondo (rock e metal strumentali, elettronica, jazz, world, canti senza parole, ecc.).

Per **i generi vocali senza parole** (per esempio *Vocalise coro* o *Canto armonico overtone*) la voce è usata
come strumento, senza testo cantato, e il sistema non applica il filtro che elimina la voce.

---

## 9. Aggiungere un genere

1. Apri `config\catalogo.json` e aggiungi una voce con: `name`, `ambito`, `famiglia`, `energia` (da 1 a 5),
   `bpm` (per esempio `[90, 110]`), `attivita`, `strutture`, `genere`, `stile`, `strumenti`, `vietati`,
   `influenze`, `enfasi`, `melodia`, `accordi`, `ritmica`, `tonalita`, `varianti`, `colori` (tre colori esadecimali).
   Per un genere vocale senza parole aggiungi anche `"vocale_senza_parole": true`.
2. Ricostruisci il workflow e pubblicalo (vedi [per chi sviluppa](#12-per-chi-sviluppa)).

Il nuovo genere riceve subito i suoi tag, la sua playlist, i suoi voti e la sua copertina: non serve altro.

---

## 10. Sicurezza e segreti

- I **token** (Telegram e iBroadcast) sono salvati cifrati in `secrets\` con **DPAPI**: possono essere letti solo
  dal tuo utente di Windows, su questo PC. Non sono nel repository.
- Solo il **gateway** conosce i token. I blocchi di n8n chiamano il gateway su `127.0.0.1` e non li vedono mai.
- Il gateway accetta solo richieste dal tuo PC e solo le operazioni previste.
- La **dashboard** è di sola lettura e non mostra token.
- Il file `config\telegram.json` (con il tuo chat ID) **non è nel repository**: va ricreato a mano (vedi sotto).

**Se rigeneri i token** (per esempio dopo una password cambiata): esegui `ibroadcast-login.ps1` e segui le istruzioni,
oppure aggiorna il token Telegram in `secrets\telegram.dpapi`.

**Ricreare `config\telegram.json`:**
```json
{
  "chat_id": 123456789
}
```
Sostituisci il numero con il tuo chat ID Telegram.

---

## 11. Risoluzione dei problemi

| Sintomo | Cosa fare |
|---|---|
| La dashboard non si apre | l'automazione è ferma: esegui `avvia-automazione.vbs` |
| Nessun brano da molto tempo | apri la dashboard: controlla quali servizi sono spenti |
| Il motore YuE2 non risponde | il watchdog lo riavvia da solo; verifica `state\watchdog.log` |
| Il Telegram dice "token non valido" | rigenera il token e aggiornalo (vedi sezione sicurezza) |
| Un brano non compare su iBroadcast | cerca in `state\errori.jsonl` e in `state\tick.log` |
| Si vuole fermare tutto | esegui `ferma-automazione.vbs` (il supervisore non riavvia nulla) |

**Dove sono i log:**
- `state\tick.log`: cosa fa la produzione, passo per passo.
- `state\watchdog.log`: avvii e riavvii dei servizi.
- `state\supervisore.log`: interventi del supervisore.
- `state\errori.jsonl`: errori raggruppati per tipo.

---

## 12. Per chi sviluppa

**Requisiti:** Node.js 24, Git.

**Test automatici** (dalla cartella del progetto):
```powershell
node --test tools/test/lib.test.js
node --test tools/test/stato.test.js
```

**Modificare un blocco e pubblicarlo in n8n:**
```powershell
node build-workflow.mjs
```
Poi importa `yoga-workflow.json` in n8n e pubblicalo con il comando di n8n `publish:workflow --id=yogaMusicFactory01`.
Prima di ripubblicare, verifica che non ci sia un render in corso (`state\pipeline.lock` assente), perché il riavvio
di n8n interrompe la pipeline.

**Storico:** il repository contiene la storia completa delle modifiche. Ogni versione importante ha un messaggio di commit.

---

## 13. Cosa non è in questo repository

Per tenere il repository leggero e sicuro, non sono inclusi:

- l'installazione di **n8n** e i file di avvio `avvia-automazione.vbs` e `ferma-automazione.vbs` (in `E:\n8n`);
- il **motore YuE2** e i suoi modelli;
- i **modelli** di LM Studio;
- la **libreria audio** (`E:\Musica di sottofondo`);
- i **segreti** e lo **stato** di esecuzione.

Chi volesse ricostruire tutto da zero deve reinstallare questi componenti e ricreare `config\telegram.json`
e i token.
