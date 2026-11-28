# Composizione: armonia, fraseggio e melodia dei generi creativi (28/11/2026)

## Richiesta
«Fraseggi, melodie e accordi sembrano scritti da un'intelligenza artificiale»: serve una ricerca in rete e un
intervento drastico sul lato compositivo e armonico. Eseguito in autonomia.

## Diagnosi sul codice
| Difetto | Dove |
|---|---|
| Melodia = passi casuali sulla scala, corretti solo sui tempi forti: nessuna direzione, nessuna nota di passaggio che risolva | `estro.js` |
| Armonia = giri di 4 battute, un accordo per battuta, senza cadenze, rivolti o prestiti coerenti; uguali in ogni ripresa | `estro.js` |
| Ogni nota inizia dentro la battuta: mai anticipi o legature | `estro.js` |
| Frasi senza domanda e risposta; sezioni tutte regolari | `estro.js` |

## Cosa dice la ricerca
| Fonte | Cosa se ne prende | Licenza / uso |
|---|---|---|
| [music-composition-skills](https://github.com/jtydhr88/music-composition-skills) | cadenze, ritmo armonico non uniforme, scala delle riarmonizzazioni; salti ≤ sesta e recupero in direzione opposta; apice a 2/3-3/4; note estranee che devono risolvere; segnali di «brano da IA»; contrasto tra sezioni | MIT; solo idee, nessun codice o testo copiato |
| [SJY051/music-composition](https://github.com/SJY051/music-composition) | struttura per argomenti; i file di dettaglio non sono stati letti | CC BY 4.0 |
| [MeloForm](https://arxiv.org/pdf/2208.14345), [Yin-Yang](https://arxiv.org/abs/2501.17759) | il motivo si sviluppa in frasi e periodi; senza struttura a lungo raggio l'esito è generico | articoli |
| [Weimar Jazz Database](https://jazzomat.hfm-weimar.de/download/download.html) (ODbL), McGill Billboard (CC0), [Nottingham](https://abc.sourceforge.net/NMD/) (licenza incerta), TheSession (vieta l'uso con LLM) | materiale umano vero | **non scaricato**: serve il consenso dell'utente |
| [NotaGen](https://arxiv.org/pdf/2502.18008), ChatMusician | modelli che scrivono ABC | musica classica o requisiti non verificati |

## Approcci
1. Far scrivere gli score a un modello di testo in rete: più «IA», non meno; quote e validità incerte.
2. Corpora di musica vera: il salto più grande sul fraseggio, ma richiede download, licenze e settimane di adattamento.
3. **Scelto**: riscrivere il compositore estro come lo fa un arrangiatore, in tre strati verificabili:
   armonia scritta a mano per genere in periodi di 8 battute con cadenze; scheletro melodico a note dell'accordo
   con percorso e apice (programmazione dinamica); superficie da motivi di due battute con note di passaggio,
   volta e appoggiatura, anticipi legati oltre la stanghetta, frasi domanda-risposta.

## Limiti
Il risultato va giudicato a orecchio: nessuna misura dice se una melodia è bella. Yoga e meditazione non cambiano.
