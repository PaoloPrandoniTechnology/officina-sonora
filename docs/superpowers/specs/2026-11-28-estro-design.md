# Estro: musica non monotona fuori dallo yoga (28/11/2026)

## Obiettivo
I generi non strettamente legati allo yoga devono cambiare di continuo: variazioni, assoli, particolarità, suoni
ricercati, richiami a brani famosi. Yoga e meditazione restano come prima. Richiesta eseguita in autonomia.

## Diagnosi
| Causa | Misura |
|---|---|
| Gli score del modello YuE2 (prima scelta) sono cicli | ripetizione 0,74-0,97; spesso 1-3 accordi, 1-6 celle ritmiche, un interlude di 80-160 battute |
| Il compositore di riserva è pensato per l'omogeneità | identità fissa per genere: 3 progressioni, 4 celle; ripetizione 0,4-0,67 |
| Lo stile è quasi identico fra brani dello stesso genere | cambiano solo variante, 1-2 strumenti e influenza |
| Lo stesso percorso per meditazione e metal | nessuna distinzione di genere |

## Approcci
1. Regolare campionamento e soglia di ripetizione del modello: poco codice, ma circa un tentativo su tre riesce già
   oggi; rifiutare i ripetitivi ridurrebbe quasi a zero la produzione, e non crea assoli o richiami.
2. Solo descrittori di stile più ricchi: lo score resta un ciclo, che il motore segue.
3. **Scelto**: livello di estro per genere; per i creativi un compositore dedicato che controlla forma, armonia,
   assoli, richiami, più suoni diversi per brano nello stile. Deterministico, verificabile, senza GPU in più.

## Piano eseguito
1. Campo `estro` nel catalogo, impostazioni `estro` e `fonte: auto`.
2. `src/compositore/estro.js`; preferenze dai voti estese a forme e richiami.
3. Blocchi 5b, 5c, 5d, 6 e gateway; stile con suoni per brano.
4. Test, README, import e publish del workflow, brano di prova in produzione.

## Revisione dopo il primo ascolto
Giudizio: brano troppo complicato, suoni non calibrati, strumenti da scegliere meglio.

| Causa trovata | Correzione |
|---|---|
| Troppe sezioni speciali, assoli fitti, sostituzioni, metri diversi | compositore semplificato |
| Gli strumenti erano estratti a caso: due fissi qualsiasi, anche senza batteria o basso | organico curato per i 39 generi |
| 3-5 timbri casuali e la trovata del modello affollavano lo stile | rimossi |
| Le varianti e le parole della revisione nominavano strumenti di altri generi | escluse; la revisione usa solo l'atmosfera |
| LoRA chiptune sul synthwave e rock sulla techno industriale | rimosse |

## Non fatto
Citazioni di canzoni protette; nuove LoRA (scale non validate a orecchio); modifiche al campionamento audio.
