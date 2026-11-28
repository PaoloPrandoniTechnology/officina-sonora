// Logica della coda di ascolto, senza pagina e senza audio: la usano il lettore (nel browser) e i test.
// Due elenchi, come nei lettori musicali: l'elenco di partenza (libreria, playlist...) e i brani messi
// «in coda» a mano, che passano davanti. I brani sono identificati dal numero di traccia.
(function (radice) {
  'use strict';

  const mescola = (a, caso) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(caso() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };

  // lista: elenco di partenza; ordine: come lo si sta suonando; i: ultimo brano suonato di «ordine»;
  // prossimi: coda a mano; daCoda: il brano corrente viene dalla coda a mano
  const nuova = () => ({ lista: [], ordine: [], i: -1, prossimi: [], corrente: null, daCoda: false, casuale: false, ripeti: 'no', contesto: null });

  const disponi = (s, base, caso) => {
    s.ordine = s.casuale ? (base === null ? mescola(s.lista, caso) : [base, ...mescola(s.lista.filter((x) => x !== base), caso)]) : s.lista.slice();
    s.i = base === null ? -1 : s.ordine.indexOf(base);
  };

  // Parte un nuovo elenco; la coda a mano resta. Senza numero parte il primo (o uno a caso)
  function avvia(s, lista, numero, contesto, caso = Math.random) {
    s.lista = [...new Set(lista)];
    if (numero === null || numero === undefined) numero = s.lista[s.casuale ? Math.floor(caso() * s.lista.length) : 0] ?? null;
    else if (!s.lista.includes(numero)) s.lista.unshift(numero);
    s.contesto = contesto || null;
    disponi(s, numero, caso);
    s.corrente = numero;
    s.daCoda = false;
    return numero;
  }

  function casuale(s, si, caso = Math.random) {
    s.casuale = !!si;
    disponi(s, s.ordine[s.i] ?? null, caso);
  }

  // Passa al brano seguente. auto: il brano è finito da sé (vale «ripeti uno»)
  function avanti(s, auto, caso = Math.random) {
    if (auto && s.ripeti === 'uno' && s.corrente !== null) return s.corrente;
    if (s.prossimi.length) { s.daCoda = true; s.corrente = s.prossimi.shift(); return s.corrente; }
    if (s.i + 1 < s.ordine.length) s.i++;
    else if (s.ripeti !== 'no' && s.ordine.length) {
      if (s.casuale) {
        s.ordine = mescola(s.lista, caso);
        if (s.ordine.length > 1 && s.ordine[0] === s.corrente) s.ordine.push(s.ordine.shift()); // niente doppione al giro
      }
      s.i = 0;
    } else return null;
    s.daCoda = false;
    s.corrente = s.ordine[s.i];
    return s.corrente;
  }

  function indietro(s) {
    if (s.daCoda) {
      if (s.i < 0) return null;
      s.prossimi.unshift(s.corrente); // «avanti» lo ritrova
    } else if (s.i > 0) s.i--;
    else if (s.ripeti !== 'no' && s.ordine.length) s.i = s.ordine.length - 1;
    else return null;
    s.daCoda = false;
    s.corrente = s.ordine[s.i];
    return s.corrente;
  }

  const puoAvanti = (s) => s.prossimi.length > 0 || s.i + 1 < s.ordine.length || (s.ripeti !== 'no' && s.ordine.length > 0);

  // subito: «riproduci dopo»; altrimenti in fondo alla coda a mano
  function accoda(s, numeri, subito) { if (subito) s.prossimi.unshift(...numeri); else s.prossimi.push(...numeri); }

  // Elenchi mostrati nel pannello: «coda» (a mano) e «dopo» (resto dell'elenco di partenza)
  const dopo = (s) => s.ordine.slice(s.i + 1);
  function cambiaDopo(s, resto) {
    const via = new Set(dopo(s).filter((x) => !resto.includes(x)));
    s.ordine = s.ordine.slice(0, s.i + 1).concat(resto);
    s.lista = s.casuale ? s.lista.filter((x) => !via.has(x)) : s.ordine.slice();
  }
  function modifica(s, dove, fn) {
    const a = dove === 'coda' ? s.prossimi.slice() : dopo(s);
    fn(a);
    if (dove === 'coda') s.prossimi = a; else cambiaDopo(s, a);
  }
  const togli = (s, dove, k) => modifica(s, dove, (a) => a.splice(k, 1));
  const sposta = (s, dove, da, a) => modifica(s, dove, (x) => { if (da >= 0 && da < x.length && a >= 0 && a < x.length) x.splice(a, 0, ...x.splice(da, 1)); });

  // Clic su un brano del pannello: si passa subito a quello
  function salta(s, dove, k) {
    if (dove === 'coda') {
      if (k >= s.prossimi.length) return null;
      s.daCoda = true;
      s.corrente = s.prossimi.splice(0, k + 1).pop();
    } else {
      if (s.i + 1 + k >= s.ordine.length) return null;
      s.i += 1 + k;
      s.daCoda = false;
      s.corrente = s.ordine[s.i];
    }
    return s.corrente;
  }

  // Toglie i brani che non esistono più (scartati o cancellati); il brano corrente resta finché suona
  function pulisci(s, esiste) {
    const base = s.ordine.slice(0, s.i + 1).filter(esiste).length - 1;
    s.ordine = s.ordine.filter(esiste);
    s.lista = s.lista.filter(esiste);
    s.prossimi = s.prossimi.filter(esiste);
    s.i = base;
  }

  // Stato salvato nel browser: si accetta solo se ha la forma attesa
  function ripristina(salvato) {
    const s = nuova(), numeri = (v) => Array.isArray(v) && v.every(Number.isInteger);
    if (!salvato || !numeri(salvato.lista) || !numeri(salvato.ordine) || !numeri(salvato.prossimi)) return s;
    for (const k of Object.keys(s)) if (salvato[k] !== undefined) s[k] = salvato[k];
    if (!Number.isInteger(s.i) || s.i >= s.ordine.length) s.i = s.ordine.length - 1;
    if (!['no', 'tutti', 'uno'].includes(s.ripeti)) s.ripeti = 'no';
    if (!Number.isInteger(s.corrente)) s.corrente = null;
    return s;
  }

  const Coda = { nuova, avvia, casuale, avanti, indietro, puoAvanti, accoda, dopo, togli, sposta, salta, pulisci, ripristina };
  if (typeof module !== 'undefined' && module.exports) module.exports = Coda; else radice.Coda = Coda;
})(this);
