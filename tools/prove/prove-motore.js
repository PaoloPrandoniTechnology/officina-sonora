// Prove A/B sul motore YuE2: score, lyrics e LoRA. Uso (produzione ferma): node tools/prove/prove-motore.js [cartella]
// I risultati restano in state\prove\, con index.html per l'ascolto. Le prove riuscite non si ripetono.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const A = require('../../src/compositore/abc.js');
const SCORE = require('./score-prova.js');

const FFPROBE = 'E:\\MusicAI\\ffmpeg\\bin\\ffprobe.exe';
const BRANI = {
  surf: {
    style: 'instrumental surf rock, spring reverb electric guitar lead with tremolo picking, twangy rhythm guitar, driving drums with ride cymbal and tom fills, picked electric bass, live band, bright vintage room, 136 BPM, E minor',
    note: ['reverb guitar riff alone', 'guitar theme', 'wide open refrain', 'theme moved higher', 'stop time hits', 'wide open refrain', 'riff fades out'],
    attuale: '[Intro]\n\n[Main]\n\n[Main]\n\n[Peak]\n\n[Main]\n\n[Outro]',
  },
  cinematico: {
    style: 'instrumental cinematic orchestral score, solo french horn theme, low strings ostinato, harp, timpani and taiko swells, full brass climax, wide concert hall, dynamic build and sparse ending, 92 BPM, D minor',
    note: ['sparse strings in three', 'horn theme', 'string ostinato in seven', 'broad theme in major', 'full orchestra climax', 'thinning out'],
    attuale: '[Intro]\n\n[Build]\n\n[Peak]\n\n[Release]\n\n[Outro]',
  },
};
const lora = (name, ar_scale = 1, nar_scale = 0) => ({ name, scale: 1, ar_scale, nar_scale });
const STRUM = lora('yue2-instrumental');
const KTO = lora('yue2-instrumental-kto');

function griglia() {
  const prove = [];
  for (const [brano, b] of Object.entries(BRANI)) {
    const score = SCORE[brano];
    const secondi = A.durataSecondi(score);
    const abc = A.scriviAbc(score);
    const semplici = A.lyricsDaScore(score, { forma: 'semplice' });
    const varianti = {
      A: { cot: 'melody', lyrics: b.attuale, adapters: [KTO], abc_sampling: { max_tokens: 6000 } },
      B: { cot: 'full', lyrics: semplici, adapters: [STRUM], abc_sampling: { max_tokens: 6000 } },
      C: { cot: 'full', abc, lyrics: semplici, adapters: [STRUM] },
      D: { cot: 'full', abc, lyrics: A.lyricsDaScore(score, { forma: 'tempi' }), adapters: [STRUM] },
      E: { cot: 'full', abc, lyrics: A.lyricsDaScore(score, { forma: 'indicazioni', note: b.note }), adapters: [STRUM] },
      F: { cot: 'full', abc, lyrics: semplici, adapters: [KTO] },
    };
    if (brano === 'cinematico') varianti.G = { cot: 'full', abc, lyrics: semplici, adapters: [STRUM, lora('yue2-epic-trailer', 0.5, 0.375)] };
    if (brano === 'surf') varianti.H = { cot: 'full', abc, lyrics: semplici, adapters: [STRUM, lora('yue2-slider-indie-rock', 0.25)] };
    for (const [variante, v] of Object.entries(varianti)) {
      prove.push({
        id: `${brano}-${variante}`, brano, variante, secondi,
        body: {
          style: b.style, ...v, duration: Math.ceil(secondi * 1.15), seed: 424242, lm_seed: 424242,
          semantic_sampling: { max_tokens: Math.min(9000, Math.ceil(secondi * 25 * 1.15)) }, output_format: 'mp3',
        },
      });
    }
  }
  return prove;
}

// Separa le parti di una risposta multipart (richieste di replica in JSON e audio)
function parti(buf, tipo) {
  const m = /boundary="?([^";]+)"?/i.exec(tipo || '');
  if (!m) return [{ testa: tipo || '', dati: buf }];
  const sep = Buffer.from('--' + m[1]);
  const out = [];
  for (let i = buf.indexOf(sep); i !== -1;) {
    const dopo = buf.indexOf(sep, i + sep.length);
    const pezzo = buf.subarray(i + sep.length, dopo === -1 ? buf.length : dopo);
    const h = pezzo.indexOf('\r\n\r\n');
    if (h !== -1) {
      let dati = pezzo.subarray(h + 4);
      if (dati.subarray(-2).toString() === '\r\n') dati = dati.subarray(0, -2);
      out.push({ testa: pezzo.subarray(0, h).toString('utf8').toLowerCase(), dati });
    }
    i = dopo;
  }
  return out;
}

