// Modello di ogni voce della Composizione (letto e riscritto nel formato del compositore) e la mini timeline
// dell'elenco. Il banco di lavoro dove si modifica sta in composizione-banco.js.
(function (radice) {
  'use strict';
  const NOTE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  const PC = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
  const DURATE = [[1, '1/32'], [2, '1/16'], [4, '1/8'], [6, '3/16'], [8, '1/4'], [12, '3/8'], [16, '1/2'], [20, '5/8'], [24, '3/4'], [28, '7/8'], [32, 'intera']];
  const durataTesto = (d) => (DURATE.find((x) => x[0] === d) || [0, `${d}/32`])[1];
  const nomeNota = (m) => NOTE[m % 12] + (Math.floor(m / 12) - 1);
  const MIN = 48, MAX = 84; // Do3 - Do6, come i controlli del compositore

  // ---------- accordi ----------
  const GRADI = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']; // per semitono
  const SEMI = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
  // [chiave, etichetta, grado minuscolo, suffisso scritto, sigla nell'anteprima, note]
  const TIPI = [['M', 'maggiore', false, '', '', [0, 4, 7]], ['m', 'minore', true, '', 'm', [0, 3, 7]], ['7', '7', false, '7', '7', [0, 4, 7, 10]], ['maj7', 'maj7', false, 'maj7', 'maj7', [0, 4, 7, 11]], ['m7', 'm7', true, '7', 'm7', [0, 3, 7, 10]], ['6', '6', false, '6', '6', [0, 4, 7, 9]], ['m6', 'm6', true, '6', 'm6', [0, 3, 7, 9]],
    ['sus2', 'sus2', false, 'sus2', 'sus2', [0, 2, 7]], ['sus4', 'sus4', false, 'sus4', 'sus4', [0, 5, 7]], ['7sus4', '7sus4', false, '7sus4', '7sus4', [0, 5, 7, 10]], ['dim', 'dim', true, 'dim', 'dim', [0, 3, 6]], ['dim7', 'dim7', true, 'dim7', 'dim7', [0, 3, 6, 9]], ['ø', 'semidim.', true, 'ø', 'm7♭5', [0, 3, 6, 10]], ['aug', 'aumentato', false, 'aug', '+', [0, 4, 8]]];
  const tipoDi = (k) => TIPI.find((t) => t[0] === k);
  const semitono = (alt, numero) => (SEMI[numero.toLowerCase()] + (alt === 'b' ? 11 : alt === '#' ? 1 : 0)) % 12;
  // "bVII7/II" -> { semi, tipo, basso }
  function smonta(testo) {
    const m = /^([b#]?)([ivIV]+)(maj7|7sus4|sus4|sus2|dim7|dim|aug|ø|7|6)?(?:\/([b#]?)([IV]+))?$/.exec(testo);
    if (!m || SEMI[m[2].toLowerCase()] === undefined) return { semi: 0, tipo: 'M', basso: null };
    const minore = m[2] === m[2].toLowerCase(), s = m[3] || '';
    const tipo = s === '' ? (minore ? 'm' : 'M') : s === '7' ? (minore ? 'm7' : '7') : s === '6' ? (minore ? 'm6' : '6') : s;
    return { semi: semitono(m[1], m[2]), tipo, basso: m[5] ? semitono(m[4], m[5]) : null };
  }
  function monta({ semi, tipo, basso }) {
    const [, , minuscolo, suffisso] = tipoDi(tipo);
    const g = GRADI[semi];
    return (minuscolo ? g.toLowerCase() : g) + suffisso + (basso === null ? '' : '/' + GRADI[basso]);
  }
  // nome dell'accordo nella tonalità di esempio (La minore o Do maggiore; Do per i richiami)
  const nomeAccordo = (c, tonica) => NOTE[(tonica + c.semi) % 12] + tipoDi(c.tipo)[4] + (c.basso === null ? '' : '/' + NOTE[(tonica + c.basso) % 12]);
  const noteAccordo = (c, tonica) => [36 + ((tonica + (c.basso ?? c.semi)) % 12), ...tipoDi(c.tipo)[5].map((x) => 48 + ((tonica + c.semi) % 12) + x)];
  const leggiAccordi = (t) => String(t || '').split('|').map((b) => b.trim().split(/\s+/).filter(Boolean)).filter((b) => b.length);
  const scriviAccordi = (battute) => battute.map((b) => b.join(' ')).join(' | ');

  // ---------- ritmo, assoli e note: battute di figure che sommano sempre a 32 ----------
  const leggiRitmo = (t, gesti) => {
    let k = 0;
    return String(t || '').split('|').map((b) => b.trim()).filter(Boolean).map((b) => b.split(/\s+/).map((f) => ({
      d: parseInt(f.replace(/^[-v]/, ''), 10), pausa: f.startsWith('-'), app: f.startsWith('v'), ant: f.endsWith('~'), ...(gesti === undefined ? {} : { g: gesti[k++] || 'x' }),
    })));
  };
  const scriviRitmo = (battute) => battute.map((b) => b.map((f) => (f.pausa ? '-' : f.app ? 'v' : '') + f.d + (f.ant ? '~' : '')).join(' ')).join(' | ');
  const scriviGesti = (battute) => battute.flat().map((f) => f.g || 'x').join('');
  const leggiNote = (t) => String(t || '').split('|').map((b) => b.trim()).filter(Boolean).map((b) => b.split(/\s+/).map((x) => {
    const m = /^(?:(-)|(do|re|mi|fa|sol|la|si)(#|b)?(\d)):(\d+)$/i.exec(x);
    if (!m) return { d: 32, midi: 60 };
    const midi = m[1] ? null : 12 * (Number(m[4]) + 1) + PC[m[2].toLowerCase()] + (m[3] === '#' ? 1 : m[3] ? -1 : 0);
    return { d: Number(m[5]), midi, pausa: midi === null };
  }));
  const scriviNote = (battute) => battute.map((b) => b.map((f) => `${f.pausa ? '-' : nomeNota(f.midi)}:${f.d}`).join(' ')).join(' | ');

  // ---------- note posizionate: è così che si lavora sulla timeline (le pause sono gli spazi vuoti) ----------
  const inNote = (battuta) => {
    let pos = 0;
    const out = [];
    for (const { d, pausa, ...resto } of battuta) {
      if (!pausa) out.push({ ...resto, pos, d });
      pos += d;
    }
    return out;
  };
  // di nuovo figure che sommano a 32; l'anticipo vale solo per la nota che tocca la fine della battuta
  function inFigure(note, tipo) {
    const pausa = (d) => ({ d, pausa: true, app: false, ant: false, ...(tipo === 'richiamo' ? { midi: null } : {}), ...(tipo === 'assolo' ? { g: 'x' } : {}) });
    const out = [];
    let pos = 0;
    for (const { pos: da, ...n } of [...note].sort((a, b) => a.pos - b.pos)) {
      if (da > pos) out.push(pausa(da - pos));
      out.push({ ...n, pausa: false, app: !!n.app, ant: !!n.ant && da + n.d === 32 });
      pos = da + n.d;
    }
    if (pos < 32) out.push(pausa(32 - pos));
    return out;
  }
  // mette una nota in una battuta a voce sola: le note che copre si accorciano o spariscono
  function posa(note, nuova) {
    const fine = nuova.pos + nuova.d;
    const out = [];
    for (const n of note) {
      const sua = n.pos + n.d;
      if (sua <= nuova.pos || n.pos >= fine) out.push(n);
      else if (n.pos < nuova.pos) out.push({ ...n, d: nuova.pos - n.pos });
      else if (sua > fine) out.push({ ...n, pos: fine, d: sua - fine });
    }
    return [...out, nuova].sort((a, b) => a.pos - b.pos);
  }

  // ---------- forme ----------
  const SEZ = { gancio: 'Apertura', strofa: 'Strofa', pre: 'Pre-ritornello', rit: 'Ritornello', solo: 'Assolo', ponte: 'Ponte', finale: 'Finale' };
  const leggiForma = (t) => String(t || '').split(/\s+/).filter(Boolean).map((x) => { const [ruolo, battute, priorita] = x.split(':'); return { ruolo, battute: Number(battute), priorita: Number(priorita) }; });
  const scriviForma = (s) => s.map((x) => `${x.ruolo}:${x.battute}:${x.priorita}`).join(' ');

  // dal formato salvato al modello disegnabile
  function modelloDi(v) {
    if (v.tipo === 'armonia') return { tipo: v.tipo, accordi: leggiAccordi(v.testo) };
    if (v.tipo === 'motivo' || v.tipo === 'cadenza') return { tipo: v.tipo, figure: leggiRitmo(v.testo) };
    if (v.tipo === 'assolo') return { tipo: v.tipo, figure: leggiRitmo(v.ritmo, v.gesti || '') };
    if (v.tipo === 'richiamo') return { tipo: v.tipo, accordi: leggiAccordi(v.accordi), figure: leggiNote(v.note) };
    return { tipo: v.tipo, sezioni: leggiForma(v.testo) };
  }
  // dal modello ai campi da salvare
  function campiDi(m) {
    if (m.tipo === 'armonia') return { testo: scriviAccordi(m.accordi) };
    if (m.tipo === 'motivo' || m.tipo === 'cadenza') return { testo: scriviRitmo(m.figure) };
    if (m.tipo === 'assolo') return { ritmo: scriviRitmo(m.figure), gesti: scriviGesti(m.figure) };
    if (m.tipo === 'richiamo') return { accordi: scriviAccordi(m.accordi), note: scriviNote(m.figure) };
    return { testo: scriviForma(m.sezioni) };
  }

  const modello = { NOTE, DURATE, MIN, MAX, GRADI, TIPI, SEZ, durataTesto, nomeNota, smonta, monta, nomeAccordo, noteAccordo, leggiAccordi, scriviAccordi, leggiRitmo, scriviRitmo, scriviGesti, leggiNote, scriviNote, inNote, inFigure, posa, leggiForma, scriviForma, modelloDi, campiDi };
  if (typeof module !== 'undefined') module.exports = modello;
  if (!radice) return;

  // ---------- timeline (usata nell'elenco, in piccolo, e nell'editor) ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const blocco = ({ peso, testo, sotto = '', classe = '', etichetta = '', stile = '' }) => `<div class="tl-blocco ${classe}" style="flex:${peso} 1 0${stile ? ';' + stile : ''}" title="${esc(etichetta)}"><b>${esc(testo)}</b>${sotto ? `<span>${esc(sotto)}</span>` : ''}</div>`;
  const altezza = (midi) => (midi === null ? '' : `--alto:${Math.round(((midi - MIN) / (MAX - MIN)) * 100)}%`);

  // la mini timeline dell'elenco: { tipo, accordi?, figure?, sezioni? }
  function timeline(m, { tonica = 0, gesti = {} } = {}) {
    if (m.sezioni) {
      return `<div class="tl tl-forma mini"><div class="tl-corsia">${m.sezioni.map((s) => blocco({ peso: s.battute, testo: SEZ[s.ruolo] || s.ruolo, sotto: `${s.battute} batt.${s.priorita ? ` · extra ${s.priorita}` : ''}`, classe: `ruolo-${s.ruolo}${s.priorita ? ' extra' : ''}`, etichetta: `${SEZ[s.ruolo] || s.ruolo}, ${s.battute} battute, ${s.priorita ? 'entra se la durata lo permette' : 'sempre presente'}` })).join('')}</div></div>`;
    }
    const quante = Math.max(m.accordi ? m.accordi.length : 0, m.figure ? m.figure.length : 0);
    const colonne = Array.from({ length: quante }, (_, b) => {
      const accordi = m.accordi && m.accordi[b];
      const figure = m.figure && m.figure[b];
      return `<div class="tl-battuta"><small>${b + 1}</small>
        ${accordi ? `<div class="tl-corsia tl-accordi">${accordi.map((a) => blocco({ peso: 1, testo: a, sotto: nomeAccordo(smonta(a), tonica), classe: 'accordo', etichetta: `Battuta ${b + 1}, accordo ${a}` })).join('')}</div>` : ''}
        ${figure ? `<div class="tl-corsia ${m.tipo === 'richiamo' ? 'tl-note' : 'tl-ritmo'}">${figure.map((f) => {
          const testo = f.pausa ? '–' : m.tipo === 'richiamo' ? nomeNota(f.midi) : f.g !== undefined ? (gesti[f.g] ? gesti[f.g][0] : f.g) : (f.app ? '↘ ' : '') + '♪' + (f.ant ? ' ⌒' : '');
          return blocco({ peso: f.d, testo, classe: `figura${f.pausa ? ' pausa' : ''}`, etichetta: `Battuta ${b + 1}, durata ${durataTesto(f.d)}`, stile: m.tipo === 'richiamo' ? altezza(f.midi) : '' });
        }).join('')}</div>` : ''}</div>`;
    }).join('');
    return `<div class="tl mini" style="--colonne:${m.tipo === 'motivo' || m.tipo === 'cadenza' ? 2 : m.tipo === 'assolo' ? 1 : 4}">${colonne}</div>`;
  }
  radice.EditorComposizione = { ...modello, esc, timeline, modelloDi, campiDi };
})(typeof window !== 'undefined' ? window : null);
