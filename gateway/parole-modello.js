// Modello dei testi cantati, usato sia dalla pagina Testi sia dal gateway: sezioni, sillabe, rime, durata, controlli.
// Sillabe e rime sono stime utili a scrivere, non regole del motore.
(function (radice, fabbrica) {
  if (typeof module !== 'undefined' && module.exports) module.exports = fabbrica();
  else radice.ModelloParole = fabbrica();
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  const TIPI = { intro: 'Intro', verse: 'Strofa', 'pre-chorus': 'Pre-ritornello', chorus: 'Ritornello', bridge: 'Ponte', outro: 'Finale' };
  const SINONIMI = { strofa: 'verse', ritornello: 'chorus', 'pre-ritornello': 'pre-chorus', preritornello: 'pre-chorus', ponte: 'bridge', finale: 'outro', introduzione: 'intro', refrain: 'chorus', hook: 'chorus' };

  const righeDi = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((r) => String(r).trim()).filter(Boolean);
  const pulisciSezioni = (sezioni) => (Array.isArray(sezioni) ? sezioni : []).filter((s) => s && Object.hasOwn(TIPI, s.tipo)).map((s) => ({ tipo: s.tipo, righe: righeDi(s.righe) }));

  // Il campo "lyrics" del motore: etichetta di sezione e sole parole cantate, sezioni separate da una riga vuota
  const lyricsDi = (sezioni) => pulisciSezioni(sezioni).map((s) => [`[${s.tipo}]`, ...s.righe].join('\n')).join('\n\n');

  // Testo incollato -> sezioni. Riconosce [verse], [Ritornello] e simili; senza etichette ogni blocco e' una strofa
  function daTesto(testo) {
    const out = [];
    let corrente = null;
    for (const grezza of String(testo || '').replace(/\r/g, '').split('\n')) {
      const riga = grezza.trim();
      const m = /^\[\s*([^\]]+?)\s*\]$/.exec(riga);
      if (m) {
        const nome = m[1].toLowerCase().replace(/\s*\d+$/, '');
        corrente = { tipo: Object.hasOwn(TIPI, nome) ? nome : SINONIMI[nome] || 'verse', righe: [] };
        out.push(corrente);
      } else if (!riga) {
        if (corrente && corrente.righe.length) corrente = null;
      } else {
        if (!corrente) { corrente = { tipo: 'verse', righe: [] }; out.push(corrente); }
        corrente.righe.push(riga);
      }
    }
    return out;
  }

  const parole = (riga) => (String(riga || '').toLowerCase().match(/\p{L}+(?:['’]\p{L}+)*/gu) || []);
  function sillabeParola(p, lingua) {
    if (lingua === 'en') {
      const w = p.replace(/['’]/g, '').replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, (x) => (x.endsWith('ed') && /[td]ed$/.test(x) ? x : x[0])).replace(/^y/, '');
      return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length);
    }
    // lingue a vocali "piene": un gruppo di vocali e' una sillaba, due vocali forti di seguito ne fanno due (po-e-ta)
    const gruppi = p.normalize('NFC').match(/[aeiouàèéìíòóùúáâêôûäöüëïñ]+/g) || [];
    const forti = /[aeoàèéòóáâêôäö]/;
    let n = 0;
    for (const g of gruppi) { n++; for (let i = 1; i < g.length; i++) if ((forti.test(g[i - 1]) && forti.test(g[i])) || /[ìí]|ú/.test(g[i])) n++; }
    return Math.max(1, n);
  }
  const sillabe = (riga, lingua = 'it') => parole(riga).reduce((a, p) => a + sillabeParola(p, lingua), 0);

  // La coda di un verso, per riconoscere le rime: dall'ultima (o penultima) vocale in poi
  function coda(riga, lingua = 'it') {
    const p = parole(riga).pop();
    if (!p) return '';
    if (lingua === 'en') { const m = /[aeiouy]+[^aeiouy]*(?:e)?$/.exec(p.replace(/['’]/g, '')); return m ? m[0] : p.slice(-3); }
    const piano = p.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/[àèéìíòóùú]$/.test(p)) return piano.slice(-1) + '*'; // parola tronca: conta l'ultima vocale
    const m = /[aeiou][^aeiou]*[aeiou]+$/.exec(piano);
    return m ? m[0] : piano.slice(-3);
  }
  // Schema delle rime di una sezione: A A B B; '-' se il verso non rima con altri
  function schemaRime(righe, lingua) {
    const code = righe.map((r) => coda(r, lingua));
    const lettere = {};
    let prossima = 65;
    return code.map((c) => {
      if (!c || code.filter((x) => x === c).length < 2) return '-';
      return (lettere[c] ||= String.fromCharCode(prossima++));
    });
  }

  // Durata stimata: due battute di 4/4 a verso, quattro per una sezione senza parole
  function durata(sezioni, bpm) {
    const battute = pulisciSezioni(sezioni).reduce((a, s) => a + (s.righe.length ? s.righe.length * 2 : 4), 0);
    return Math.round(Math.min(360, Math.max(60, battute * 240 / (Number(bpm) || 90))));
  }

  // grave: impedisce l'approvazione; gli altri sono consigli
  function controlli(sezioni, { lingua = 'it', bpm } = {}) {
    const s = pulisciSezioni(sezioni);
    const righe = s.flatMap((x) => x.righe);
    const out = [];
    const voce = (ok, testo, grave = false) => out.push({ ok, testo, grave });
    voce(righe.length >= 4, 'Almeno quattro versi in tutto', true);
    voce(!righe.some((r) => /[[\]<>{}]/.test(r)), 'Solo parole cantate: niente parentesi quadre o indicazioni nei versi', true);
    voce(righe.length <= 80 && !righe.some((r) => r.length > 120), 'Al massimo 80 versi di 120 caratteri', true);
    voce(s.some((x) => x.tipo === 'chorus' && x.righe.length), 'C’è un ritornello');
    const ritornelli = s.filter((x) => x.tipo === 'chorus').map((x) => x.righe.join('\n'));
    voce(ritornelli.every((r) => r === ritornelli[0]), 'I ritornelli sono scritti uguali e per intero');
    const strane = s.filter((x) => x.righe.length === 1 || x.righe.length > 8).length;
    voce(!strane, 'Da due a otto versi per sezione (meglio da quattro a sei)');
    const lunghi = righe.filter((r) => sillabe(r, lingua) > 14).length;
    voce(!lunghi, lunghi ? `${lunghi} versi oltre le 14 sillabe: si cantano a fatica` : 'Versi cantabili (fino a 14 sillabe)');
    const storte = s.filter((x) => { const n = x.righe.map((r) => sillabe(r, lingua)); return n.length > 1 && Math.max(...n) - Math.min(...n) > 5; }).length;
    voce(!storte, storte ? `${storte} sezioni con versi di lunghezza molto diversa` : 'Versi di lunghezza simile dentro ogni sezione');
    if (bpm) { const d = durata(s, bpm); voce(d >= 90 && d <= 270, `Durata stimata ${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')} (meglio tra 1:30 e 4:30)`); }
    return out;
  }

  return { TIPI, pulisciSezioni, lyricsDi, daTesto, sillabe, coda, schemaRime, durata, controlli };
});
