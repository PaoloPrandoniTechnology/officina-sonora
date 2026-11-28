# Linee guida a blocchi: piano

**Goal:** scegliere dalla dashboard i blocchi inglesi dello stile di YuE2, generali e per genere.

**Architecture:** la composizione resta in `src/lib-apprendimento.js` (funzioni pure, usate dai blocchi n8n e dal
gateway). La pagina salva solo aggiunte ed esclusioni in `config/guidance.json`.

**Spec:** `docs/superpowers/specs/2026-11-28-linee-guida-a-blocchi-design.md`. Esecuzione: nella sessione.

## Global Constraints

Testi in italiano, termini di stile in inglese; produzione sempre accesa; blocco di 2–60 caratteri; massimo 8
aggiunte per ambito; `node --test tools/test/*.test.js` prima di ogni commit.

## Review Focus

Esclusione di un blocco fisso (rifiutata); `singing bowls` in un genere strumentale (ammesso); `guidance.json`
senza i campi nuovi (funziona); revisione che cancella le scelte dell'utente (mai); genere con tutti gli
strumenti esclusi (avviso).

## Task

1. **Vocabolario.** `config/yue-v1/top_200_tags.json` (scaricato), `tools/genera-vocabolario.js` →
   `config/vocabolario.json` `{famiglie:{genere,strumenti,ritmo,atmosfera,timbro,produzione,voce}}`.
   Test: ogni termine rispetta le regole e compare in una sola famiglia.
2. **Composizione.** `blocchiStile(cat, variante, strumenti, influenza, guidance, {bpm, tonalita, direttive})`
   → `[{testo, origine, escluso}]`, origine `fisso|catalogo|nota|generale|tuo|revisione`; `componiStile` ne unisce
   i non esclusi. Esclusioni: `style_avoid` e `blocchi_generi[nome].esclusi`; aggiunte: `style_extra`,
   `blocchi_generi[nome].aggiunti`, `stile_generi[nome]`.
3. **Gateway.** `guida({campo:'blocchi', ambito, aggiunti, esclusi, azzera})` con i controlli della spec;
   `GET /api/controllo/stile?genere=&variante=` → `{blocchi, esempio, avvisi, varianti}`.
4. **Revisione.** Blocco 4: sceglie dal vocabolario, non scrive esclusioni, conserva `blocchi_generi`.
5. **Pagina.** `disegnaGuida` in `gateway/dashboard.html`: ambito, blocchi, famiglie con ricerca, termine libero,
   modalità aggiungi/escludi, anteprima, avvisi, predefinito, note e bpm.
6. **Applicazione.** Svuotare `style_avoid` (v5), build, publish, riavvio del gateway, prova nel browser,
   screenshot, README, commit e push.
