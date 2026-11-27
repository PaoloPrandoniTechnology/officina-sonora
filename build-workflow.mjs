// Genera officina-sonora-workflow.json (workflow n8n importabile) dai blocchi in src/blocks.
// Ogni blocco e' un nodo Code separato; src/lib.js viene incollato in testa a ciascuno.
// Uso: node build-workflow.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const lib = readFileSync(join(here, 'src', 'lib.js'), 'utf8') + '\n' + readFileSync(join(here, 'src', 'lib-apprendimento.js'), 'utf8')
  + '\n' + readFileSync(join(here, 'src', 'lib-messaggi.js'), 'utf8')
  + `\nCFG.messaggi = impostazioniMessaggi(readJsonSafe(path.join(CFG.dir, 'config', 'parametri.json'), {}).messaggi);`;
const blockFile = (prefix) => {
  const f = readdirSync(join(here, 'src', 'blocks')).find((n) => n.startsWith(prefix));
  if (!f) throw new Error(`blocco ${prefix} non trovato`);
  return readFileSync(join(here, 'src', 'blocks', f), 'utf8');
};
const libIb = readFileSync(join(here, 'src', 'lib-ibroadcast.js'), 'utf8');
const code = (prefix) => lib + '\n' + blockFile(prefix);
const coverJs = readFileSync(join(here, 'src', 'cover.js'), 'utf8');
const codeIb = (prefix) => lib + '\n' + libIb + '\n' + coverJs + '\n' + blockFile(prefix);

// moduli CommonJS di src/compositore, ciascuno chiuso in una funzione
const modulo = (nome, file) => `const ${nome} = (() => { const module = { exports: {} };\n${readFileSync(join(here, 'src', 'compositore', file), 'utf8')}\nreturn module.exports; })();`;
const compositoreJs = modulo('ScoreAbc', 'abc.js') + '\n' + modulo('Compositore', 'compositore.js');
const ifString = (left, right) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
    conditions: [{ leftValue: left, rightValue: right, operator: { type: 'string', operation: 'equals' } }],
    combinator: 'and',
  },
  options: {},
});
const ifBoolTrue = (left) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
    conditions: [{ leftValue: left, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});

const pos = (x, y) => [x, y];
const nodes = {
  schedule: { name: 'Ogni minuto', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } }, position: pos(0, 300) },
  leggi: { name: '1 Leggi stato', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('01-') }, position: pos(250, 300) },
  libera: { name: 'Pipeline occupata?', type: 'n8n-nodes-base.if', typeVersion: 2, parameters: ifBoolTrue('={{ $json.locked }}'), position: pos(375, 300) },
  haRender: { name: 'Render in corso?', type: 'n8n-nodes-base.if', typeVersion: 2, parameters: ifBoolTrue('={{ $json.hasJob }}'), position: pos(500, 300) },
  controlla: { name: '2 Controlla render', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('02-') }, position: pos(750, 150) },
  concluso: { name: 'Render concluso?', type: 'n8n-nodes-base.if', typeVersion: 2, parameters: ifString('={{ $json.outcome }}', 'done'), position: pos(1000, 150) },
  scarica: { name: '3a Scarica audio', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03-1-') }, position: pos(1250, 50) },
  metadati: { name: '3b Scrivi metadati', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03-2-') }, position: pos(1250, -50) },
  qualita: { name: '3c Controllo qualita', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03a-') }, position: pos(1250, 150) },
  prep: { name: '3d1 Prepara caricamento', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: codeIb('03d1-') }, position: pos(1500, 250) },
  carica: { name: '3d2 Carica su iBroadcast', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03d2-') }, position: pos(1500, 330) },
  recupero: { name: '3d3 Recupero tag e playlist', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: codeIb('03d3-') }, position: pos(1500, 410) },
  notifica: { name: '3d4 Registrazione', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('03d4-') }, position: pos(1500, 490) },
  feedback: { name: '4 Feedback e miglioramento', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('04-') }, position: pos(1500, 50) },
  scegli: { name: '5a Scegli ricetta', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05a-') }, position: pos(750, 450) },
  titolo: { name: '5b Titolo (modello)', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05b-') }, position: pos(750, 600) },
  componi: { name: '5c Componi concept', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('05c-') }, position: pos(750, 750) },
  score: { name: '5d Componi score', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: lib + '\n' + compositoreJs + '\n' + blockFile('05d-') }, position: pos(750, 900) },
  invia: { name: '6 Invia render', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('06-') }, position: pos(1000, 450) },
  scrivi: { name: '7 Scrivi stato', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('07-') }, position: pos(1750, 300) },
  riflessione: { name: '9 Riflessione giornaliera', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('09-') }, position: pos(250, -200) },
  riepilogo: { name: '11 Riepilogo Telegram', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('11-') }, position: pos(250, -600) },
  voti: { name: '10 Voti da iBroadcast', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('10-') }, position: pos(250, -400) },
  comandi: { name: '8a Comandi Telegram', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('08a-') }, position: pos(250, 0) },
  avvisi: { name: '8b Avvisi Telegram', type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: code('08b-') }, position: pos(250, 100) },
};

