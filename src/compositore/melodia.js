// Melodia dei generi creativi, in due strati come lavora un compositore:
// 1. scheletro: una nota d'arrivo sul primo e sul terzo quarto, scelta tra le note dell'accordo lungo un percorso
//    che sale verso un apice e poi scende, con movimenti piccoli (programmazione dinamica);
// 2. superficie: un motivo di due battute (ritmo scritto a mano e "gesti") collega gli arrivi con note di passaggio,
//    di volta, arpeggi, appoggiature che risolvono e anticipi legati oltre la stanghetta.

// Motivi di due battute in trentaduesimi (8 = quarto). "|" stanghetta, negativo = pausa,
// "~" = anticipo legato alla battuta dopo, "v" = appoggiatura sull'arrivo.
const MOTIVI = {
  dritto: ['-4 4 4 4 6 6 4~ | 8 4 4 -8 8', 'v8 4 4 8 4 4~ | 12 4 16', '6 6 4 8 4 4 | -4 4 8 8 4 4~', '12 4 4 4 8 | 6 6 4 -16', '-8 4 4 4 8 4~ | 4 4 8 v8 8', '8 8 6 6 4~ | 16 -4 4 4 4'],
  swing: ['-4 4 6 2 6 2 8~ | 12 4 -16', 'v12 4 6 2 8 | -8 6 2 6 2 8~', '6 2 6 2 12 4~ | 8 6 2 v8 8', '-8 6 2 8 6 2~ | 6 2 8 -16', '16 -4 4 6 2 | 12 4 6 2 8~', '8 6 2 -4 4 6 2~ | v16 8 -8'],
  sincopato: ['-4 4 4 -2 6 4 8~ | 6 6 4 -16', '6 6 4 -4 4 4 4~ | 12 -4 2 2 4 8', '-8 2 2 4 6 6 4~ | 4 -4 8 v8 8', 'v8 -2 2 4 -4 4 8 | -4 2 2 4 4 4 12~', '4 -4 4 2 2 -4 8 4~ | 8 -8 6 2 8', '-2 2 4 4 -2 6 12~ | 6 2 8 -16'],
  ampio: ['16 8 8 | 24 8~', 'v16 16 | 12 4 16', '-8 8 12 4~ | 16 8 8', '24 4 4~ | v16 8 8', '12 4 8 8 | 32', '-16 8 4 4~ | 12 4 16'],
  danza: ['4 4 4 4 8 4 4 | 6 2 8 16', '8 6 2 4 4 4 4~ | 8 8 v8 8', '6 2 4 4 6 2 4 4 | 12 4 8 8', 'v8 4 4 4 4 8~ | 4 4 4 4 16', '-4 4 4 4 6 6 4~ | 8 4 4 16', '4 4 8 4 4 8 | 6 2 4 4 8 8'],
};
// chiusure di periodo: respirano
const CADENZE = ['8 8 4 4 8 | 24 -8', '12 4 v8 8 | 32', '6 6 4 8 8~ | 24 -8', '-8 8 8 8 | v16 16', '4 4 4 4 16 | 28 -4'];
// frasi d'assolo di una battuta: ritmo e gesti insieme (p passaggio, n volta, a arpeggio, s salto, c cromatica d'approccio, r ribattuta)
const LICK = [
  ['4 4 4 4 4 4 4 4', 'xapxpapc'], ['2 2 4 4 4 8 4 4', 'xppaxcxp'], ['-4 4 2 2 4 8 8', 'xxppaxx'], ['6 2 4 4 6 2 4 4', 'xnxaxpxc'], ['8 4 4 2 2 2 2 8', 'xsxpppcx'],
  ['4 -4 4 4 -4 4 8', 'xxrsxax'], ['12 4 4 4 4 4', 'xcxaap'], ['2 2 2 2 4 4 -4 4 8', 'xpppxaxcx'], ['4 4 4 4 16', 'xssnx'], ['-8 4 4 4 4 8', 'xxapac'], ['16 -8 2 2 4', 'xxppc'], ['4 2 2 4 4 4 4 4 4', 'xnnxaxpxc'],
];

