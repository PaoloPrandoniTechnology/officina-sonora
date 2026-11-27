# Riepilogo Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** riepilogo periodico su Telegram, silenzio fuori fascia, impostazioni dalla dashboard.

**Architecture:** `src/lib-messaggi.js` (funzioni pure) è l'unica definizione delle impostazioni: viene
incollata nei blocchi n8n e valutata dal gateway. Un nuovo blocco `11` sul giro al minuto invia il riepilogo.

**Tech Stack:** Node, nodi Code di n8n, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-27-riepilogo-telegram-design.md`

## Global Constraints
- Predefiniti: frequenza 60 min, inizio 8, stop 22, tutti i messaggi attivi con tutti i dati.
- Frequenze ammesse: 30, 60, 120, 180, 240, 360, 720 minuti. 0 <= inizio < stop <= 24.
- Ora locale. Impostazioni in `config/parametri.json`, chiave `messaggi`.

## Review Focus
- Stop non allineato alla frequenza (3 ore, 8-22): invio finale comunque alle 22.
- Telegram irraggiungibile: i brani non vanno persi, si riprova al giro dopo.
- Notte con decine di brani: un solo messaggio sotto 3900 caratteri, con "e altri N".
- Errore grave notturno: conservato e inviato alla riapertura.
- Primo avvio: non riversare tutta la libreria.

### Task 1: logica dei messaggi e blocchi
**Files:** Create `src/lib-messaggi.js`, `src/blocks/11-riepilogo-telegram.js`, `tools/test/messaggi.test.js`.
Modify `src/blocks/03d4-…`, `08b-…`, `09-…`, `build-workflow.mjs`.
**Interfaces (Produces):** `MESSAGGI_DEF`, `MESSAGGI_FREQUENZE`, `impostazioniMessaggi(raw)`,
`inFascia(imp, data)`, `slotRiepilogo(imp, data)` -> timestamp o null, `testoRiepilogo(brani, dati, totale)`,
`testoAvviso(chiave, info, dati)`.
- [ ] Test, vederli fallire, implementare, vederli passare: `node --test tools/test/messaggi.test.js`
- [ ] `node build-workflow.mjs`

### Task 2: gateway e dashboard
**Files:** Modify `gateway/controllo.js` (`POST /api/controllo/messaggi`, `lettura().messaggi`),
`gateway/dashboard.html` (Controllo > Messaggi).
- [ ] Test di rifiuto dei valori non validi in `tools/test/messaggi.test.js`, implementare, tutti i test.

### Task 3: attivazione e pubblicazione
- [ ] Import e publish del workflow, riavvio di n8n e gateway (non del motore YuE2), verifica nel browser.
- [ ] README, `tools\pubblica.ps1`.