function durataAudio(file) {
  try {
    const s = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    if (s > 0) return s;
  } catch (e) { /* senza ffprobe, o file non analizzabile: stima a 128 kbps */ }
  return fs.statSync(file).size / 16000;
}

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function unaProva(p, motore, dir, attesaMs) {
  const chiama = async (via, opzioni) => {
    const r = await fetch(motore + via, { signal: AbortSignal.timeout(180000), ...opzioni });
    if (!r.ok) throw new Error(`HTTP ${r.status} su ${via}: ${(await r.text()).slice(0, 200)}`);
    return r;
  };
  const props = await (await chiama('/props')).json();
  // senza un elenco in /props si prova lo stesso: decide /synth
  const presenti = Array.isArray(props.adapters) && new Set(props.adapters.filter((a) => a.ok !== false).map((a) => a.name || a));
  const manca = presenti && p.body.adapters.find((a) => !presenti.has(a.name));
  if (manca) return { stato: 'saltata', motivo: `LoRA assente sul motore: ${manca.name}` };

  let invio;
  try {
    invio = await chiama('/synth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p.body) });
  } catch (e) {
    if (/HTTP 4\d\d.*adapter/i.test(e.message)) return { stato: 'saltata', motivo: e.message };
    throw e;
  }
  const { id } = await invio.json();
  const scadenza = Date.now() + 45 * 60 * 1000;
  let guasti = 0;
  for (;;) {
    if (Date.now() > scadenza) {
      await fetch(`${motore}/job?id=${id}&cancel=1`, { method: 'POST' }).catch(() => {});
      throw new Error('tempo scaduto (45 minuti)');
    }
    await pausa(attesaMs);
    let stato;
    try { stato = (await (await chiama(`/job?id=${id}`)).json()).status; guasti = 0; } catch (e) { if (++guasti >= 30) throw e; continue; }
    if (['succeeded', 'done', 'ok'].includes(stato)) break;
    if (['failed', 'error', 'cancelled'].includes(stato)) throw new Error(`job ${stato}`);
  }
  const r = await chiama(`/job?id=${id}&result=1`);
  const tutte = parti(Buffer.from(await r.arrayBuffer()), r.headers.get('content-type'));
  const audio = tutte.find((x) => /audio\/|filename/.test(x.testa));
  if (!audio) throw new Error('nessuna traccia audio nella risposta');
  let score;
  tutte.filter((x) => x !== audio).forEach((x, i) => {
    const nome = `risposta-${i + 1}.json`;
    fs.writeFileSync(path.join(dir, nome), x.dati);
    let abc;
    try { abc = JSON.parse(x.dati.toString('utf8')).abc; } catch (e) { /* parte non JSON */ }
    if (!abc) return;
    const r = A.leggiAbc(abc);
    score = { secondi: r.score ? Math.round(A.durataSecondi(r.score)) : null, errori: r.errori.length, file: nome };
  });
  const file = path.join(dir, 'audio.mp3');
  fs.writeFileSync(file, audio.dati);
  const secondiAudio = Math.round(durataAudio(file));
  const corto = (s) => s < p.secondi * 0.85;
  return {
    stato: 'ok', file, secondiAudio, score,
    troncato: corto(secondiAudio) || (score?.secondi != null && corto(score.secondi)),
    alLimite: secondiAudio >= p.body.duration - 1, // il motore si e' fermato al limite richiesto: finale probabilmente tagliato
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pagina(prove, esiti) {
  const nomi = { A: 'sistema attuale', B: 'score di YuE2', C: 'score nostro, tag semplici', D: 'score nostro, tag con tempi', E: 'score nostro, tag con indicazioni', F: 'score nostro, LoRA KTO', G: 'score nostro + epic trailer', H: 'score nostro + slider indie rock' };
  const voti = ['tema seguito', 'struttura', 'senza voci', 'qualità'];
  const schede = prove.map((p) => {
    const e = esiti.find((x) => x.id === p.id) || { stato: 'non ancora eseguita' };
    const corpo = e.stato === 'ok'
      ? `<audio controls preload="none" src="${esc(p.id)}/audio.mp3"></audio>
<p>${e.secondiAudio} s di audio, ${Math.round((e.secondiAudio / p.secondi) * 100)}% dei ${Math.round(p.secondi)} s previsti${e.troncato ? ' <b>TRONCATO</b>' : ''}${e.alLimite ? ' <b>ARRIVATO AL LIMITE</b>' : ''}</p>
${e.score ? `<p><a href="${esc(p.id)}/${esc(e.score.file)}">score restituito: ${esc(e.score.secondi ?? 'illeggibile')} s, ${esc(e.score.errori)} errori</a></p>` : ''}
<p>${voti.map((v) => `<label>${v} <select data-id="${esc(p.id)}" data-voto="${v}"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>`).join(' ')}</p>
<label>note <input data-id="${esc(p.id)}" data-voto="note" size="50"></label>`
      : `<p><b>${esc(e.stato)}</b> ${esc(e.motivo)}</p>`;
    return `<section><h2>${esc(p.id)}: ${esc(nomi[p.variante])}</h2>${corpo}<details><summary>richiesta</summary><pre>${esc(JSON.stringify(p.body, null, 2))}</pre></details></section>`;
  }).join('\n');
  return `<!doctype html><html lang="it"><meta charset="utf-8"><title>Prove sul motore</title>
<style>body{font:15px system-ui;max-width:900px;margin:24px auto;padding:0 16px;background:#fff;color:#111}section{border-top:1px solid #ccc;padding:8px 0}audio{width:100%}pre{white-space:pre-wrap}</style>
<h1>Prove sul motore</h1><p>Voti da 1 a 5. Alla fine premi "Copia voti" e incolla il testo in chat.</p>
${schede}
<p><button id="copia">Copia voti</button></p><textarea id="testo" rows="14" cols="90"></textarea>
<script>
const campi = [...document.querySelectorAll('[data-id]')];
for (const c of campi) {
  const k = 'prova:' + c.dataset.id + ':' + c.dataset.voto;
  try { c.value = localStorage.getItem(k) || ''; } catch (e) {}
  c.addEventListener('input', () => { try { localStorage.setItem(k, c.value); } catch (e) {} });
}
document.getElementById('copia').onclick = () => {
  const r = {};
  for (const c of campi) if (c.value) (r[c.dataset.id] ||= []).push(c.dataset.voto + ' ' + c.value);
  const t = document.getElementById('testo');
  t.value = Object.entries(r).map(([id, v]) => id + ': ' + v.join(', ')).join('\\n');
  t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) {}
};
</script></html>`;
}

async function esegui({ prove = griglia(), motore = 'http://127.0.0.1:18087', cartella, attesaMs = 10000 }) {
  const esiti = [];
  for (const p of prove) {
    const dir = path.join(cartella, p.id);
    fs.mkdirSync(dir, { recursive: true });
    const fileEsito = path.join(dir, 'esito.json');
    let e = null;
    try { e = JSON.parse(fs.readFileSync(fileEsito, 'utf8')); } catch (err) { /* mai eseguita */ }
    const impronta = crypto.createHash('sha256').update(JSON.stringify(p.body)).digest('hex');
    if (!e || e.stato !== 'ok' || e.impronta !== impronta) {
      fs.writeFileSync(path.join(dir, 'richiesta.json'), JSON.stringify(p.body, null, 2));
      console.log(`${new Date().toISOString()} ${p.id}: avvio`);
      try { e = { id: p.id, ...(await unaProva(p, motore, dir, attesaMs)) }; } catch (err) { e = { id: p.id, stato: 'fallita', motivo: err.cause ? `${err.message}: ${err.cause.message}` : err.message }; }
      e.impronta = impronta;
      fs.writeFileSync(fileEsito, JSON.stringify(e, null, 2));
      console.log(`${new Date().toISOString()} ${p.id}: ${e.stato}${e.motivo ? ` (${e.motivo})` : ''}${e.troncato ? ' TRONCATO' : ''}`);
    }
    esiti.push(e);
    fs.writeFileSync(path.join(cartella, 'index.html'), pagina(prove, esiti));
  }
  return esiti;
}

module.exports = { griglia, esegui, pagina };

if (require.main === module) {
  const cartella = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'state', 'prove'));
  esegui({ cartella }).then((e) => console.log(`${e.filter((x) => x.stato === 'ok').length}/${e.length} riuscite: ${path.join(cartella, 'index.html')}`));
}
