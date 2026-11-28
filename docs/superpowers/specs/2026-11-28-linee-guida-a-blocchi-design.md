# Linee guida a blocchi: progetto

**Stato:** approvato e realizzato il 2026-11-28.

## Scopo

Scegliere dalla dashboard, per ogni genere, i termini inglesi che compongono il prompt di stile di YuE2:
ogni termine è un blocco da inserire, spegnere o escludere, senza errori di scrittura.

## Come funziona oggi

- Lo stile di un brano è composto da `componiStile`: genere, strumenti, variante, ritmo, atmosfera, influenza,
  note per genere, parole generali, parole per genere della revisione, spazio, BPM, tonalità.
- "Da evitare" non cambia il prompt: YuE2 non ha un campo per il testo negativo.

## Decisioni prese

| Tema | Scelta |
|---|---|
| Per genere | tutti i blocchi sono modificabili, più un livello generale |
| Da evitare | il termine viene tolto dallo stile, anche se viene dal catalogo o dalla revisione |
| Vocabolario | elenco a famiglie (catalogo e tag del primo YuE) più termine libero, segnato come personalizzato |
| Revisione automatica | sceglie solo dall'elenco, non tocca i blocchi impostati a mano |

## Approcci

1. **Aggiunte ed esclusioni sopra il catalogo (scelto).** Il catalogo resta la base; si salva solo ciò che cambi.
   Si torna al predefinito con un pulsante e gli aggiornamenti del catalogo continuano a valere.
2. Prompt del genere riscritto per intero. Più diretto, ma perde la rotazione di strumenti, varianti e
   influenze, quindi i brani di un genere diventano tutti uguali.
3. Modifica diretta del catalogo. Nessun formato nuovo, ma non c'è un predefinito a cui tornare.

## Dati

- `config/guidance.json`: `style_extra` (aggiunte generali), `style_avoid` (esclusioni generali),
  `blocchi_generi`: genere → `{ aggiunti: [], esclusi: [] }` (scelti da te), `stile_generi` (revisione).
- `config/vocabolario.json`: famiglie genere, strumenti, ritmo, atmosfera, timbro, produzione, voce.
  Generato una volta da un piccolo strumento in `tools/`, poi modificabile a mano.

## Regole di composizione

- Si parte dal catalogo, si aggiungono nell'ordine: generali, del genere, della revisione.
- Si tolgono i termini esclusi (generali o del genere). Il confronto è sul blocco intero, senza maiuscole.
- Le tue scelte prevalgono sulla revisione.
- Blocchi fissi, non modificabili: `Instrumental` o `Wordless vocals`, BPM, tonalità, `no vocals` o `no lyrics`.

## Pagina (Controllo → Linee guida)

```
Ambito: [ Generale | genere ▾ ]                         [ Torna al predefinito ]

PROMPT DEL GENERE
  [Instrumental 🔒] [blues shuffle ×] [slide guitar lead ×] [shuffle drums ×] ... [108 BPM 🔒]
  clic su un blocco = lo escludi; i blocchi del catalogo, tuoi e della revisione hanno colori diversi

AGGIUNGI
  [Genere] [Strumenti] [Ritmo] [Atmosfera] [Timbro] [Produzione] [Voce]   cerca: [______]
  (+ warm tube amps) (+ walking bass) ...                   Termine libero: [______] [Aggiungi]

DA EVITARE
  [percussion buildup ×]     scegli dall'elenco: stessi pulsanti, modalità "Escludi"

ANTEPRIMA   Variante: [ ▾ ]   testo del prompt finale, numero di blocchi, avvisi
```

Restano le note per il sistema e le fasce di bpm; la fascia si modifica anche per i generi che non ne hanno.

## Controlli

- Il server accetta solo blocchi di 2–60 caratteri, senza virgole, `<` o `>`, senza duplicati.
- Rifiuta BPM e tonalità scritti a mano, le negazioni ("no …") e le voci nei generi strumentali.
- Un termine non può essere insieme aggiunto ed escluso: sceglierne uno lo toglie dall'altro elenco.
- Al massimo 8 blocchi aggiunti per ambito e per genere.
- Avvisi, senza blocco: più di 25 blocchi, nessuno strumento rimasto, genere escluso.
- Ogni modifica finisce nello storico con il valore precedente.

## Revisione automatica

Riceve l'elenco delle famiglie ritmo, atmosfera, timbro e produzione; il codice scarta ciò che non è nel
vocabolario o che hai escluso.

## Non incluso

`cfg_scale`, modifica del catalogo, spostamento dell'ordine dei blocchi.

## Verifica

Test sulla composizione, sui rifiuti del server e sul filtro della revisione; prova della pagina nel browser;
screenshot e README aggiornati. La produzione resta accesa.
