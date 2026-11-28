# Editor della Composizione: timeline e pulsanti (28/11/2026)

## Richiesta
Rivedere tutta la sezione: una mini timeline durante la modifica, pulsanti per scegliere accordi e note, niente da
scrivere a mano, un percorso chiaro che guidi chi modifica.

## Analisi dell'editor precedente
| Voce | Come si modificava | Problema |
|---|---|---|
| Accordi | pulsanti | nessuna vista del giro nel tempo |
| Motivi, chiusure | testo (`-4 4 4~`) | errori di sintassi e somme da fare a mente |
| Assoli | due testi da tenere allineati | idem |
| Richiami | testo delle note | idem |
| Forme | testo `ruolo:battute:priorità` | idem |
| Elenco | testo grezzo | non si capisce la voce a colpo d'occhio |

## Metodo
Una finestra sempre uguale, in tre passi numerati:

1. **Dove si usa**: stile, modo, parte o andamento, scelti da pulsanti.
2. **Componi**: la timeline di tutta la voce; si preme un elemento e sotto compaiono solo i pulsanti che lo
   riguardano. Annulla, Ripeti e *Ricomincia*.
3. **Controlla e salva**: elenco dei controlli con esito, *Ascolta* con la testina sulla timeline, *Salva*.

## Scelte
| Scelta | Perché |
|---|---|
| Modifiche che conservano sempre i 32/32 della battuta (allungare mangia le figure dopo, accorciare lascia una pausa) | gli errori di somma non possono nascere |
| La forma ha sempre il finale in coda | l'errore più facile sparisce |
| La stessa timeline, in piccolo, nell'elenco | si riconosce la voce senza leggere codici |
| Formati salvati invariati; controlli del gateway invariati | nessuna migrazione, una sola verità |
| Modello separato (`composizione-editor.js`), provato su tutte le voci di serie | l'editor non deve alterare ciò che non si tocca |
| Si scrive solo il nome di richiami e forme, già precompilato | è testo libero, non può rompere nulla |
