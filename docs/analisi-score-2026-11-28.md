# Score ABC: analisi del sistema e scelte (28/11/2026)

## 1. Come nascevano
1. Il blocco 5d componeva uno score di riserva con il compositore del progetto.
2. Il blocco 6 chiedeva a YuE2 il solo score (fino a 3 tentativi, circa 2 minuti l'uno).
3. Il blocco 2 lo controllava, passava la melodia agli strumenti e avviava il render; se falliva usava la riserva.

Tutto era fisso nel codice: tentativi, soglie, campionamento. Dalla dashboard non si vedeva né si toccava nulla.

## 2. Misure (log di produzione e libreria, 26–28/11)
| Misura | Valore |
|---|---|
| Score del modello accettati | 61 |
| Tentativi rifiutati | 125 (95 ripetuti, 30 abbandonati) |
| Tasso di successo per tentativo | circa 33% |
| Rifiuti per durata | 52: 32 troppo lunghi (29 oltre 330 s, fino a 29 minuti), 20 troppo corti |
| Rifiuti per notazione | circa 70: battute non chiuse, accordi troncati, voci con battute diverse |
| Battute melodiche ripetute (mediana) | modello 87%, compositore 51% |
| Voto medio al 28/11 | modello 3,0 su 6 voti, compositore 2,7 su 3: **troppo pochi per concludere** |

Gli errori di notazione sono quasi tutti in coda al testo (accordo aperto a fine riga, 267 battute contro 265):
il modello continua a scrivere finché finisce lo spazio. La parte iniziale è di solito buona.
Gli score rifiutati non venivano conservati: la quota **recuperabile** è quindi una stima da verificare
(ora si conservano gli ultimi 30 e ogni recupero finisce nel log).

## 3. Cosa dicono le fonti
- Dialetto: due voci monofoniche (`Vocal`, `Ins`), accordi solo come sigle in `Vocal`, durate ammesse fisse, niente
  gruppi irregolari, ritornelli o decorazioni. Il validatore del progetto applica già queste regole.
- Uno score fornito **salta il pianificatore e non viene riparato** dal motore: il controllo deve essere nostro.
- Modifiche dichiarate sicure: tempo, conservando note e metri; ogni modifica va riconvalidata, e rigenerare
  non garantisce audio identico fuori dal punto toccato.
- `cot="melody"` non toglie gli accordi da uno score fornito.
- Le pagine lette non indicano un limite di lunghezza, un elenco chiuso di sezioni né il comportamento con ABC errato.
- `harmony` e i parametri di campionamento dello score: i primi sono descritti solo da YuE2 Studio, i secondi
  compaiono nei predefiniti del motore (`/props`). Effetto **non verificato** qui: partono ai valori di prima.
- I modelli generici trovano ancora difficile ragionare su musica in testo (benchmark ABC-Eval): per le correzioni
  automatiche si usano regole nel codice, non un modello di linguaggio.

## 4. Scelte
| Scelta | Perché |
|---|---|
| Recupero a regole (taglio a un confine di sezione vicino alla durata richiesta, ultima sezione = outro) | attacca la causa principale senza costi di GPU |
| Parametri generali e per genere in `config\score.json` | i generi si comportano in modo diverso; predefiniti invariati salvo il recupero |
| Score scelto a mano consumato dal blocco 6 | un solo punto di innesto; il gateway non tocca `state.json` |
| `abc.js` unico per produzione, gateway ed editor | quello che l'editor accetta è quello che la produzione accetta |
| Piano roll e sintetizzatore propri | nessuna libreria esterna; il pentagramma (abcjs, MIT, circa 500 KB) resta un'aggiunta possibile |

Scartati: correzione con gemma (poco affidabile e occupa la GPU), accorciamento forzato tramite `max_tokens`
(taglierebbe comunque a metà), rifiuto automatico dei brani ripetitivi attivo per default (ridurrebbe la produzione
senza prove che migliori i voti: è disponibile, spento).

## 5. Da verificare
- Quanti rifiuti il recupero trasforma in successi (cercare «recuperato» in `state\tick.log` dopo qualche giorno).
- Se i brani recuperati suonano chiusi bene: confrontare i voti nella pagina Score, colonna *Recuperati*.
- Se la ripetizione alta del modello abbassa i voti: servono più voti.

## Fonti
- [abc-editing.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/references/abc-editing.md)
- [generation-and-covers.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/references/generation-and-covers.md)
- [YuE](https://github.com/multimodal-art-projection/YuE) e [YuE2 Studio](https://github.com/timoncool/YuE2-Studio)
- [Standard ABC 2.1](https://abcnotation.com/wiki/abc:standard:v2.1)
- [abcjs](https://docs.abcjs.net/audio/synthesized-sound)
- [NotaGen](https://arxiv.org/pdf/2502.18008) (generazione di musica in ABC)