function leggiMotivo(testo) {
  return testo.split('|').flatMap((battuta, b) => {
    let pos = b * 32;
    return battuta.trim().split(/\s+/).map((t) => {
      const durata = Math.abs(parseInt(t.replace('v', ''), 10));
      const e = { inizio: pos, durata, pausa: t.startsWith('-'), appoggia: t.startsWith('v'), anticipo: t.endsWith('~') };
      pos += durata;
      return e;
    });
  });
}

const PESI_GESTI = [['p', 45], ['a', 22], ['n', 14], ['r', 11], ['s', 8]];
function motivo(r, testo) {
  const note = leggiMotivo(testo);
  const gesto = () => { let x = r() * 100; return (PESI_GESTI.find(([, p]) => (x -= p) < 0) || PESI_GESTI[0])[0]; };
  return { testo, note, gesti: note.map(gesto), verso: note.map(() => (r() < 0.5 ? 1 : -1)) };
}

const vicino = (midi, ammesse) => ammesse.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
const accordoA = (accordi, pos) => [...accordi].reverse().find((a) => a.pos <= pos) || accordi[0];

// La scala della tonalità, piegata sull'accordo del momento: dove l'accordo esce dalla tonalità, la scala lo segue
function scalaDi(scala, tonica, accordo, basso, alto) {
  const pcs = new Set(scala.map((x) => (tonica + x) % 12));
  for (const pc of accordo.pcs) {
    if (pcs.has(pc)) continue;
    for (const vicina of [(pc + 1) % 12, (pc + 11) % 12]) if (!accordo.pcs.includes(vicina)) pcs.delete(vicina);
    pcs.add(pc);
  }
  const out = [];
  for (let m = basso; m <= alto; m++) if (pcs.has(m % 12)) out.push(m);
  return out;
}

const COSTO_SALTO = [1.4, 0, 0, 0.4, 0.5, 1.3, 2.4, 2.8, 4.5, 5, 7, 8, 9];

// Arrivi: uno ogni mezza battuta. cadenza = classi di altezza gradite per l'ultimo (finale di frase)
function scheletro(r, { battute, centro, basso, alto, daNota, cadenza, salita = 7 }) {
  const slot = battute.flatMap((accordi) => [0, 16].map((pos) => accordoA(accordi, pos)));
  const percorso = (t) => (t < 0.7 ? centro - 3 + (salita * t) / 0.7 : centro - 3 + salita - ((salita - 1) * (t - 0.7)) / 0.3);
  let strati = [{ midi: daNota ?? Math.round(percorso(0)), costo: 0, da: null }];
  slot.forEach((accordo, i) => {
    const meta = percorso(slot.length > 1 ? i / (slot.length - 1) : 0);
    const voci = [];
    for (let m = basso; m <= alto; m++) if (accordo.pcs.includes(m % 12) && Math.abs(m - centro) <= 11) voci.push(m);
    const rumore = new Map(voci.map((m) => [m, r() * 1.6]));
    strati = voci.map((m) => {
      const grado = accordo.pcs.indexOf(m % 12);
      let proprio = Math.abs(m - meta) * 0.3 + rumore.get(m) - (grado === 1 || grado === 3 ? 0.6 : 0) + (grado === 0 && i < slot.length - 1 ? 0.3 : 0);
      if (i === slot.length - 1 && cadenza && !cadenza.includes(m % 12)) proprio += 7;
      let migliore = null;
      for (const prima of strati) {
        const salto = Math.abs(m - prima.midi);
        const costo = prima.costo + proprio + (COSTO_SALTO[salto] ?? 12);
        if (!migliore || costo < migliore.costo) migliore = { midi: m, costo, da: prima };
      }
      return migliore;
    });
  });
  let nodo = strati.reduce((a, b) => (b.costo < a.costo ? b : a));
  const out = [];
  while (nodo.da) { out.unshift(nodo.midi); nodo = nodo.da; }
  return out;
}

