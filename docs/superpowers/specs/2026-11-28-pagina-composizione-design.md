# Pagina «Composizione»: il materiale musicale in dashboard (28/11/2026)

## Richiesta
Accordi, motivi, assoli e tutto il materiale scritto a mano devono essere consultabili, modificabili e ampliabili
dalla dashboard, in una sezione dedicata. Eseguito in autonomia.

## Analisi
| Materiale | Dove stava | Formato |
|---|---|---|
| 184 periodi armonici | `armonia.js` | testo in gradi romani, letto all'avvio |
| 30 motivi e 5 chiusure | `melodia.js` | testo di due battute |
| 12 frasi d'assolo | `melodia.js` | ritmo e gesti |
| 16 richiami | `estro.js` | numeri (semitoni): illeggibili per chi modifica |
| 4 forme | `estro.js` | testo «ruolo:battute:priorità» |

Tutto è fisso nel codice: modificarlo richiede di ricostruire il workflow.

## Scelte
| Scelta | Perché |
|---|---|
| I valori di serie restano nel codice; le tue modifiche in `config\composizione.json` | si può sempre tornare all'originale; gli aggiornamenti del codice non cancellano il tuo lavoro |
| Un solo modulo (`materiale.js`) legge, controlla e unisce, usato da produzione e gateway | quello che la pagina accetta è quello che la produzione usa |
| Richiami riscritti con i nomi delle note (tonalità di riferimento Do) e gradi romani | si leggono e si scrivono a mano |
| Voci non valide ignorate in produzione; se un gruppo resta vuoto valgono quelle di serie | una modifica sbagliata non ferma la produzione |
| Ascolto nella pagina con il sintetizzatore dello Score; «Apri nell'editor» per il piano roll | nessuna nuova dipendenza |

## Piano
1. `materiale.js`; compositore estro che riceve il materiale; blocco 5d e «Componi nuovo» lo leggono.
2. `gateway\composizione.js`: lettura, salva, attiva, ripristina, elimina, prova.
3. Pagina `composizione-pagina.js` con sei schede, filtri, editor con controllo e ascolto.
4. Test, prova nel browser, pubblicazione, README, screenshot, commit e push.

## Fuori da questa pagina
Gli strumenti di ogni genere (organico) restano nel catalogo; il compositore di quiete (yoga e meditazione) non
cambia.
