# Copertine e metadati per la libreria iBroadcast

Stato: **in attesa di approvazione**. Stile delle copertine già approvato sui campioni.

## Intento
Pubblicare su iBroadcast una libreria completa: tag ID3 e metadati curati, copertine che identifichino
a colpo d'occhio il genere, diverse da brano a brano e coerenti dentro ogni album.

## Obiettivi
- Copertina 1000x1000 JPEG per ogni brano: sfondo AI del genere + titolo, genere e artista scritti dal codice.
- Tag ID3v2.3 completi in ogni MP3.
- Nomi album leggibili.
- I 116+ brani già online aggiornati senza perdere voti.

## Non obiettivi / da evitare
- Nessun servizio online a pagamento o esterno per le immagini.
- Nessuna generazione AI durante la produzione musicale (la GPU da 6 GB la rallenta).
- Testo generato dall'AI nelle immagini.
- Cestinare una vecchia copia prima che la nuova sia caricata e organizzata.

## Vincoli
- WebUI in `E:\StableDiffusion\webui`, solo `--api`, mai `--share`; modello `Deliberate_v6`.
- Circa 2 minuti per immagine in `--lowvram` con GPU condivisa; senza condivisione non misurato.
- iBroadcast legge titolo, artista, album, artista album, numero traccia, genere, anno e la copertina
  del brano. Non ha un campo copertina per l'album: deriva dai brani. Gli altri tag servono ai file locali.
- `@resvg/resvg-wasm` e ffmpeg sono già installati.

## Strade considerate
1. **Sfondi pre-generati + titolo composto al volo (scelta, approvata).** Qualità AI, nessun impatto sulla
   produzione, testo sempre leggibile. Limite: gli sfondi si ripetono dopo 8 brani dello stesso genere.
2. Immagine AI unica per ogni brano: sempre diversa, ma contende la GPU a ogni brano.
3. Sola grafica vettoriale: immediata, ma meno ricca.
4. Pollinations online: limiti di frequenza, possibile logo, nessuna garanzia.

## Progetto

### 1. Descrizione per genere
In `config\catalogo.json`, campo `copertina` per ognuno dei 39 generi: `etichetta` (es. "Yin & Savasana",
"Metal"), `prompt` in inglese (soggetto, tecnica, colori), `font` (font di Windows) e `corsivo`.
Un genere aggiunto senza questo campo usa nome ripulito, prompt ricavato da `stile`, font Georgia.
I prompt dei campioni vanno corretti: campane tibetane riconoscibili (non pentole), sole a righe e griglia
neon per Synthwave, cancello visibile o soggetto diverso per Metal, chitarra senza sedia confusa per Bossa.

### 2. Sfondi: `tools\genera-sfondi.js`
- 8 sfondi 768x768 per genere in `assets\sfondi\<categoria>\NN.jpg` (esclusi da git).
- Riprendibile: genera solo i file mancanti. Per rifare un'immagine sbagliata la si cancella e si rilancia.
- Mette in pausa la produzione (comando `pausa` esistente), aspetta la fine del render in corso, avvia la
  WebUI, genera, la chiude e ripristina lo stato di pausa precedente anche in caso di errore.
- Un foglio d'insieme JPEG per genere per il controllo a vista.
- Durata stimata fino a circa 10 ore per 312 immagini; si può fare a tranche.

### 3. Composizione: nel gateway
Nuovo endpoint locale `/copertina` (categoria, titolo, numero traccia) -> JPEG. Sfondo scelto con
`numero_traccia` modulo il numero di sfondi. Impaginazione dei campioni: sfumatura in basso, barra ed
etichetta nel colore del genere, titolo che va a capo e si riduce per stare nel riquadro (anche con parole
lunghe), "YOGA MUSIC FACTORY". Se mancano sfondi o la composizione fallisce, si usa la copertina attuale
`coverPng` e il brano è marcato per essere rifatto: il caricamento non si blocca.

### 4. Tag ID3v2.3 (`src\lib-ibroadcast.js`)
| Frame | Contenuto |
|---|---|
| TIT2, TPE1, TPE2 | titolo, artista |
| TALB | etichetta del genere |
| TRCK | numero progressivo globale (invariato) |
| TCON | genere (come oggi) |
| TYER, TDAT | anno e giorno/mese di generazione |
| TIT1, TIT3 | famiglia, tipo |
| TBPM, TKEY, TLEN | bpm, tonalità (formato ID3, es. "Am"), durata reale in ms |
| TCOM, TPUB, TCOP, TENC | Yoga Music Factory |
| TLAN | `zxx` (nessuna lingua) |
| TXXX | MOOD, ENERGIA, ATTIVITA, STRUTTURA, STRUMENTI, VARIANTE, SEED |
| COMM | descrizione leggibile |
| APIC | JPEG copertina anteriore |

Il `.json` del brano riceve `id3_versione: 2`; i brani con versione inferiore rientrano in coda.

### 5. Aggiornamento dei brani online
1. Prova su 3 brani di generi diversi; si controllano su iBroadcast copertina del brano e dell'album,
   nome album, genere. **Serve il tuo OK prima di continuare.**
2. Gli altri, in ordine di numero. Parte solo quando gli sfondi dei generi presenti sono pronti.
3. Per ogni brano: carica, attendi tag e playlist, trasferisci la valutazione a stelle sul nuovo id,
   poi cestina il vecchio id. Mappa vecchio->nuovo salvata su file; operazione riprendibile.
4. Il trasferimento delle stelle richiede un nuovo modo nel gateway (API di valutazione iBroadcast, **da
   verificare**). Se non funziona, ci si ferma prima di cestinare i brani valutati.
5. I voti locali nei `.json` e in `feedback.csv` restano. Gli ascolti su iBroadcast ripartono da zero.
   Eventuali playlist create a mano vengono aggiornate con il nuovo id.

## Controlli
Un test rilegge i frame di un MP3 di prova (testi, TXXX, APIC) e uno compone copertine con titoli corti,
lunghi e con caratteri `& <`. L'audio dopo i tag deve avere la stessa impronta di prima.

## Lasciato a chi implementa
Prompt dei singoli generi, scelta dei font, formato della mappa, cadenza del ricaricamento.
