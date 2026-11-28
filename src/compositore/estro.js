// Compositore "estro" per i generi che non sono di quiete. Lavora come un arrangiatore: forma a periodi,
// armonia con cadenze scritta per genere (armonia.js), melodia da scheletro e motivi (melodia.js), un assolo,
// a volte un salto di tonalità o un richiamo a un tema di pubblico dominio.
// livello 1 (vivo) e livello 2 (pieno, un po' più ardito). Deterministico dato il seed.
const Abc = typeof ScoreAbc !== 'undefined' ? ScoreAbc : require('./abc.js');
const Base = typeof Compositore !== 'undefined' ? Compositore : require('./compositore.js');
const Mat = typeof Materiale !== 'undefined' ? Materiale : require('./materiale.js');
const M = typeof Melodia !== 'undefined' ? Melodia : require('./melodia.js');

const { casuale, tonica, profilo, somiglianza, peso, pesato, SCALE, DIESIS, BEMOLLI } = Base;
const scegli = (r, v) => v[Math.floor(r() * v.length)];
const mescola = (r, v) => { const resto = [...v]; return v.map(() => resto.splice(Math.floor(r() * resto.length), 1)[0]); };
const BASSO = 55, ALTO = 84; // dopo la modulazione (massimo +2) si resta entro 55-86
const FEEL = { rock: 'dritto', elettro: 'dritto', blues: 'swing', jazz: 'swing', funk: 'sincopato', cine: 'ampio', drone: 'ampio', folk: 'danza', balcanico: 'danza', flamenco: 'danza' };

// Il materiale (accordi, motivi, assoli, richiami, forme) sta in materiale.js e si modifica dalla dashboard
let serie = null;
const diSerie = () => (serie ||= Mat.pronto({}));
// stile armonico di un genere (il drone usa il materiale cinematico)
const stileDi = (cat) => { const s = profilo(cat, tonica((cat.tonalita || [])[0])).stile; return s === 'drone' ? 'cine' : s; };
const SEZIONE = { gancio: 'intro', strofa: 'verse', pre: 'pre-chorus', rit: 'chorus', solo: 'interlude', ponte: 'bridge', finale: 'outro' };
const DA_SEZIONE = { intro: 'gancio', verse: 'strofa', 'pre-chorus': 'pre', chorus: 'rit', bridge: 'ponte', interlude: 'solo', instrumental: 'solo', outro: 'finale' };
const CENTRI = { gancio: 69, strofa: 67, pre: 70, rit: 73, solo: 73, ponte: 68, finale: 69 };

function componiForma(tutte, totale) {
  const prese = new Set(tutte.filter((x) => x.priorita === 0));
  const lunghezza = () => [...prese].reduce((a, x) => a + x.battute, 0);
  for (const x of [...tutte].sort((a, b) => a.priorita - b.priorita)) if (!prese.has(x) && lunghezza() + x.battute <= totale + 2) prese.add(x);
  const piano = tutte.filter((x) => prese.has(x)).map((x) => ({ ...x }));
  // brani lunghi: un altro assolo e un altro ritornello prima del finale
  let resto = totale - lunghezza();
  for (let i = 0; resto >= 8; i++, resto -= 8) piano.splice(piano.length - 1, 0, { ruolo: i % 2 ? 'rit' : 'solo', battute: 8 });
  // brani brevi: si accorciano le sezioni, partendo dal fondo
  for (let i = piano.length - 2; i >= 1 && resto <= -4; i--) if (piano[i].battute === 8) { piano[i].battute = 4; resto += 4; }
  piano[piano.length - 1].battute = Math.max(2, piano[piano.length - 1].battute + resto);
  return piano;
}

// Forma scelta a mano (editor): le sezioni restano quelle, le battute seguono la durata
function formaScelta(sezioni, totale) {
  const piano = sezioni.map((s) => { const ruolo = DA_SEZIONE[s.replace(/[[\]]/g, '')] || 'strofa'; return { ruolo, peso: ['gancio', 'finale', 'pre'].includes(ruolo) ? 1 : 2 }; });
  const somma = piano.reduce((a, x) => a + x.peso, 0);
  let usate = 0, fatto = 0;
  return piano.map((x) => {
    fatto += x.peso;
    const battute = Math.max(2, Math.round((fatto * totale) / somma) - usate);
    usate += battute;
    return { ...x, battute };
  });
}

