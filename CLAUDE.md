# Officina Sonora: istruzioni di progetto

- **Aggiorna `README.md` a ogni modifica importante** (blocchi, comportamento della produzione, dashboard,
  comandi, configurazione, requisiti), nella stessa modifica: sezioni interessate, guida rapida e
  "Miglioramenti futuri". Se cambia la dashboard o il workflow, rigenera anche screenshot
  (`tools\screenshot.ps1`) e diagramma (`node tools\diagramma.mjs`).
- La produzione resta accesa: le modifiche si applicano direttamente, a piccoli passi, senza fermarla per prove.
- Dopo ogni modifica: `node --test tools/test/*.test.js`, commit e push della repo privata.
- Blocchi modificati: `node build-workflow.mjs`, poi import e publish del workflow (vedi README, "Per chi sviluppa").
