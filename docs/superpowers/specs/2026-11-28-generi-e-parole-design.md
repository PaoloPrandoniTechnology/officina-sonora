# Generi tutti uguali e sezione Testi (28/11/2026)

## Richiesta e decisioni
Togliere il trattamento a parte dello yoga, produrre qualsiasi genere, dare ai brani cantati una sezione per le
parole. Gli stili dei generi esistenti non cambiano. Scelte dell'utente:

| Punto | Scelta |
|---|---|
| Al posto di `ambito` | **raccolte libere**, usate solo per cartelle, playlist e tag |
| Brani già prodotti | restano dove sono |
| Chi scrive le parole | per genere: `auto`, `approvazione`, `miei` |
| Lingue | italiano, inglese, elenco modificabile |
| Generi cantati | scelta *Voce* su ogni genere; in più due generi nuovi di esempio, sospesi |
| Creazione dei generi | editor completo in dashboard |

## Analisi: dove il sistema distingueva
`ambito` (cartella `Yoga`/`Sottofondo`, nome playlist e tag, filtri, ripiego di `estro`), categorie e durate di
riserva solo yoga nel codice, tabella *nome genere → carattere del compositore*, prompt «di sottofondo /
strumentale», creazione da Telegram con `ambito` fisso. La voce era un booleano senza parole: i generi vocali
mandano al motore le sole etichette di sezione.

## Modello (config/catalogo.json)
- `raccolte: [{nome, playlist}]` — cartella = `nome`; playlist `«playlist» - Genere`; tag = `playlist` minuscolo.
  Migrazione: yoga → `Yoga/Yoga`, musica → `Sottofondo/Musica` (nomi e percorsi identici a prima).
- `lingue: [{codice, nome, en, id3}]`.
- Per genere: `raccolta`, `voce` (`strumentale` · `vocalizzi` · `testo`), `carattere` (stile del compositore,
  scritto in ogni genere con il valore di oggi), `durata` facoltativa; per `testo`: `lingua`, `timbro`, `testi`,
  `temi`. Spariscono `ambito` e `vocale_senza_parole`.

## Produzione dei brani cantati
- Testi in `state/parole.json` (fuori da Git), scritto solo dal gateway. Il blocco segna l'uso in
  `state.testiUsati`; un testo vale per un brano (*Duplica* per rifarlo).
- Un genere `testo` entra nella scelta solo se pronto: `auto` sempre; `approvazione` e `miei` solo con un testo
  approvato libero. Con `approvazione` il blocco 5a chiede una bozza (una alla volta per genere).
- Stile: genere, lingua, timbro, strumenti…, `clear diction`; tolte le diciture «instrumental / no vocals».
- `lyrics` = sezioni con etichette e righe; ritornelli scritti per intero. Score scritto dal motore.
- Una sola LoRA: quella del genere (con la sua parola d'innesco), salvo impostazione `nessuna`; mai la KTO.
- Controllo qualità: tolleranza di durata più larga; la rigenerazione conserva le parole.
- ID3: lingua (`TLAN`), testo (`USLT`), commento coerente con la voce.

## Interfaccia
- **Testi** (nuova voce, ispirata a Suno, MasterWriter e Hookpad): elenco canzoni a sinistra; al centro le
  sezioni a blocchi (tipo da pulsanti, sposta, duplica, elimina) con sillabe e lettera di rima per riga; a destra
  assistente IA (intero testo da un tema, riscrivi sezione, rime), controlli e anteprima di ciò che va al motore.
  Salvataggio automatico, pulsante *Approva*.
- **Generi**: *Nuovo genere* (vuoto, copia, proposta IA) e *Modifica* con pulsanti ed elenchi; raccolte e lingue.
- **Libreria / Andamento**: filtro *Raccolta*.

## Fuori da questo lavoro
Spostare i vecchi file; rinominare generi esistenti; melodia cantata scritta dal nostro compositore; verifica
all'ascolto del cantato (l'italiano non è dichiarato tra le lingue di YuE2: serve una prova).

## Rischi
- Produzione accesa: migrazione del catalogo e pubblicazione del workflow vanno eseguite insieme, alla fine.
- Lingua e sillabe: il motore non garantisce metrica né pronuncia; i controlli sono consigli.

## Piano
1. Backup. 2. Test nuovi. 3. `lib*`, blocchi, compositore. 4. Gateway: `generi.js`, `parole.js`,
`parole-modello.js`, rotte, analisi. 5. Dashboard. 6. Migrazione `tools/migra-generi.js`, build, import,
publish, riavvio gateway. 7. README, screenshot, diagramma, commit e push.
