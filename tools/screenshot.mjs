// Screenshot a pagina intera della dashboard in docs\screenshots, con Chrome o Edge senza finestra.
// Uso: node tools/screenshot.mjs [nome...]  (di solito tramite tools\screenshot.ps1; gateway attivo)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARTELLA = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
const BASE = 'http://127.0.0.1:5790/dashboard#';
const MAX_ALTEZZA = 7000; // oltre, l'immagine diventa illeggibile

const clic = (selettore) => `document.querySelector('${selettore}')?.click()`;
const mostraTip = (selettore) => `document.querySelector('${selettore}')?.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`;
// pagina: percorso; dopo: JavaScript eseguito prima dello scatto; fissa: altezza imposta (solo cio' che si vede)
const PAGINE = [
  { nome: '01-panoramica', pagina: 'panoramica' },
  { nome: '02-render', pagina: 'render' },
  { nome: '03-generi', pagina: 'generi' },
  { nome: '04-voti', pagina: 'voti' },
  { nome: '14-andamento', pagina: 'andamento' },
  { nome: '05-qualita', pagina: 'qualita' },
  { nome: '06-libreria', pagina: 'libreria' },
  { nome: '18-lettore', pagina: 'libreria', dopo: clic('#recenti .ascolta'), fissa: 900 },
  { nome: '07-controllo-produzione', pagina: 'controllo/produzione' },
  { nome: '08-controllo-parametri', pagina: 'controllo/parametri' },
  { nome: '09-controllo-generi', pagina: 'controllo/generi' },
  { nome: '10-controllo-guida', pagina: 'controllo/guida' },
  { nome: '15-controllo-guida-genere', pagina: 'controllo/guida/Blues-shuffle-strumentale' },
  { nome: '19-tooltip', pagina: 'controllo/guida/Blues-shuffle-strumentale', dopo: mostraTip('#gPrompt [data-fai]'), fissa: 760 },
  { nome: '16-controllo-guida-tempo', pagina: 'controllo/guida/tempo' },
  { nome: '20-controllo-guida-note', pagina: 'controllo/guida/note' },
  { nome: '11-controllo-note', pagina: 'controllo/note' },
  { nome: '17-controllo-messaggi', pagina: 'controllo/messaggi' },
  { nome: '12-controllo-storico', pagina: 'controllo/storico' },
  { nome: '13-log', pagina: 'log' },
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
const processo = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profilo}`, 'about:blank'], { stdio: 'ignore' });
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
    await cdp('Page.navigate', { url: 'about:blank' });
    await cdp('Page.navigate', { url: BASE + p.pagina });
    await attesa(6000);
    if (!p.fissa) {
      const altezza = Math.min(MAX_ALTEZZA, Math.max(900, await valuta('document.documentElement.scrollHeight')));
      await misura(larghezza, altezza);
      await attesa(800);
    }
    if (p.dopo) { await valuta(p.dopo); await attesa(1200); }
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
