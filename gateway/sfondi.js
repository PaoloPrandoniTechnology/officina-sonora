// Generazione degli sfondi delle copertine, avviata e fermata dalla dashboard.
// Il lavoro lo fa tools/genera-sfondi.js (mette in pausa la produzione e la ripristina quando finisce).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = path.join(__dirname, '..');
const file = (base, nome) => path.join(base, 'state', nome);

function vivo(base) {
  let pid = 0;
  try { pid = Number(fs.readFileSync(file(base, 'sfondi.pid'), 'utf8')); } catch (e) { return false; }
  if (!(pid > 0)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function stato(base = DIR) {
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'config', 'catalogo.json'), 'utf8')).categories || [];
  const fatti = cat.reduce((somma, c) => {
    const dir = path.join(base, 'assets', 'sfondi', c.name);
    return somma + (fs.existsSync(dir) ? Math.min(8, fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).length) : 0);
  }, 0);
  let ultima = '';
  try { ultima = fs.readFileSync(file(base, 'sfondi.log'), 'utf8').split(/\r?\n/).filter(Boolean).pop() || ''; } catch (e) { /* mai avviato */ }
  const inCorso = vivo(base);
  return { fatti, totale: cat.length * 8, inCorso, inChiusura: inCorso && fs.existsSync(file(base, 'sfondi.stop')), ultima };
}

function avvia(base = DIR, lancia = spawn) {
  if (vivo(base)) throw new Error('generazione degli sfondi gia in corso');
  fs.rmSync(file(base, 'sfondi.stop'), { force: true });
  // il generatore e la WebUI non devono ricevere i token che il gateway ha nel proprio ambiente
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(TELEGRAM|IBROADCAST)_/i.test(k)));
  const log = fs.openSync(file(base, 'sfondi.log'), 'w');
  const p = lancia(process.execPath, [path.join(base, 'tools', 'genera-sfondi.js')], { cwd: base, env, stdio: ['ignore', log, log], windowsHide: true });
  fs.closeSync(log);
  if (p.on) p.on('error', (e) => fs.appendFileSync(file(base, 'sfondi.log'), 'avvio non riuscito: ' + e.message + '\n'));
  if (p.pid) fs.writeFileSync(file(base, 'sfondi.pid'), String(p.pid));
  p.unref();
}

function ferma(base = DIR) {
  if (!vivo(base)) throw new Error('nessuna generazione di sfondi in corso');
  fs.writeFileSync(file(base, 'sfondi.stop'), new Date().toISOString());
}

module.exports = { stato, avvia, ferma };