function candidato(r, { cat, bpm, tonalita, durata_s, sezioni, estro = 2 }, { nomeForma, idCameo, mat }) {
  const t = tonica(tonalita);
  const p = profilo(cat, t);
  const pieno = estro >= 2;
  const modoM = t.minore ? 'm' : 'M';
  const scala = p.stile === 'flamenco' ? SCALE.frigiaDominante : p.stile === 'balcanico' ? (t.minore ? SCALE.armonica : SCALE.frigiaDominante)
    : t.minore ? (p.stile === 'funk' ? SCALE.dorico : SCALE.minore) : SCALE.maggiore;
  const nomiAccordi = /b|^(F|Dm|Gm|Cm|Fm)$/.test(t.sigla) ? BEMOLLI : DIESIS;
  const nome = (semi) => ([1, 3, 8, 10].includes(semi) ? BEMOLLI : nomiAccordi)[(t.pc + semi) % 12];
  const accordo = ({ semi, tipo, basso }, pos = 0) => ({
    pos,
    sigla: nome(semi) + tipo + (basso === null ? '' : `/${nome(basso)}`),
    pcs: Abc.noteAccordo(nome(semi) + tipo).note,
  });
  const dom = { semi: 7, tipo: '7', basso: null };
  const tonicaFinale = { semi: 0, tipo: p.stile === 'flamenco' || !t.minore ? '' : 'm', basso: null };

  const totale = Math.max(8, Math.round((durata_s * bpm) / 240));
  const piano = sezioni ? formaScelta(sezioni, totale) : componiForma(mat.forme[nomeForma], totale);

  // armonia: un periodo per ruolo, lo stesso a ogni ritorno
  const mio = mat.armonia[p.stile][modoM];
  const periodi = { strofa: scegli(r, mio.strofa), pre: scegli(r, mio.pre), rit: scegli(r, mio.rit), ponte: scegli(r, mio.ponte) };
  periodi.gancio = periodi.finale = periodi.rit;
  periodi.solo = r() < 0.5 ? periodi.strofa : periodi.rit;

  const ultimoRit = piano.map((x) => x.ruolo).lastIndexOf('rit');
  const sale = pieno && ultimoRit > 0 && r() < 0.35 ? scegli(r, [1, 2]) : 0;

  // richiamo: il tema è scelto a monte; sta in apertura o in chiusura, dove non spezza il discorso
  let cameo = null;
  if (idCameo) {
    const lungo = mat.camei[idCameo].note.length;
    const posti = piano.map((x, i) => ({ i, ruolo: x.ruolo })).filter((x) => (x.ruolo === 'gancio' && piano[x.i].battute >= lungo) || (x.ruolo === 'finale' && piano[x.i].battute > lungo));
    if (posti.length) cameo = { id: idCameo, ...scegli(r, posti) };
  }

  // motivi: ritmo scritto a mano, gesti propri del brano
  const [a, b, h, h2, d, e] = mescola(r, mat.motivi[FEEL[p.stile]]).map((testo) => M.motivo(r, testo));
  const cadenze = mescola(r, mat.cadenze).map((testo) => M.motivo(r, testo));
  const FRASI = {
    strofa: [a, b, a, cadenze[0]], pre: [b, cadenze[1]], rit: [h, h2, h, cadenze[2]], ponte: [d, d, e, cadenze[3]],
    gancio: [null, h], finale: [h, cadenze[2]], solo: [],
  };
  const volte = {};
  const memoria = new Map(); // frasi già scritte: tornano uguali, al massimo due volte
  let ultima = 67;
  const trovate = new Set();
  const usate = new Set();

  const scoreSezioni = piano.map(({ ruolo, battute: quante }, s) => {
    const volta = (volte[ruolo] = (volte[ruolo] || 0) + 1) - 1;
    const centro = CENTRI[ruolo] + (ruolo === 'solo' ? volta * 2 : 0);
    const ultimaSezione = s === piano.length - 1;
    if (ruolo === 'solo' || ruolo === 'ponte') trovate.add(ruolo);
    const periodo = periodi[ruolo];
    // il pre porta sempre alla fine del suo periodo; un ritornello accorciato tiene la cadenza
    const parti = quante < periodo.length && (ruolo === 'rit' || ruolo === 'strofa') ? periodo.slice(periodo.length - quante) : periodo;
    const gradi = Array.from({ length: quante }, (_, i) => parti[i % parti.length]);
    // al ritorno del ritornello la penultima battuta si arricchisce di una dominante verso l'ultima
    if (ruolo === 'rit' && volta && quante >= 4) {
      const meta = gradi[quante - 1][0];
      gradi[quante - 2] = [gradi[quante - 2][0], { semi: (meta.semi + 7) % 12, tipo: '7', basso: null }];
      trovate.add('riarmonizzazione');
    }
    if (ruolo === 'pre') gradi[quante - 1] = [gradi[quante - 1][0].semi === 7 ? gradi[quante - 1][0] : gradi[quante - 1][0], ...gradi[quante - 1].slice(1)];
    if (ultimaSezione) { gradi[quante - 1] = [tonicaFinale]; if (quante >= 2 && ruolo === 'finale') gradi[quante - 2] = [dom]; }
    const accordi = gradi.map((g) => g.slice(0, 2).map((x, i) => accordo(x, i * 16)));

    const melodia = Array(quante).fill(null);
    const passi = Math.ceil(quante / 2);
    for (let u = 0; u < passi; u++) {
      const da = u * 2;
      const qui = accordi.slice(da, da + 2);
      const finale = u === passi - 1;
      const meta = qui[qui.length - 1].at(-1);
      // domanda e risposta: a metà periodo si resta aperti, il ritornello e il finale chiudono sulla tonica
      const cadenza = finale ? (ruolo === 'rit' || ruolo === 'finale' ? [t.pc] : [meta.pcs[2] ?? meta.pcs[0]]) : u % 2 ? [meta.pcs[1]] : null;
      let m;
      if (ruolo === 'solo') {
        if (finale) m = cadenze[4];
        else if (u % 4 === 2) m = h; // a metà l'assolo cita il gancio
        else {
          const [x, y] = [scegli(r, mat.lick), scegli(r, mat.lick)];
          const note = M.leggiMotivo(`${x[0]} | ${y[0]}`);
          const gesti = [...x[1], ...y[1]];
          m = { testo: x[0] + y[0], note, gesti: note.map((_, i) => gesti[i] || 'p'), verso: note.map(() => (r() < 0.5 ? 1 : -1)) };
        }
      } else {
        const lista = FRASI[ruolo];
        // sezioni brevi: l'ultima coppia è sempre la chiusura
        m = finale && lista.length > 2 ? lista.at(-1) : lista[u % lista.length];
        // la strofa che ritorna cambia la risposta
        if (ruolo === 'strofa' && volta && u === 1) m = e;
        if (ruolo === 'gancio') m = u === 0 && passi > 1 ? null : h;
      }
      if (!m) continue;
      const chiave = `${m.testo}|${qui.flat().map((x) => x.sigla).join()}|${finale}`;
      const nota = memoria.get(chiave);
      if (nota && nota.volte < 2 && ruolo !== 'solo') {
        nota.volte++;
        nota.battute.forEach((x, i) => { if (da + i < quante) melodia[da + i] = x.map((n) => ({ ...n })); });
        ultima = [...nota.battute.flat()].reverse().find((n) => n.midi !== null)?.midi ?? ultima;
      } else {
        const salita = ruolo === 'rit' || ruolo === 'solo' ? 9 : ruolo === 'pre' ? 8 : 6;
        const arco = ruolo === 'solo' ? Math.round((u / passi) * 6) - 2 : (u === 2 ? 2 : 0);
        const arrivi = M.scheletro(r, { battute: qui, centro: centro + arco, basso: BASSO, alto: ALTO, daNota: ultima, cadenza, salita });
        const righe = M.frase({ battute: qui, m, arrivi, scala, tonica: t.pc, basso: BASSO, alto: ALTO });
        righe.forEach((x, i) => { melodia[da + i] = x; });
        memoria.set(chiave, { volte: 1, battute: righe });
        ultima = arrivi.at(-1);
      }
      if ((ruolo === 'rit' || ruolo === 'finale') && m === h) usate.add(M.leggiMotivo(h.testo.split('|')[0]).map((x) => (x.pausa ? -x.durata : x.durata)).join());
    }

    let battute = accordi.map((ac, i) => ({ accordi: ac.map(({ pos, sigla }) => ({ pos, sigla })), vocal: null, ins: melodia[i] }));
    if (ultimaSezione) {
      const midi = M.scalaDi(scala, t.pc, accordi[quante - 1][0], BASSO, ALTO).filter((x) => x % 12 === t.pc).reduce((x, y) => (Math.abs(y - ultima) < Math.abs(x - ultima) ? y : x));
      battute[quante - 1].ins = [{ midi, durata: 32 }];
    }

    // il richiamo sostituisce le battute della sezione scelta, trasportato nella tonalità o nella sua relativa
    if (cameo && cameo.i === s) {
      const c = mat.camei[cameo.id];
      const sposta = c.modo === modoM ? 0 : t.minore ? 3 : -3;
      const altezze = c.note.flat().filter((x) => x[0] !== null).map((x) => x[0]);
      const centrale = (Math.min(...altezze) + Math.max(...altezze)) / 2;
      const base = t.pc + sposta + 12 * Math.round((70 - centrale - t.pc - sposta) / 12);
      const inizio = ruolo === 'finale' ? Math.max(0, quante - c.note.length - 1) : 0;
      c.note.forEach((battuta, k) => {
        const suoi = c.accordi[k].map((g, i) => ({ pos: i * 16, sigla: accordo({ semi: (g.semi + sposta + 12) % 12, tipo: g.tipo, basso: g.basso === null ? null : (g.basso + sposta + 12) % 12 }).sigla }));
        battute[inizio + k] = { accordi: suoi, vocal: null, ins: battuta.map(([x, durata]) => ({ midi: x === null ? null : base + x, durata })) };
      });
      cameo.battute = [inizio, inizio + c.note.length];
    }
    return { nome: SEZIONE[ruolo], battute };
  });

  if (cameo) trovate.add('cameo');
  const tutte = scoreSezioni.flatMap((x) => x.battute);
  // la nota prima del richiamo non si lega dentro il richiamo, che resta com'è
  if (cameo) {
    const prima = scoreSezioni.slice(0, cameo.i).reduce((n, x) => n + x.battute.length, 0) + cameo.battute[0];
    const ultimo = tutte[prima - 1]?.ins?.at(-1);
    if (ultimo) delete ultimo.lega;
  }
  M.salda(tutte);
  if (tutte.some((x) => x.ins?.some((n) => n.lega))) trovate.add('anticipi');

  let sezioniFinali = scoreSezioni;
  if (sale) {
    trovate.add('modulazione');
    // una legatura non attraversa il cambio di tonalità
    const ultimo = scoreSezioni[ultimoRit - 1]?.battute.at(-1)?.ins?.at(-1);
    if (ultimo) delete ultimo.lega;
    sezioniFinali = scoreSezioni.map((x, i) => {
      if (i < ultimoRit) return x;
      const tr = Abc.trasponi({ tonalita: t.sigla, sezioni: [x] }, sale);
      return { ...tr.sezioni[0], tonalita: tr.tonalita };
    });
  }

  const firmaDi = (...m) => m.map((x) => x.note.map((n) => n.durata).join()).join('|');
  return {
    score: { bpm, metro: '4/4', tonalita: t.sigla, sezioni: sezioniFinali },
    ritornello: usate,
    cameo: cameo ? { id: cameo.id, nome: mat.camei[cameo.id].nome, sezione: cameo.i, battute: cameo.battute } : null,
    trovate: [...trovate].sort(),
    parametri: { progressioni: [], celle: [], trasformazioni: [], forma: nomeForma, cameo: cameo ? cameo.id : null, trovate: [...trovate].sort() },
    firma: { tema: firmaDi(a, b), mosse: [a, b, h, h2].map((x) => x.gesti.join('')).join('|') + firmaDi(h), ritornello: firmaDi(h, h2), progressioni: [periodi.strofa, periodi.rit].map((x) => x.flat().map((g) => g.semi + g.tipo).join(' ')).join('/'), tonalita: t.sigla, forma: nomeForma, cameo: cameo ? cameo.id : null },
  };
}

