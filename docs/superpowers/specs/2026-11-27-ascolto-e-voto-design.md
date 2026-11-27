# Ascolto e voto nella dashboard

Stato: da approvare.

## Scopo
Oggi sono votati 11 brani su 116 (il pannello ne conta 15: 4 sono copie errate). Il sistema impara dai voti:
ascoltare e votare dalla dashboard deve diventare rapido. I voti devono finire sul brano giusto.

## Obiettivi
- Ascoltare un brano e votarlo (1-5 stelle, nota facoltativa) dalla dashboard.
- Regola "vince l'ultimo" tra dashboard, Telegram e iBroadcast.
- Eliminare i voti copiati tra brani con lo stesso nome di file.
- Proteggere il gateway dalle richieste di altri siti.

## Fuori ambito
Voto dal telefono, scrittura delle stelle su iBroadcast, allarmi, analisi dell'apprendimento, nuovi grafici.

## Approcci considerati
| | Come funziona | Contro |
|---|---|---|
| A. Vince la dashboard | il voto della dashboard non viene più toccato | un cambio di idea in iBroadcast è ignorato |
| B. Tutto su iBroadcast | la dashboard scrive le stelle nell'app | scrittura non verificata, dipende dalla rete |
| **C. Vince l'ultimo (scelto)** | iBroadcast sostituisce il voto solo se lì cambia qualcosa | le stelle nell'app non mostrano i voti locali |

## Progetto

### Dove stanno i voti
- Unica fonte: il `.json` del brano. Campi: `voto`, `voto_fonte`, `voto_il`, `nota_utente`, `voto_ib`.
- Il brano si identifica con `numero_traccia` (verificato: presente su tutti i brani, senza doppioni).
- `feedback.csv` viene dismesso (proposta mia): si legge per nome di file, ed è la causa delle copie.
  I voti manuali scritti a mano nel CSV non saranno più possibili; README aggiornato.
- Vanno adattati: `readVotes` e `votoUtente`, i blocchi 04, 05a (`pickVariante`), 08a (voto e nota da Telegram,
  pulsanti con il numero di traccia), 09 e 10. Il blocco 04 non copia più i voti nei `.json`.
- La revisione delle linee guida parte quando cambia il numero dei voti **o** la data del voto più recente,
  così anche un voto corretto viene considerato.

### Vince l'ultimo (blocco 10)
- `voto_ib` è l'ultimo segnale visto in iBroadcast (stelle, tag, playlist, cestino, con l'ordine di priorità attuale).
- Il segnale viene applicato solo se è diverso da `voto_ib`; poi `voto_ib` viene aggiornato.
- Segnale rimosso in iBroadcast: il voto resta, `voto_ib` si azzera.
- Limite: "ultimo" è il momento in cui il sistema vede la modifica (fino a 10 minuti dopo).

### Pulizia una tantum
Script in `tools/`, con prova a vuoto e copia di sicurezza in `state/backup`:
- azzera `voto` e `nota_utente` sui brani votati senza `voto_fonte` (oggi 4: numeri 14, 18, 35, 123);
- imposta `voto_ib` sui voti di fonte iBroadcast;
- rinomina il CSV in `feedback.csv.vecchio`.

### Gateway
- `GET /audio/brano?n=<numero>`: invia il file del brano, con richieste parziali (`Range`) per spostarsi nell'ascolto.
  Accetta solo un numero, mai un percorso.
- `POST /api/controllo/voto` `{ numero, voto, nota }`: validato, scrittura atomica, registrato nello Storico.
  Nota: massimo 300 caratteri, senza `<` o `>`.
- Tutte le richieste: `Host` deve essere `127.0.0.1:5790` o `localhost:5790`.
  Le `POST` con un `Origin` diverso da questi sono rifiutate. I blocchi n8n, che non inviano `Origin`, continuano a funzionare.

### Dashboard (sezione Voti, in alto)
- Coda "Da votare": un brano alla volta, lettore audio, stelle, nota, "Salta"; filtro per genere.
- Ordine: prima i generi con meno voti, poi i brani più recenti.
- Tasti 1-5 per votare (non mentre si scrive la nota). Dopo il voto passa al brano successivo e prova ad avviarlo.
- "Annulla ultimo voto" non serve: un elenco "Votati ora" permette di riaprire il brano e correggere.
- L'aggiornamento periodico della pagina non deve interrompere l'ascolto né cancellare la nota in scrittura.
- La scritta "Solo lettura" diventa "Solo da questo PC".
- Correzione dei grafici piccoli: "ore" e "voti" con dati propri, nessun grafico se il dato non esiste.

## Rischi e vincoli
- Più processi scrivono i `.json` (gateway, blocchi di caricamento e tag). La coda esclude i brani generati
  da meno di 15 minuti; il piano deve verificare che nessun blocco riscriva un `.json` letto prima di un'attesa.
- Pubblicazione: solo senza render in corso (`state/pipeline.lock` assente); gateway riavviato insieme.

## Verifiche
- Test: due brani con lo stesso nome file, il voto resta su uno solo.
- Test: regola "vince l'ultimo" (nuovo segnale, segnale invariato dopo voto locale, segnale rimosso).
- Test: gateway rifiuta `Host` e `Origin` estranei; audio con `Range`; numero inesistente.
- Prova in dashboard: ascolto, voto, il blocco 10 non lo sovrascrive.

## Lasciato a chi realizza
Disposizione grafica dei dettagli, nel solco dello stile esistente.
