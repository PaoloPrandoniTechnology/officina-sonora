# Riepilogo Telegram e impostazioni messaggi (approvato)

## Intento
Un messaggio per ogni brano è troppo frequente. Riepilogo periodico di giorno, silenzio di notte,
tutto regolabile dalla dashboard.

## Obiettivi
- Riepilogo dei brani caricati, predefinito ogni ora dalle 8 alle 22 (ultimo invio alle 22).
- Fuori fascia nessun messaggio automatico, avvisi gravi compresi: partono alla riapertura.
- I brani della notte entrano nel primo riepilogo del mattino. Nessun brano nuovo: nessun messaggio.
- Dashboard (Controllo > Messaggi): frequenza (30 min, 1, 2, 3, 4, 6, 12 ore), ora di inizio e di stop,
  per ogni messaggio un interruttore e la scelta dei dati inclusi.
- Le risposte ai comandi dell'utente funzionano sempre.

## Non obiettivi
Testi liberi dei messaggi, fasce diverse per giorno, nuovi tipi di messaggio.

## Approcci
1. **Scelto:** il giro n8n al minuto decide se è l'ora di inviare, leggendo le impostazioni a ogni giro.
2. Timer n8n separato: scartato, le modifiche dalla dashboard richiederebbero di rigenerare il workflow.

## Dati selezionabili
- Riepilogo: numero brani, titoli, genere, tipo/struttura, energia/bpm/tonalità, durata, tempo di render,
  id iBroadcast, totale prodotti.
- Rapporto giornaliero: conteggi, esperimenti, salute, errori principali, ricette migliori, ricette da
  rivedere, commento automatico.
- Avvisi gravi: testo dell'errore, numero di ripetizioni, ora dell'ultimo.

## Vincoli
Ora locale del PC. Impostazioni in `config/parametri.json`, validate dal gateway, scrittura atomica e storico.