// Revisore: le regole di buona scrittura (movimento per grado, salti compensati, note estranee che risolvono,
// apice dopo la metà, tema che torna senza diventare un ciclo)
function revisiona(c, precedenti = []) {
  const battute = c.score.sezioni.flatMap((s) => s.battute);
  const piene = battute.filter((b) => b.ins && b.ins.some((x) => x.midi !== null));
  const note = [];
  let accordoOra = null;
  for (const b of battute) {
    let pos = 0;
    for (const e of b.ins || []) {
      const cambio = [...(b.accordi || [])].reverse().find((a) => a.pos <= pos);
      if (cambio) accordoOra = Abc.noteAccordo(cambio.sigla).note;
      if (e.midi !== null) note.push({ midi: e.midi, forte: pos % 16 === 0, dentro: accordoOra.includes(e.midi % 12) });
      pos += e.durata;
    }
    if (!b.ins) accordoOra = Abc.noteAccordo(b.accordi[0].sigla).note;
  }
  const salti = note.slice(1).map((x, i) => x.midi - note[i].midi);
  const mossi = salti.filter((x) => x !== 0);
  const quota = (v, test) => v.filter(test).length / (v.length || 1);
  const entro = (x, da, a, caduta) => Math.max(0, 1 - Math.max(da - x, x - a, 0) / caduta);
  const grado = entro(quota(mossi, (x) => Math.abs(x) <= 2), 0.55, 0.8, 0.25);
  const larghi = Math.max(0, 1 - quota(salti, (x) => Math.abs(x) > 9) * 25);
  const compensati = salti.slice(0, -1).map((x, i) => [x, salti[i + 1]]).filter(([x]) => Math.abs(x) >= 5);
  const recupero = compensati.length ? quota(compensati, ([x, y]) => y * x <= 0 || Math.abs(y) <= 2) : 1;
  const forti = note.filter((x) => x.forte);
  const accordo = entro(quota(forti, (x) => x.dentro), 0.7, 0.95, 0.25);
  const estranee = note.map((x, i) => [x, note[i + 1]]).filter(([x, y]) => x.forte && !x.dentro && y);
  const risolte = estranee.length ? quota(estranee, ([x, y]) => Math.abs(y.midi - x.midi) <= 2) : 1;
  const picco = Math.max(...note.map((x) => x.midi));
  const apice = entro(note.findIndex((x) => x.midi === picco) / (note.length || 1), 0.5, 0.9, 0.4);
  const diverse = new Set(piene.map((b) => JSON.stringify(b.ins))).size / (piene.length || 1);
  const varieta = entro(diverse, 0.55, 0.8, 0.3);
  const ritorno = Math.min(1, piene.filter((b) => c.ritornello.has(b.ins.map((x) => (x.midi === null ? -x.durata : x.durata)).join())).length / (piene.length || 1) / 0.12);
  const novita = 1 - Math.max(0, ...precedenti.map((x) => somiglianza(c.firma, x)));
  const qualita = grado * 20 + larghi * 5 + recupero * 15 + accordo * 15 + risolte * 15 + apice * 10 + varieta * 10 + ritorno * 10;
  const dettagli = Object.fromEntries(Object.entries({ grado, larghi, recupero, accordo, risolte, apice, varieta, ritorno, novita }).map(([k, v]) => [k, +v.toFixed(2)]));
  return { punteggio: Math.round((qualita * 0.85 + novita * 15) * 10) / 10, dettagli };
}

