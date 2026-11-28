# Ricerca: come migliorare la composizione (28/11/2026)

Domanda: «fraseggi, melodie e accordi sembrano scritti da un'intelligenza artificiale». Ricerca in rete con
ricerche web e lettura dei repository. Quanto segue riporta ciò che le fonti dichiarano; **non è stato verificato
in modo indipendente**.

## Skill trovate

| Fonte | Letto | Esito |
|---|---|---|
| [jtydhr88/music-composition-skills](https://github.com/jtydhr88/music-composition-skills) | skill di armonia, melodia, forma, arrangiamento, contrappunto, sviluppo, ritmo, sezione ritmica, scrittura ABC, controllo dei segnali da IA, progressioni | fonte principale; [copia](../skills/LEGGIMI.md) |
| [SJY051/music-composition](https://github.com/SJY051/music-composition) | struttura e `SKILL.md`; i file di dettaglio non sono stati letti | [copia](../skills/LEGGIMI.md) |
| [rockerBOO/abc-skill](https://github.com/rockerBOO/abc-skill), [midi-agent-skill](https://github.com/tubone24/midi-agent-skill), [claude-music-skill](https://github.com/EtienneLescot/claude-music-skill), [music-production-skills](https://github.com/sb-dev/music-production-skills) | solo il risultato di ricerca | non usate |

## Regole raccolte e loro uso

| Regola | Applicata |
|---|---|
| Cadenze: strofa aperta, ritornello chiuso, ponte lontano dalla tonica | sì (`armonia.js`) |
| Ritmo armonico non uniforme, rivolti, dominanti secondarie, prestiti | sì |
| Un solo giro per tutto il brano è un segnale di IA | sì: un periodo per ruolo |
| Salti entro la sesta, recupero in direzione opposta | sì (costo dei salti e revisore) |
| Apice dopo la metà | sì (percorso ad arco e revisore) |
| Note estranee (passaggio, volta, appoggiatura) che risolvono | sì (`melodia.js`) |
| Anticipi e legature oltre la stanghetta | sì |
| Gancio che torna, mai la stessa frase tre volte; assolo che lo cita | in parte: le frasi tornano al massimo due volte per gruppo di accordi |
| Almeno una sezione non multipla di 8; riempimenti non regolari | in parte: dipende dalla durata |
| Lunghezze ABC in `L:1/32` | già così |
| Anticipo o ritardo in millisecondi, dinamiche, entrate e uscite degli strumenti | no: lo spartito ABC non li esprime |
| Maiuscole e righe `w:` per le melodie vocali | no: riguarda solo il canto |

Per scrivere i periodi armonici è stata usata la pratica corrente dei generi; il catalogo di progressioni della
fonte non copre blues, funk, elettronica, colonne sonore, folk e musica latina.

## Studi

| Fonte | Cosa dice |
|---|---|
| [MeloForm](https://arxiv.org/pdf/2208.14345) | un motivo di due battute si sviluppa in frasi con sequenza, trasformazione e chiusura |
| [Yin-Yang](https://arxiv.org/abs/2501.17759) | la generazione nota per nota fatica a restare sul motivo |
| [Motifs, Phrases, and Beyond](https://arxiv.org/pdf/2403.07995) | rassegna sulla struttura nella musica generata |
| [NotaGen](https://arxiv.org/pdf/2502.18008), [ComposerX](https://arxiv.org/html/2404.18081v1), [ChatMusician](https://ezmonyi.github.io/ChatMusician/) | modelli e agenti che scrivono ABC; requisiti per l'uso locale non trovati |
| [Documentazione ComfyUI di YuE2](https://docs.comfy.org/tutorials/audio/yue2/yue2) | con la pianificazione ABC il motore scrive prima il piano e poi l'audio |

## Raccolte di musica vera (non scaricate)

| Raccolta | Contenuto | Licenza dichiarata | Nota |
|---|---|---|---|
| [Weimar Jazz Database](https://jazzomat.hfm-weimar.de/download/download.html) | 456 assoli trascritti, `wjazzd.db` (SQLite) | ODbL | la più adatta per il fraseggio jazz; dimensione non indicata |
| McGill Billboard | accordi di canzoni pop | CC0 secondo [Kaggle](https://www.kaggle.com/datasets/jacobvs/mcgill-billboard) | la pagina ufficiale ha risposto 404 |
| [ChoCo](https://github.com/smashub/choco) | raccolta di raccolte di accordi | CC BY 4.0, alcune parti CC BY-NC-SA | |
| [Chordonomicon](https://www.researchgate.net/publication/385353562_CHORDONOMICON_A_Dataset_of_666000_Songs_and_their_Chord_Progressions) | 666.000 successioni inserite da utenti | CC BY 4.0 | |
| [Nottingham](https://abc.sourceforge.net/NMD/) / [versione ripulita](https://github.com/jukedeck/nottingham-dataset) | oltre 1000 melodie popolari in ABC | incerta in origine; GPL-3.0 la copia | |
| [TheSession](https://github.com/adactio/TheSession-data) | melodie tradizionali | ODbL con **divieto d'uso con modelli linguistici** | scartata |

## Passo successivo possibile
Ricavare frasi e giri dalle raccolte con licenza chiara. Richiede il consenso al download e la verifica degli
obblighi (attribuzione, condivisione allo stesso modo).
