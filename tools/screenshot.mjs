// Screenshot a pagina intera della dashboard in docs\screenshots, con Chrome o Edge senza finestra.
// Uso: node tools/screenshot.mjs [nome...]  (di solito tramite tools\screenshot.ps1; gateway attivo)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
// OFS_PORTA: per fotografare un secondo gateway, per esempio con playlist di esempio (OFS_PLAYLIST)
const ORIGINE = `http://127.0.0.1:${process.env.OFS_PORTA || 5790}`;
const BASE = ORIGINE + '/dashboard#';
const MAX_ALTEZZA = 7000; // oltre, l'immagine diventa illeggibile

const clic = (selettore) => `document.querySelector('${selettore}')?.click()`;
// avvia il primo brano della libreria e poi preme un comando del lettore
const ascolta = (poi) => `${clic('#recenti [data-ascolta]')};${poi ? clic(poi) : ''}`;
const mostraTip = (selettore) => `document.querySelector('${selettore}')?.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`;
// pagina: percorso; dopo: JavaScript eseguito prima dello scatto; fissa: altezza imposta (solo cio' che si vede)
const PAGINE = [
  { nome: '01-panoramica', pagina: 'panoramica' },
  { nome: '03-generi', pagina: 'generi' },
  { nome: '04-voti', pagina: 'voti' },
  { nome: '14-andamento', pagina: 'andamento' },
  { nome: '36-andamento-modelli', pagina: 'andamento', dopo: "document.querySelector('#aModelli').closest('.card').scrollIntoView({block:'start'}); scrollBy(0,-100)", fissa: 620 },
  { nome: '05-qualita', pagina: 'qualita' },
  { nome: '06-libreria', pagina: 'libreria' },
  { nome: '18-lettore', pagina: 'libreria', dopo: clic('#recenti [data-ascolta]'), fissa: 900 },
  { nome: '25-playlist', pagina: 'playlist' },
  { nome: '26-playlist-dettaglio', pagina: 'playlist', dopo: clic('.pl-carta:nth-child(2) .pl-nome'), fissa: 900 },
  { nome: '27-coda', pagina: 'libreria', dopo: `${clic('#recenti [data-ascolta]')};${clic('#recenti tbody tr:nth-child(4) [data-azioni]')};${clic('#menuBrano [data-m=coda]')};${clic('#pCodaTasto')}`, fissa: 900 },
  { nome: '28-lettore-grande', pagina: 'libreria', dopo: ascolta('#pGrande'), fissa: 900 },
  { nome: '29-menu-brano', pagina: 'libreria', dopo: clic('#recenti tbody tr:nth-child(3) [data-azioni]'), fissa: 900 },
  { nome: '30-opzioni-ascolto', pagina: 'libreria', dopo: ascolta('#pOpzioni'), fissa: 900 },
  { nome: '31-score-archivio', pagina: 'score' },
  { nome: '32-score-editor', pagina: 'score', dopo: clic('#scTabella tbody tr:nth-child(5) [data-score]') },
  { nome: '33-score-da-produrre', pagina: 'score/produzione' },
  { nome: '34-score-come-nascono', pagina: 'score/regole' },
  { nome: '37-composizione-accordi', pagina: 'composizione', fissa: 1200 },
  { nome: '38-composizione-richiami', pagina: 'composizione/richiamo', fissa: 1200 },
  { nome: '39-composizione-modifica', pagina: 'composizione', dopo: clic('#cmElenco [data-cm=modifica]'), fissa: 1150 },
  { nome: '41-composizione-ascolto', pagina: 'composizione/richiamo', dopo: `${clic('#cmElenco [data-cm=ascolta]')};setTimeout(()=>document.querySelector('.in-ascolto')?.scrollIntoView(),400)`, fissa: 760 },
  { nome: '40-composizione-richiamo', pagina: 'composizione/richiamo', dopo: `${clic('#cmElenco [data-cm=modifica]')};setTimeout(()=>{${clic('#cmLinea [data-t="f:0:2"]')}},300)`, fissa: 1250 },
  { nome: '22-scheda', pagina: 'libreria', dopo: clic('#recenti [data-info]'), fissa: 900 },
  { nome: '23-tema-scuro', pagina: 'panoramica', fissa: 900, scuro: true },
  { nome: '07-controllo-produzione', pagina: 'controllo/produzione' },
  { nome: '08-controllo-parametri', pagina: 'controllo/parametri' },
  { nome: '09-generi-pesi', pagina: 'generi/pesi' },
  { nome: '10-controllo-guida', pagina: 'controllo/guida' },
  { nome: '15-controllo-guida-genere', pagina: 'controllo/guida/Blues-shuffle-strumentale' },
  { nome: '19-tooltip', pagina: 'controllo/guida/Blues-shuffle-strumentale', dopo: mostraTip('#gPrompt [data-fai]'), fissa: 760 },
  { nome: '16-controllo-guida-tempo', pagina: 'controllo/guida/tempo' },
  { nome: '20-controllo-guida-note', pagina: 'controllo/guida/note' },
  { nome: '11-controllo-note', pagina: 'controllo/note' },
  { nome: '17-controllo-messaggi', pagina: 'controllo/messaggi' },
  { nome: '35-controllo-chiavi', pagina: 'controllo/chiavi' },
  { nome: '12-controllo-storico', pagina: 'controllo/storico' },
  { nome: '13-log', pagina: 'log' },
  { nome: '24-menu-ridotto', pagina: 'libreria', dopo: clic('#bMenu'), fissa: 900 },
  { nome: '21-telefono', pagina: 'panoramica', larghezza: 390, fissa: 844 },
];

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = [
  join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);
