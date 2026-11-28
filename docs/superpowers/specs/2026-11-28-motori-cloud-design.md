# Motori cloud gratuiti con ripiego locale: analisi e piano (28/11/2026)

Stato: **in attesa di approvazione**. Nessun codice di produzione è stato modificato.

## Obiettivo
Usare servizi gratuiti per testi e musica; quando le quote finiscono, tornare ai modelli locali
(gemma in LM Studio, YuE2) senza fermare la produzione.

Non obiettivi: servizi a pagamento, wrapper non ufficiali (per esempio di Suno: violano i termini e
mettono a rischio l'account), più account sullo stesso servizio per moltiplicare le quote.

## Analisi: modelli di testo (verificata sulle pagine ufficiali)

| Servizio | Gratis | Limiti | Interfaccia | Scelta |
|---|---|---|---|---|
| Google Gemini (AI Studio) | sì | numeri visibili solo nel proprio progetto AI Studio; i dati del piano gratuito sono in genere usati per migliorare i prodotti | compatibile OpenAI | **1°** |
| Groq | sì | `openai/gpt-oss-120b`: 30/min, 1.000 richieste e 200.000 token al giorno | compatibile OpenAI | **2°** |
| OpenRouter, modelli `:free` | sì | 20/min, 50 richieste al giorno (1.000 con almeno 10 crediti comprati) | compatibile OpenAI | **3°** |
| Cloudflare Workers AI | sì | 10.000 neuron al giorno; servono ID account e token | propria / compatibile | più avanti |
| Cerebras | no | prova di 5 $ per 30 giorni, richiede un metodo di pagamento | | escluso |
| DeepSeek | no | solo a consumo | | escluso |
| GitHub Models | no | chiuso il 30/07/2026 | | escluso |
| Mistral | non verificato | | | escluso |

Il sistema fa poche richieste di testo (qualche decina al giorno): i primi tre bastano largamente.

## Analisi: motori musicali

| Servizio | API gratuita | Nota |
|---|---|---|
| Suno, Udio | nessuna API ufficiale trovata | esclusi |
| Google Lyria (API Gemini) | no: 0,08 $ a brano | gratis solo nell'app, a mano |
| ElevenLabs Music | no: solo abbonati | |
| Stable Audio | no: 25 crediti una volta (circa 3 brani) | |
| ACE Music (api.acemusic.ai) | no: 0,12–0,15 $ a brano | contrariamente a quanto dicono elenchi di terzi |
| MiniMax | API gratuita chiusa | |
| **Hugging Face ZeroGPU** (spazi pubblici ACE-Step) | **quota di GPU: 5 minuti al giorno** con account gratuito | **unica strada trovata** |

Spazio proposto: `victor/ace-step-jam`, funzione `/generate` (testo, lyrics, durata, passi, guida, seed),
modello ACE-Step 1.5 XL turbo, prenota 120 s di GPU, restituisce WAV (entra nel mastering esistente).

Limiti da dire chiaramente:
- non esiste, tra i servizi controllati, un «Suno gratis» con API;
- resa stimata **pochi brani al giorno** (da misurare con una prova);
- che suoni meglio di YuE2 **non è dimostrato**: si decide con i voti;
- è uno spazio di terzi: può cambiare o sparire, il ripiego locale è obbligatorio;
- licenza dichiarata dello spazio: MIT; le condizioni d'uso dei brani vanno controllate prima di pubblicarli.

## Approcci
| Approccio | Pro | Contro |
|---|---|---|
| **A. Catena dentro il gateway** (scelto in proposta) | le chiavi restano nel solo processo che già custodisce i token; un punto per quote, ripieghi e log; i blocchi cambiano poco | il gateway cresce di un modulo |
| B. Nodi AI di n8n | configurabili a video | credenziali in n8n, logica di ripiego sparsa, workflow da ridisegnare |
| C. Proxy esterno (LiteLLM) | molti servizi pronti | un programma e un guardiano in più, non copre la musica |

## Disegno (approccio A)

### Fase 0: sicurezza
Commit e push del lavoro già presente e non salvato (pagina Score e altro, 193 test verdi), così esiste
un punto di ritorno. Backup dei file prima di ogni modifica (regola aggiunta a `CLAUDE.md`).

### Fase 1: testi
- `gateway/testi.js`: prova in ordine Gemini → Groq → OpenRouter → gemma locale. Un servizio che
  risponde «quota finita» (429) si sospende per il tempo indicato; errore di rete o risposta non valida:
  si passa subito al successivo.
- `llmJson` (blocchi 4, 5b, 8a, 9) e la traduzione delle note chiamano il gateway; se il gateway non
  risponde, resta la chiamata locale di oggi.
- gemma si carica solo quando serve il locale. Senza chiavi configurate tutto funziona come adesso.
- Esce dal computer: titoli, descrizioni, generi, voti e note o messaggi scritti in italiano.

### Fase 2: musica
- **Prima una prova usa e getta**: un brano da 3 minuti col tuo token, per misurare qualità, tempo e quota.
  Si procede solo se ti convince.
- `gateway/musica.js` avvia la generazione, ne segue lo stato e salva il WAV.
- Blocco 6: per i brani strumentali prova il cloud, se attivo e con quota; blocchi 2 e 3a ne seguono
  esito e file. Il cloud non usa gli score: il compositore e la pagina Score valgono per YuE2.
- Quota finita, errore o attesa oltre 15 minuti: lo stesso brano va a YuE2, senza contare un tentativo.
- Restano locali: generi con voci, score scelti a mano.
- La scheda registra `motore`, per confrontare i voti fra cloud e locale.

### Fase 3: dashboard e documentazione
Riquadro «Servizi» (stato, uso di oggi, acceso/spento, ordine), file `config/servizi.json`,
motore nella scheda del brano, README, diagramma, screenshot, push.

### Chiavi (le inserisci tu)
Creare gli account e le chiavi: [Google AI Studio](https://aistudio.google.com/apikey),
[Groq](https://console.groq.com/keys), [OpenRouter](https://openrouter.ai/keys),
[Hugging Face](https://huggingface.co/settings/tokens) (token in sola lettura).
Uno script `tools/chiavi.ps1` le chiede a video e le salva cifrate (DPAPI) in `secrets/`, come quelle
attuali. Bastano anche solo alcune: i servizi senza chiave vengono saltati.

## Verifiche
Test automatici con servizi finti per catena, quote e ripieghi; `node --test tools/test/*.test.js`
dopo ogni passo; controllo del log di produzione dopo ogni pubblicazione del workflow.

## Fonti
- [Gemini: prezzi](https://ai.google.dev/gemini-api/docs/pricing) e [limiti](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Groq: limiti](https://console.groq.com/docs/rate-limits) · [OpenRouter: limiti](https://openrouter.ai/docs/api-reference/limits)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Cerebras](https://inference-docs.cerebras.ai/support/rate-limits) · [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing) · [GitHub Models](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models)
- [ACE Music API](https://api.acemusic.ai/v1/guide) · [ElevenLabs](https://elevenlabs.io/pricing/api) · [Stability](https://docs.stability.ai/pricing) · [MiniMax](https://platform.minimax.io/docs/api-reference/music-generation)
- [ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu) · [spazio ace-step-jam](https://huggingface.co/spaces/victor/ace-step-jam)
