// Generazione delle copertine (sfondi dei generi e immagini proprie dei brani), avviata e fermata dalla dashboard.
// Il lavoro lo fa tools/genera-sfondi.js (mette in pausa la produzione e la ripristina quando finisce).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const libreria = require('./libreria');
const { chiaveInAttesa } = require('./copertina');

const DIR = path.join(__dirname, '..');
const LIBRERIA = process.env.OFS_LIBRERIA || 'E:\\Musica di sottofondo';
const file = (base, nome) => path.join(base, 'state', nome);

function vivo(base) {
  let pid = 0;
  try { pid = Number(fs.readFileSync(file(base, 'sfondi.pid'), 'utf8')); } catch (e) { return false; }
  if (!(pid > 0)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Brani che non hanno ancora la loro copertina: prima quelli in attesa di produzione, poi i più recenti.
// La chiave è il nome del file in assets/copertine; "file" c'è solo per i brani già in libreria.
function daFare(base = DIR, radice = LIBRERIA) {
  let coda = [];
  try { coda = JSON.parse(fs.readFileSync(file(base, 'state.json'), 'utf8')).queue || []; } catch (e) { /* mai prodotto */ }
  const proprie = path.join(base, 'assets', 'copertine');
  const inAttesa = coda.filter((c) => c.titolo && c.categoria)
    .map((c) => ({ chiave: chiaveInAttesa(c.categoria, c.titolo), meta: c }))
    .filter((x) => !fs.existsSync(path.join(proprie, x.chiave + '.jpg')));
  const brani = libreria.schede(radice).filter((s) => !s.scartato && s.meta.numero_traccia > 0
    && fs.existsSync(s.file.replace(/json$/, 'mp3')));
  // un brano ancora in lavorazione con l'immagine pronta non è da fare: la copertina gliela mette il blocco 3d1
  const inLavorazione = (m) => !(m.ibroadcast && m.id3_frames) && fs.existsSync(path.join(proprie, m.numero_traccia + '.jpg'));
  const senza = brani.filter((s) => !s.meta.copertina_propria && !inLavorazione(s.meta)).sort((a, b) => b.meta.numero_traccia - a.meta.numero_traccia)
    .map((s) => ({ chiave: String(s.meta.numero_traccia), meta: s.meta, file: s.file }));
  return { brani: brani.length, conCopertina: brani.length - senza.length, lavori: [...inAttesa, ...senza] };
}

function stato(base = DIR, radice = LIBRERIA) {
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'config', 'catalogo.json'), 'utf8')).categories || [];
  const fatti = cat.reduce((somma, c) => {
    const dir = path.join(base, 'assets', 'sfondi', c.name);
    return somma + (fs.existsSync(dir) ? Math.min(8, fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).length) : 0);
  }, 0);
  let ultima = '';
  try { ultima = fs.readFileSync(file(base, 'sfondi.log'), 'utf8').split(/\r?\n/).filter(Boolean).pop() || ''; } catch (e) { /* mai avviato */ }
  const inCorso = vivo(base);
  const d = daFare(base, radice);
  return { fatti, totale: cat.length * 8, brani: d.brani, conCopertina: d.conCopertina, daFare: d.lavori.length,
    inCorso, inChiusura: inCorso && fs.existsSync(file(base, 'sfondi.stop')), ultima };
}

function avvia(base = DIR, lancia = spawn) {
  if (vivo(base)) throw new Error('generazione delle copertine gia in corso');
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
  if (!vivo(base)) throw new Error('nessuna generazione di copertine in corso');
  fs.writeFileSync(file(base, 'sfondi.stop'), new Date().toISOString());
}

module.exports = { stato, avvia, ferma, daFare };