// Due battute di melodia: motivo + arrivi. dopo = l'arrivo successivo, verso cui puntare in fondo
function frase({ battute, m, arrivi, dopo, scala, tonica, basso, alto }) {
  const scaleDi = battute.map((accordi) => accordi.map((a) => ({ pos: a.pos, accordo: a, note: scalaDi(scala, tonica, a, basso, alto) })));
  const qui = (inizio) => accordoA(scaleDi[Math.floor(inizio / 32)].map((x) => ({ ...x, pos: x.pos })), inizio % 32);
  const note = m.note.filter((e) => e.inizio < battute.length * 32);
  const arrivoDi = (inizio) => arrivi[Math.floor(inizio / 16)] ?? dopo ?? arrivi[arrivi.length - 1];
  const prossimo = (inizio) => arrivi[Math.floor(inizio / 16) + 1] ?? dopo ?? arrivi[arrivi.length - 1];
  let ultima = arrivi[0];
  let risolvi = null;
  let coperto = -1; // ultimo arrivo già suonato
  const suono = note.map((e, k) => {
    if (e.pausa) return null;
    const fine = e.inizio + e.durata;
    const { note: scalaQui, accordo } = qui(e.inizio);
    const mezzo = Math.floor(e.inizio / 16);
    const seguente = note.slice(k + 1).find((x) => !x.pausa);
    let midi;
    if (risolvi !== null) { midi = risolvi; risolvi = null; coperto = mezzo; }
    else if (e.anticipo) midi = prossimo(e.inizio);
    else if (mezzo > coperto) {
      // la prima nota di ogni mezza battuta porta l'arrivo
      midi = arrivoDi(e.inizio);
      coperto = mezzo;
      if (e.appoggia && seguente && !seguente.pausa) {
        const sopra = scalaQui.find((x) => x > midi);
        if (sopra !== undefined && sopra - midi <= 2) { risolvi = midi; midi = sopra; }
      }
    } else {
      const meta = prossimo(e.inizio);
      const verso = meta > ultima ? 1 : meta < ultima ? -1 : m.verso[k];
      const passo = (da, d) => { const i = scalaQui.indexOf(vicino(da, scalaQui)); return scalaQui[Math.max(0, Math.min(scalaQui.length - 1, i + d))]; };
      const accordali = scalaQui.filter((x) => accordo.pcs.includes(x % 12));
      const ultimaPrimaDellArrivo = !seguente || Math.floor(seguente.inizio / 16) > mezzo || fine % 16 === 0;
      let g = m.gesti[k];
      if (g === 'c') midi = meta - 1;
      // l'ultima nota prima di un arrivo lo prepara per grado
      else if (ultimaPrimaDellArrivo) { midi = passo(meta, ultima >= meta ? 1 : -1); if (midi === ultima) midi = passo(meta, ultima >= meta ? -1 : 1); }
      else if (g === 'a') midi = (verso > 0 ? accordali.find((x) => x > ultima) : [...accordali].reverse().find((x) => x < ultima)) ?? passo(ultima, verso);
      else if (g === 'n') midi = passo(ultima, m.verso[k]);
      else if (g === 's') midi = accordali.find((x) => x >= ultima + 5 && x <= ultima + 9) ?? passo(ultima, 2);
      else if (g === 'r') midi = ultima;
      else midi = passo(ultima, verso);
    }
    // dopo un salto largo si torna indietro per grado
    midi = Math.max(basso, Math.min(alto, midi));
    ultima = midi;
    return { midi, anticipo: e.anticipo && fine % 32 === 0 };
  });
  return battute.map((_, b) => {
    const eventi = [];
    note.forEach((e, k) => {
      if (Math.floor(e.inizio / 32) !== b) return;
      const s = suono[k];
      eventi.push(s ? { midi: s.midi, durata: e.durata, ...(s.anticipo ? { lega: true } : {}) } : { midi: null, durata: e.durata });
    });
    return eventi;
  });
}

// Salda gli anticipi: la nota legata prosegue nella battuta dopo; se lì non c'è una nota, la legatura si toglie
function salda(battute) {
  const eventi = battute.flatMap((b) => b.ins || [{ midi: null, durata: 32 }]);
  eventi.forEach((e, i) => {
    if (!e.lega) return;
    const poi = eventi[i + 1];
    if (!poi || poi.midi === null) delete e.lega;
    else poi.midi = e.midi;
  });
  return battute;
}

if (typeof module !== 'undefined') module.exports = { MOTIVI, CADENZE, LICK, motivo, leggiMotivo, scalaDi, scheletro, frase, salda };