// Stessa interfaccia di Compositore.componi, con in più cameo e trovate
function componi({ candidati = 30, seed = 1, precedenti = [], preferenze: pref = {}, identita, materiale, formaForzata, cameoForzato, ...richiesta }) {
  const mat = materiale || diSerie();
  const pieno = richiesta.estro === undefined || richiesta.estro >= 2;
  const stile = profilo(richiesta.cat, tonica(richiesta.tonalita)).stile;
  // forma e richiamo si decidono prima, escludendo quelli appena usati: altrimenti il revisore premia sempre gli stessi
  const r = casuale(seed);
  const fresco = (voci, campo, quanti) => {
    const recenti = precedenti.slice(-quanti).map((x) => x[campo]);
    const libere = voci.filter((v) => !recenti.includes(v));
    return libere.length ? libere : voci;
  };
  const forme = mat.formePerStile[stile];
  const nomeForma = richiesta.sezioni ? 'scelta' : formaForzata || pesato(r, fresco(forme, 'forma', 1), (x) => peso(pref, `forma:${x}`));
  const suoi = mat.cameiPerStile[stile] || [];
  const idCameo = cameoForzato || (r() < (pieno ? 0.35 : 0.15) && suoi.length ? pesato(r, fresco(suoi, 'cameo', 4), (x) => peso(pref, `cameo:${x}`)) : null);
  const gia = new Set(precedenti.map((x) => x.mosse));
  let migliore = null;
  for (let i = 0; i < candidati || (!migliore && i < candidati + 200); i++) {
    const c = candidato(casuale(seed + (i + 1) * 7919), richiesta, { nomeForma, idCameo, mat });
    if (gia.has(c.firma.mosse)) continue;
    const voto = revisiona(c, precedenti);
    if (!migliore || voto.punteggio > migliore.punteggio) migliore = { ...c, ...voto };
  }
  if (!migliore) throw new Error('nessun tema nuovo disponibile');
  const { score, ritornello, ...resto } = migliore;
  return { ...resto, score, abc: Abc.scriviAbc(score), lyrics: Abc.lyricsDi(score), durata_s: Math.round(Abc.durataSecondi(score)) };
}

if (typeof module !== 'undefined') module.exports = { componi, revisiona, stileDi, FEEL, get CAMEI() { return diSerie().camei; } };