if (!browser) throw new Error('Chrome o Edge non trovati');

const profilo = join(tmpdir(), `os-screenshot-${process.pid}`);
const processo = spawn(browser, ['--headless=new', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profilo}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  const filePorta = join(profilo, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(filePorta); i++) await attesa(200);
  const porta = readFileSync(filePorta, 'utf8').split('\n')[0];
  const scheda = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page');
  ws = new WebSocket(scheda.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let n = 0;
  const inAttesa = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const p = inAttesa.get(m.id);
    if (!p) return;
    inAttesa.delete(m.id);
    if (m.error) p.ko(new Error(m.error.message)); else p.ok(m.result);
  };
  const cdp = (method, params = {}) => new Promise((ok, ko) => { inAttesa.set(++n, { ok, ko }); ws.send(JSON.stringify({ id: n, method, params })); });
  const valuta = async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  const misura = (width, height) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });

  mkdirSync(CARTELLA, { recursive: true });
  // niente animazioni: l'immagine non coglie transizioni a meta'
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const scelte = process.argv.slice(2);
  for (const p of PAGINE.filter((x) => !scelte.length || scelte.includes(x.nome))) {
    const larghezza = p.larghezza || 1440;
    await misura(larghezza, p.fissa || 1000);
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: p.scuro ? 'dark' : 'light' }] });
    await cdp('Page.navigate', { url: 'about:blank' });
    await attesa(500);
    // ogni scatto parte pulito: niente brano o menu ricordati dallo scatto precedente
    await cdp('Storage.clearDataForOrigin', { origin: ORIGINE, storageTypes: 'local_storage' });
    await cdp('Page.navigate', { url: BASE + p.pagina });
    await attesa(6000);
    if (!p.fissa) {
      const altezza = Math.min(MAX_ALTEZZA, Math.max(900, await valuta('document.documentElement.scrollHeight')));
      await misura(larghezza, altezza);
      await attesa(800);
    }
    if (p.dopo) { await valuta(p.dopo); await attesa(1200); }
    // una pagina aperta da un clic si fotografa per intero
    if (p.dopo && !p.fissa) { await misura(larghezza, 900); await attesa(500); await misura(larghezza, Math.min(MAX_ALTEZZA, Math.max(900, await valuta('document.documentElement.scrollHeight')))); await attesa(800); }
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(CARTELLA, p.nome + '.png'), Buffer.from(data, 'base64'));
    console.log(p.nome);
  }
} finally {
  ws?.close();
  processo.kill();
  await attesa(1500);
  try { rmSync(profilo, { recursive: true, force: true }); } catch { /* il browser lo sta ancora chiudendo */ }
}
process.exit(0);