// Collegamenti: [nodo sorgente, uscita, nodo destinazione]
const links = [
  ['schedule', 0, 'leggi'],
  ['schedule', 0, 'comandi'],
  ['schedule', 0, 'avvisi'],
  ['schedule', 0, 'riepilogo'], // ogni minuto controlla se e' ora del riepilogo
  ['schedule', 0, 'riflessione'],
  ['schedule', 0, 'voti'], // ogni minuto controlla se e' passata la cadenza di 10 minuti // ogni minuto controlla se e' l'ora del rapporto giornaliero // in parallelo: comandi e avvisi ogni minuto
  ['leggi', 0, 'libera'],
  ['libera', 1, 'haRender'], // false: lock ottenuto, si procede (true = occupata: nessun ramo, il giro finisce)
  ['haRender', 0, 'controlla'], // true: c'e' un render
  ['haRender', 1, 'scegli'], // false: nessun render, si passa al brano successivo
  ['controlla', 0, 'concluso'],
  ['concluso', 0, 'scarica'], // true: render finito
  ['concluso', 1, 'scrivi'], // false: ancora in corso o fallito
  ['scarica', 0, 'metadati'],
  ['metadati', 0, 'qualita'],
  ['qualita', 0, 'prep'],
  ['prep', 0, 'carica'],
  ['carica', 0, 'recupero'],
  ['recupero', 0, 'notifica'],
  ['notifica', 0, 'feedback'],

  ['feedback', 0, 'scrivi'],
  ['scegli', 0, 'titolo'],
  ['titolo', 0, 'componi'],
  ['componi', 0, 'score'],
  ['score', 0, 'invia'],
  ['invia', 0, 'prep'], // anche senza salvataggio: carica il backlog e i brani in coda
];

const ids = Object.fromEntries(Object.keys(nodes).map((k) => [k, randomUUID()]));
const connections = {};
for (const [from, out, to] of links) {
  const src = nodes[from].name;
  connections[src] ??= { main: [] };
  connections[src].main[out] ??= [];
  connections[src].main[out].push({ node: nodes[to].name, type: 'main', index: 0 });
}

const workflow = {
  id: 'yogaMusicFactory01',
  name: 'Officina Sonora',
  active: false,
  nodes: Object.keys(nodes).map((k) => ({ id: ids[k], ...nodes[k] })),
  connections,
  settings: { executionOrder: 'v1' },
};

writeFileSync(join(here, 'officina-sonora-workflow.json'), JSON.stringify(workflow, null, 2), 'utf8');
console.log(`officina-sonora-workflow.json creato: ${workflow.nodes.length} nodi, ${links.length} collegamenti`);
