// Editor della Composizione: il modello di ogni voce (letto e riscritto nel formato del compositore), la mini
// timeline e i pulsanti. Si sceglie, non si scrive: ogni operazione lascia la voce valida.
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

  // dopo ogni modifica: almeno una nota, appoggiatura mai sulle pause, anticipo solo sull'ultima nota
  function sistema(battuta) {
    if (battuta.every((f) => f.pausa)) { battuta[0].pausa = false; if (battuta[0].midi === null) battuta[0].midi = 60; }
    battuta.forEach((f, i) => {
      if (f.pausa) { f.app = false; f.ant = false; if ('midi' in f) f.midi = null; if ('g' in f) f.g = 'x'; }
      if (i < battuta.length - 1) f.ant = false;
    });
    return battuta;
  }
  const nuovaPausa = (come, d) => ({ ...come, d, pausa: true, app: false, ant: false, ...('midi' in come ? { midi: null } : {}), ...('g' in come ? { g: 'x' } : {}) });
  const massimo = (battuta, i) => 32 - battuta.slice(0, i).reduce((a, f) => a + f.d, 0);
  // allungare mangia le figure che seguono; accorciare lascia il tempo avanzato in pausa
  function cambiaDurata(battuta, i, d) {
    const f = battuta[i];
    if (d < 1 || d > massimo(battuta, i)) return battuta;
    let manca = d - f.d;
    f.d = d;
    while (manca > 0) {
      const poi = battuta[i + 1];
      if (poi.d <= manca) { manca -= poi.d; battuta.splice(i + 1, 1); }
      else { poi.d -= manca; manca = 0; }
    }
    if (manca < 0) {
      const poi = battuta[i + 1];
      if (poi && poi.pausa) poi.d -= manca;
      else battuta.splice(i + 1, 0, nuovaPausa(f, -manca));
    }
    return sistema(battuta);
  }
  function dividi(battuta, i) {
    const f = battuta[i];
    if (f.d < 2) return battuta;
    const meta = Math.ceil(f.d / 2);
    battuta.splice(i + 1, 0, { ...f, d: f.d - meta, app: false });
    f.d = meta; f.ant = false;
    return sistema(battuta);
  }
  function unisci(battuta, i) {
    if (i + 1 >= battuta.length) return battuta;
    const [poi] = battuta.splice(i + 1, 1);
    battuta[i].d += poi.d; battuta[i].ant = poi.ant;
    return sistema(battuta);
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

  const modello = { NOTE, DURATE, MIN, MAX, GRADI, TIPI, SEZ, durataTesto, nomeNota, smonta, monta, nomeAccordo, noteAccordo, leggiAccordi, scriviAccordi, leggiRitmo, scriviRitmo, scriviGesti, leggiNote, scriviNote, sistema, massimo, cambiaDurata, dividi, unisci, leggiForma, scriviForma, modelloDi, campiDi };
  if (typeof module !== 'undefined') module.exports = modello;
  if (!radice) return;

  // ---------- timeline (usata nell'elenco, in piccolo, e nell'editor) ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // blocco: largo quanto dura; tasto se si può scegliere, altrimenti solo disegno
  function blocco({ peso, testo, sotto = '', classe = '', dati = null, scelto = false, etichetta = '', stile = '' }) {
    const attr = dati ? ` data-t="${dati}" aria-pressed="${scelto}" aria-label="${esc(etichetta || testo)}"` : '';
    const el = dati ? 'button type="button"' : 'div';
    return `<${el} class="tl-blocco ${classe}" style="flex:${peso} 1 0${stile ? ';' + stile : ''}"${attr} title="${esc(etichetta)}"><b>${esc(testo)}</b>${sotto ? `<span>${esc(sotto)}</span>` : ''}</${dati ? 'button' : 'div'}>`;
  }
  const altezza = (midi) => (midi === null ? '' : `--alto:${Math.round(((midi - MIN) / (MAX - MIN)) * 100)}%`);

  // modello di una voce: { tipo, accordi?, figure?, sezioni? } e la scelta corrente [battuta, elemento, corsia]
  function timeline(m, { scelta = null, tonica = 0, gesti = {} } = {}) {
    const attivo = (c, b, i) => !!scelta && scelta[0] === c && scelta[1] === b && scelta[2] === i;
    const mini = !scelta;
    if (m.sezioni) {
      return `<div class="tl tl-forma${mini ? ' mini' : ''}"><div class="tl-corsia">${m.sezioni.map((s, i) => blocco({ peso: s.battute, testo: SEZ[s.ruolo] || s.ruolo, sotto: `${s.battute} batt.${s.priorita ? ` · extra ${s.priorita}` : ''}`, classe: `ruolo-${s.ruolo}${s.priorita ? ' extra' : ''}`, dati: mini ? null : `s:0:${i}`, scelto: attivo('s', 0, i), etichetta: `${SEZ[s.ruolo] || s.ruolo}, ${s.battute} battute, ${s.priorita ? 'entra se la durata lo permette' : 'sempre presente'}` })).join('')}</div><i class="tl-testa" hidden></i></div>`;
    }
    const quante = Math.max(m.accordi ? m.accordi.length : 0, m.figure ? m.figure.length : 0);
    const colonne = Array.from({ length: quante }, (_, b) => {
      const accordi = m.accordi && m.accordi[b];
      const figure = m.figure && m.figure[b];
      return `<div class="tl-battuta"><small>${b + 1}</small>
        ${accordi ? `<div class="tl-corsia tl-accordi">${accordi.map((a, i) => { const c = smonta(a); return blocco({ peso: 1, testo: a, sotto: nomeAccordo(c, tonica), classe: 'accordo', dati: mini ? null : `a:${b}:${i}`, scelto: attivo('a', b, i), etichetta: `Battuta ${b + 1}, accordo ${a}, ${nomeAccordo(c, tonica)}` }); }).join('')}</div>` : ''}
        ${figure ? `<div class="tl-corsia ${m.tipo === 'richiamo' ? 'tl-note' : 'tl-ritmo'}">${figure.map((f, i) => {
          const testo = f.pausa ? '–' : m.tipo === 'richiamo' ? nomeNota(f.midi) : f.g !== undefined ? (gesti[f.g] ? gesti[f.g][0] : f.g) : (f.app ? '↘ ' : '') + '♪' + (f.ant ? ' ⌒' : '');
          const lunga = `Battuta ${b + 1}, ${f.pausa ? 'pausa' : m.tipo === 'richiamo' ? nomeNota(f.midi) : 'nota'}, durata ${durataTesto(f.d)}${f.app ? ', appoggiatura' : ''}${f.ant ? ', anticipo' : ''}${f.g && gesti[f.g] ? `, ${gesti[f.g][1]}` : ''}`;
          return blocco({ peso: f.d, testo, sotto: mini ? '' : durataTesto(f.d), classe: `figura${f.pausa ? ' pausa' : ''}`, dati: mini ? null : `f:${b}:${i}`, scelto: attivo('f', b, i), etichetta: lunga, stile: m.tipo === 'richiamo' ? altezza(f.midi) : '' });
        }).join('')}</div>` : ''}</div>`;
    }).join('');
    return `<div class="tl${mini ? ' mini' : ''}" style="--colonne:${m.tipo === 'motivo' || m.tipo === 'cadenza' ? 2 : m.tipo === 'assolo' ? 1 : 4}">${colonne}<i class="tl-testa" hidden></i></div>`;
  }
  radice.EditorComposizione = { ...modello, esc, timeline, modelloDi, campiDi };
})(typeof window !== 'undefined' ? window : null);
