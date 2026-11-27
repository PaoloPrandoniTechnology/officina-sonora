# Musica di sottofondo: struttura del progetto

Il progetto produce musica strumentale di sottofondo, per centri yoga e per qualsiasi altro uso.
Tre livelli definiscono ogni brano.

## 1. Ambito (il target)
- **Yoga**: generi pensati per la pratica (meditazione, respiro, asana, rilassamento).
- **Sottofondo**: tutti gli altri generi (rock strumentale, elettronica, jazz, world, orchestrale, hip-hop...).

## 2. Famiglia (il carattere)
Raggruppa generi con lo stesso carattere: `meditativo`, `ritmico`, `rock`, `elettronico`, `orchestrale`, `world`, `jazz`.
Ogni genere ha una famiglia. Su iBroadcast ogni brano riceve il tag `famiglia-<nome>`.

## 3. Categoria (il genere preciso)
Ogni categoria ha stile, strumenti (solo quelli del suo set), divieti, influenze, melodia, accordi, ritmica,
tonalita, varianti e colori per la copertina. Si definisce in `config\catalogo.json`.

## Cartelle della libreria
```
E:\Musica di sottofondo\
  Yoga\<famiglia>\<categoria>\<tipo>\      brano.mp3 + brano.json
  Sottofondo\<famiglia>\<categoria>\<tipo>\ brano.mp3 + brano.json
  _scartati\                              brani non superati dal controllo qualita
  feedback.csv                            voti manuali (file;voto;nota)
```

## Tag e playlist su iBroadcast
- Tag di ambito: `yoga` oppure `musica` (per il sottofondo).
- Tag di famiglia: `famiglia-<nome>`; di categoria: `categoria-<nome>`; di energia: `energia-<n>`; di struttura e tipo.
- Playlist: `Yoga - <categoria>` oppure `Musica - <categoria>` (il nome "musica" e' quello usato per il sottofondo).

## Come votare (tutti i generi)
Dall'app iBroadcast, con le stesse regole per ogni genere:
- valutazione a stelle (1-5);
- tag `preferito` / `scarta` / `voto-N`, oppure playlist con lo stesso nome;
- tag `piu-veloce` / `piu-lento`: spostano il bpm del genere di 6, entro 15 dalla fascia base.
Le playlist e i tag di sistema non contano come voti.

## Aggiungere un genere
1. Aggiungi una voce a `config\catalogo.json` con: `name`, `ambito`, `famiglia`, `energia`, `bpm`, `attivita`,
   `strutture`, `genere`, `stile`, `strumenti`, `vietati`, `influenze`, `enfasi`, `melodia`, `accordi`, `ritmica`,
   `tonalita`, `varianti`, `colori`.
2. Nessun altro intervento: tag, playlist, voti, copertina e tempo funzionano da soli.

## Blocchi del workflow n8n
Il workflow "Yoga Music Factory" e' costruito da `build-workflow.mjs` a partire dai blocchi in `src\blocks\`:
- 1-2: stato e controllo del render
- 3a-3b: scarica audio e scrive i metadati
- 3c: controllo qualita
- 3d1-3d4: prepara, carica su iBroadcast, recupera tag e playlist, registrazione
- 4: revisione delle linee guida
- 5a-5c: scelta della ricetta, titolo, composizione dello stile
- 6-7: invio del render e scrittura dello stato
- 8a-8b: comandi Telegram e avvisi
- 9: rapporto giornaliero
- 10: voti da iBroadcast (ogni 10 minuti)
- 11: riepilogo Telegram (impostazioni in `config\parametri.json`, logica in `src\lib-messaggi.js`)

## Affidabilita'
- **Lock di pipeline**: `state\pipeline.lock` impedisce esecuzioni sovrapposte del workflow. Scade dopo 15 minuti
  in caso di crash. I voti (10) aspettano che il lock sia libero prima di scrivere `guidance.json`.
- **Supervisore**: l'attivita' pianificata `YogaMusicSupervisore` gira ogni 5 minuti (`supervisore.vbs`).
  Riavvia il watchdog se e' morto o se il suo battito (`state\watchdog.heartbeat`) e' fermo da 15 minuti.
  Non fa nulla se esiste `state\STOP`. Log: `state\supervisore.log`.
- **Controllo audio (3c)**: il gateway analizza il brano (livello, silenzi, clipping) con `mpg123-decoder`.
  Scarta solo i brani quasi silenziosi (sotto -45 dB) o silenziosi per piu' della meta'. Il clipping genera
  solo un avviso. Se l'analisi non e' disponibile il brano passa con il solo controllo strutturale.
- **Git**: la cartella e' un repository. `.gitignore` esclude segreti e `state\`.
- **Test**: `node --test tools/test/lib.test.js` (lock, stile, numerazione, catalogo).

## Comandi utili
- Avvia: `avvia-automazione.vbs`
- Ferma: `ferma-automazione.vbs`
- Log di produzione: `state\tick.log`
- Test: `node --test tools/test/lib.test.js`
- Dopo modifiche ai blocchi: `node build-workflow.mjs`, poi import e publish del workflow
