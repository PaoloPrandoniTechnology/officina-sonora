# Revisione completa: difetti, interfaccia, funzioni (2026-11-28)

Richiesta: analisi di tutto il progetto, correzione dei difetti, interfaccia professionale, più facile da usare.
Esecuzione in autonomia, a produzione accesa.

## 1. Difetti trovati

| # | Gravità | Difetto | Effetto |
|---|---|---|---|
| 1 | alta | Caricamento: una risposta d'errore del gateway valeva come riuscita | brano segnato «caricato» e mai ritentato |
| 2 | alta | Dopo 3 tentativi falliti il brano non rientrava più in coda | brani persi da iBroadcast dopo un guasto di rete |
| 3 | alta | `stop.ps1` cancellava il file `STOP` | il supervisore riavviava entro 5 minuti ciò che avevi fermato |
| 4 | alta | `stop.ps1` chiudeva ogni terminale con «n8n» nel comando | finestre dell'utente chiuse |
| 5 | alta | Scritture con `rename` senza ritentativo (Windows, `EPERM`) | possibile perdita del token iBroadcast rotante, voti o stato |
| 6 | alta | Genere creato da Telegram con `strumenti` come testo | strumenti ridotti a lettere, pagina Generi in errore |
| 7 | media | La revisione riscriveva le linee guida lette minuti prima | modifiche fatte nel frattempo perse |
| 8 | media | Linee guida e catalogo scritti non in modo atomico | file troncato in caso di interruzione |
| 9 | media | `parametri.json` illeggibile riscritto con il solo campo modificato | impostazioni perse |
| 10 | media | Contatore dei brani assente: ripartiva da 1 | numeri duplicati, voto sul brano sbagliato |
| 11 | media | `state.json` illeggibile azzerato senza copia | coda e contatori persi |
| 12 | media | Brano vocale rigenerato senza il segno «vocale» | rifatto come strumentale |
| 13 | media | Render rifiutato dal motore ritentato all'infinito | produzione bloccata |
| 14 | bassa | Libreria riletta per intero a ogni richiesta (anche ogni pezzo di audio) | gateway lento al crescere dei brani |
| 15 | bassa | `lms ps` eseguito ogni 5 secondi per ogni scheda aperta | processi inutili |
| 16 | bassa | Grafico per giorno in UTC | brani nel giorno sbagliato attorno a mezzanotte |
| 17 | bassa | La libreria cercava solo negli ultimi 2000 brani | brani vecchi introvabili |
| 18 | bassa | La pagina ridisegnava menu e schede ogni 5-30 s | menu a tendina che si chiudono, focus perso |

## 2. Interfaccia e funzioni

Riferimenti: automazioni radio (AzuraCast), librerie musicali (Navidrome), generatori musicali (Suno).

- Stile da strumento di studio: superfici piatte, un solo accento, Bahnschrift per titoli e numeri, le copertine
  portano il colore. Tema chiaro e scuro. Via aloni, sfumature, animazioni d'ingresso, titoli in maiuscolo.
- Navigazione in tre gruppi (Ascolto, Produzione, Analisi). Render confluisce in Qualità; la tabella dei pesi
  confluisce in Generi.
- Stato della produzione e pausa sempre in testata; stato dei servizi in un solo indicatore.
- Panoramica: linea di produzione a fasi, cose da controllare, coda, ultimi brani con copertina.
- Lettore fisso con copertina, precedente e successivo, voto e scorciatoie da tastiera.
- Scheda del brano con descrizione, stile, sezioni, controllo qualità, scaricamento.
- Parametri: «Salva» attivo solo se il valore cambia.
- Telegram: `/pausa` e `/riprendi`.

## 3. Ordine di lavoro

1. Correzioni a blocchi, librerie e gateway, con test.
2. Endpoint nuovi (copertina, scheda del brano) e dashboard.
3. Verifica nel browser, test, import e pubblicazione del workflow, riavvio del gateway.
4. README, screenshot, diagramma, commit e push.

Fuori ambito: modifiche al motore musicale e alla sintassi degli score (serve il giudizio d'ascolto).
