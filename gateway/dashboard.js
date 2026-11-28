(() => {
  'use strict';

  // ---------- utilità ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT');
  const n1 = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 1 });
  const sec = (s) => {
    if (s === null || s === undefined || Number.isNaN(s)) return '—';
    if (s < 60) return Math.round(s) + ' s';
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return m + ' min ' + String(r).padStart(2, '0') + ' s';
  };
  const data = (iso) => iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const ago = (s) => {
    if (s === null || s === undefined) return '—';
    if (s < 90) return s + ' s fa';
    if (s < 5400) return Math.round(s / 60) + ' min fa';
    return Math.round(s / 3600) + ' h fa';
  };
  const pct = (v, max) => max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  const ic = (nome) => `<svg class="ic" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

  // Riscrive un elemento solo se il contenuto cambia: gli aggiornamenti periodici non chiudono menu,
  // non perdono il fuoco e non fanno sfarfallare le copertine
  function imposta(el, html) {
    if (typeof el === 'string') el = $(el);
    if (!el || el.dataset.firma === firma(html)) return false;
    el.dataset.firma = firma(html);
    el.innerHTML = html;
    return true;
  }
  function firma(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; }

  // nome leggibile di un genere
  function nm(nome) {
    const g = ((dati && dati.generi) || []).find((x) => x.nome === nome) || ((ctrl && ctrl.generi) || []).find((x) => x.nome === nome);
    return g ? (g.etichetta || g.genere || nome) : (nome || '');
  }
  const tinte = (categoria) => {
    const g = ((dati && dati.generi) || []).find((x) => x.nome === categoria);
    return ((g && g.colori) || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  };
  // copertina del brano; mentre manca restano i colori del genere
  function copertina(t, classe = '') {
    const [c1, c2] = tinte(t.categoria);
    const img = t.numero === null || t.numero === undefined ? '' : `<img src="/api/copertina?n=${encodeURIComponent(t.numero)}" alt="" loading="lazy">`;
    return `<span class="cop ${classe}"${c1 ? ` style="--c1:${c1};--c2:${c2 || c1}"` : ''}>${img}</span>`;
  }
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG' && e.target.closest('.cop')) e.target.remove(); }, true);
  const tastoAscolta = (t, classe = '') => (t.numero === null || t.numero === undefined ? copertina(t, classe)
    : `<button type="button" class="cop-tasto" data-ascolta="${t.numero}" aria-label="Ascolta ${esc(t.titolo)}">${copertina(t, classe)}${ic('play')}</button>`);
  const titoloBrano = (t, classe = 'titolo-brano') => (t.numero === null || t.numero === undefined ? `<span>${esc(t.titolo)}</span>`
    : `<button type="button" class="${classe}" data-info="${t.numero}">${esc(t.titolo)}</button>`);

  // grafico a barre verticali (SVG, con tooltip)
  function barre(valori, opzioni = {}) {
    const { h = 200, colore: c = 'var(--s1)', etichetta = (x) => x.etichetta, valore = (x) => x.valore, titolo = (x) => x.etichetta + ': ' + x.valore } = opzioni;
    if (!valori.length) return '<div class="empty">Nessun dato</div>';
    const w = 640, pad = { l: 32, r: 8, t: 10, b: 24 };
    const max = Math.ceil(Math.max(...valori.map(valore), 1) / 4) * 4;
    const bw = (w - pad.l - pad.r) / valori.length;
    const ch = h - pad.t - pad.b;
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch * (1 - i / 4);
      g += `<line class="gridline" x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}"/><text class="axis" x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${max * i / 4}</text>`;
    }
    const colonne = valori.map((x, i) => {
      const v = valore(x), bh = v ? Math.max((v / max) * ch, 2) : 0, ww = Math.min(bw * 0.7, 48), xx = pad.l + i * bw + (bw - ww) / 2, base = pad.t + ch, r = Math.min(4, bh, ww / 2);
      // angoli arrotondati solo in cima: la barra poggia sulla linea di base
      const d = bh ? `M${xx} ${base}v${-(bh - r)}q0 ${-r} ${r} ${-r}h${ww - 2 * r}q${r} 0 ${r} ${r}v${bh - r}z` : '';
      return `<g><title>${esc(titolo(x))}</title><rect x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ch}" fill="transparent"/><path class="bar" d="${d}" fill="${c}"/><text class="axis" x="${xx + ww / 2}" y="${h - 7}" text-anchor="middle">${esc(etichetta(x))}</text></g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${g}${colonne}</svg>`;
  }

  // barre orizzontali
  function barreOrizz(voci, opz = {}) {
    if (!voci.length) return `<div class="empty">${esc(opz.vuoto || 'Nessun dato')}</div>`;
    const max = opz.max || Math.max(...voci.map((v) => v.valore), 1);
    return voci.map((v) => `<div class="hb"><span title="${esc(v.nome)}">${esc(v.nome)}</span>
      <div class="tr"><div class="fi" style="--w:${pct(v.valore, max).toFixed(1)}%"></div></div>
      <em>${opz.decimali ? n1(v.valore) : n0(v.valore)}</em></div>`).join('');
  }

  function stelle(v) {
    if (v === null || v === undefined) return '<span class="muted">non votato</span>';
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= Math.round(v) ? '★' : '<span class="off">★</span>';
    return `<span class="stars" role="img" aria-label="${n1(v)} su 5">${s}</span>`;
  }

  function servizioRiga(nome, attivo, on = 'attivo', off = 'non risponde', fermo = 'ko', spiegazione = '') {
    const c = attivo ? 'ok' : fermo;
    return `<div class="srv"${spiegazione ? ` data-tip="${esc(spiegazione)}"` : ''}><span><i class="dot ${c === 'w' ? 'warn' : c}"></i>${esc(nome)}</span><span class="pill ${c}">${attivo ? on : off}</span></div>`;
  }

  // ---------- stato in tempo reale (ogni 5 s) ----------
  let statoUltimo = null;
  const FASI = [['Idea', 'titolo e ricetta'], ['Spartito', 'melodia e accordi'], ['Audio', 'creazione del suono'], ['Controllo', 'durata e volume'], ['Pubblicazione', 'iBroadcast']];

  // problemi dei programmi: elenco vuoto = tutto a posto
  function guasti(s) {
    const out = [];
    if (!s.servizi.n8n) out.push('n8n non risponde');
    if (!s.servizi.motoreYue) out.push('il motore musicale non risponde');
    if (!s.servizi.lmStudio) out.push('LM Studio è spento');
    if (s.watchdog.battito_s === null || s.watchdog.battito_s > 600) out.push('il watchdog è fermo');
    return out;
  }
  const inPausa = (s) => !!(s.comandi && s.comandi.pausa);

  function disegnaLinea() {
    const s = statoUltimo;
    if (!s) return;
    const r = s.render, pausa = inPausa(s);
    const prossimo = (s.pipeline.prossimi || [])[0];
    let fase = 0, titolo, sotto, quota = null;
    if (r) {
      fase = r.fase === 'spartito' ? 1 : ['done', 'succeeded', 'ok'].includes(r.statoMotore) ? 3 : 2;
      titolo = r.titolo || 'Brano senza titolo';
      sotto = [nm(r.categoria) || r.genere, r.durataRichiesta_s ? 'circa ' + sec(r.durataRichiesta_s) : ''].filter(Boolean).join(', ');
      if (fase === 2 && r.renderMedio_s) quota = Math.max(4, Math.min(96, Math.round(r.trascorsi_s / r.renderMedio_s * 100)));
    } else if (pausa) {
      titolo = 'Produzione in pausa';
      sotto = 'Non partono brani nuovi finché non la riprendi.';
    } else if (prossimo) {
      fase = 1;
      titolo = prossimo.titolo;
      sotto = nm(prossimo.categoria) + ', in attesa di partire';
    } else {
      titolo = s.pipeline.occupata ? 'Preparo il prossimo brano' : 'In attesa del prossimo giro';
      sotto = 'Il sistema controlla ogni minuto.';
    }
    const fermo = guasti(s).length > 0;
    const passi = FASI.map(([nome, che], i) => {
      const classe = i < fase ? 'fatta' : i === fase ? `ora${r ? ' viva' : ''}${!r && pausa ? ' ferma' : ''}` : '';
      return `<li class="${classe}"${i === fase ? ` aria-current="step"${quota ? ` style="--q:${quota}%"` : ''}` : ''}><span>${nome}</span><small>${che}</small></li>`;
    }).join('');
    imposta('#linea', `<div class="linea-testa"><div><h2>${esc(titolo)}</h2><p>${esc(sotto)}</p></div>
      ${r ? `<div class="linea-tempo"><b>${sec(r.trascorsi_s)}</b><span>${r.renderMedio_s ? 'di solito circa ' + sec(r.renderMedio_s) : 'trascorsi'}</span></div>` : ''}</div>
      <ol class="fasi" aria-label="Fasi del brano">${passi}</ol>`);
    if (fermo) $('#linea').setAttribute('data-fermo', ''); else $('#linea').removeAttribute('data-fermo');
  }

  // Cose che chiedono un intervento, o che è utile sapere. Ogni riga dice cosa fare.
  function disegnaAvvisi() {
    const s = statoUltimo;
    if (!s) return;
    const righe = [];
    const riga = (tipo, testo, azione = '') => righe.push(`<div class="avviso-riga ${tipo}"><span>${esc(testo)}</span>${azione}</div>`);
    const vai_ = (dove, testo) => `<button class="btn small ghost" data-vai="${dove}">${testo}</button>`;
    for (const g of guasti(s)) riga('grave', g.charAt(0).toUpperCase() + g.slice(1) + ': di solito si riavvia da sé entro pochi minuti.', vai_('log', 'Apri il log'));
    if (inPausa(s)) riga('', 'La produzione è in pausa.', '<button class="btn small" data-riprendi>Riprendi la produzione</button>');
    const disco = s.sistema.disco_E_liberoGb;
    if (disco !== null && disco < 20) riga(disco < 5 ? 'grave' : '', `Sul disco E: restano ${disco} GB. Libera spazio o i brani non verranno salvati.`);
    if (s.pipeline.daCaricare > 2) riga('', `${s.pipeline.daCaricare} brani aspettano di essere caricati su iBroadcast.`, vai_('log', 'Apri il log'));
    const persi = (s.pipeline.abbandonati || []).filter((f) => Date.now() - Date.parse(f.at) < 86400000);
    if (persi.length) riga('', `Abbandonato nelle ultime 24 ore: «${persi[0].titolo}» (${persi[0].motivo})${persi.length > 1 ? ` e altri ${persi.length - 1}` : ''}.`, vai_('log', 'Apri il log'));
    if (dati) {
      const L = dati.libreria;
      const ultimoVoto = L.recenti.reduce((m, t) => (t.voto_il && t.voto_il > m ? t.voto_il : m), '');
      if (L.totale >= 10 && (!ultimoVoto || Date.now() - Date.parse(ultimoVoto) > 3 * 86400000)) {
        riga('nota', ultimoVoto ? 'Non voti un brano da più di tre giorni: il sistema impara dai tuoi voti.' : 'Nessun voto ancora: il sistema impara dai tuoi voti.', vai_('voti', 'Vota ora'));
      }
      if (dati.generi.length && !dati.generi.some((g) => g.attivo)) riga('', 'Tutti i generi sono sospesi: la produzione li usa lo stesso. Attivane qualcuno.', vai_('generi', 'Apri i generi'));
    }
    $('#avvisi').hidden = !righe.length;
    imposta('#avvisi', righe.join(''));
  }

  function disegnaCodaProduzione() {
    const s = statoUltimo;
    if (!s) return;
    const prossimi = s.pipeline.prossimi || [];
    const righe = prossimi.map((c) => `<div class="brano-riga">${copertina({ categoria: c.categoria })}<div>${esc(c.titolo)}<small>${esc(nm(c.categoria))}${c.durata_s ? ', ' + sec(c.durata_s) : ''}</small></div></div>`).join('');
    const richiesto = s.comandi && s.comandi.produciGenere;
    imposta('#coda', (richiesto ? `<div class="srv"><span>Richiesto: ${esc(nm(richiesto))}</span><span class="pill w">prossimo</span></div>` : '')
      + (righe || (richiesto ? '' : '<div class="empty">Nessun brano in attesa: il sistema ne inventa uno quando finisce quello in corso.</div>'))
      + `<p><button class="link" data-vai="generi">Scegli il genere del prossimo brano</button></p>`);
  }

  function disegnaStato(s) {
    statoUltimo = s;
    const g = guasti(s), pausa = inPausa(s);
    $('#sisDot').className = 'dot ' + (g.length ? 'ko' : 'ok');
    $('#sisTesto').textContent = g.length ? (g.length === 1 ? '1 problema' : g.length + ' problemi') : 'Servizi a posto';
    $('#cAgg').textContent = 'Controllati alle ' + new Date(s.ora).toLocaleTimeString('it-IT');
    $('#prodDot').className = 'dot ' + (pausa ? 'warn' : g.length ? 'ko' : 'ok');
    $('#prodTesto').textContent = pausa ? 'In pausa' : g.length ? 'Ferma' : 'In produzione';
    const b = $('#bProd');
    b.disabled = false;
    b.textContent = pausa ? 'Riprendi' : 'Metti in pausa';
    b.className = 'btn small' + (pausa ? '' : ' ghost');

    const servizi = servizioRiga('n8n (regia)', s.servizi.n8n) + servizioRiga('Motore musicale YuE2', s.servizi.motoreYue)
      + servizioRiga('LM Studio', s.servizi.lmStudio, 'attivo', 'spento') + servizioRiga('Modello di testo gemma', s.servizi.gemmaCaricato, 'caricato', 'a riposo', 'w', 'Durante la creazione di un brano gemma viene tolta dalla scheda video: è normale.');
    imposta('#servizi', servizi);
    imposta('#servizi2', servizi);

    imposta('#sorv', `<div class="kv"><span>Battito watchdog</span><span>${ago(s.watchdog.battito_s)}</span>
      <span data-tip="Il supervisore controlla ogni 5 minuti e scrive solo quando deve riavviare qualcosa.">Ultimo intervento del supervisore</span><span>${ago(s.supervisore.ultimoRun_s)}</span>
      <span>Brani in coda</span><span>${n0(s.pipeline.coda)}</span><span>Da caricare</span><span>${n0(s.pipeline.daCaricare)}</span><span>Brani generati</span><span>${n0(s.pipeline.brani)}</span>
      <span>Scartati dal controllo</span><span>${n0(s.pipeline.scartati)}</span>
      <span>Disco E: libero</span><span>${s.sistema.disco_E_liberoGb === null ? '—' : n0(s.sistema.disco_E_liberoGb) + ' GB'}</span></div>`);

    imposta('#esec', (s.esecuzioni || []).map((e) => `<div class="srv"><span>${esc(e.startedAt ? data(/Z|\+\d\d/.test(e.startedAt) ? e.startedAt : e.startedAt.replace(' ', 'T') + 'Z') : 'in avvio')}</span><span class="pill ${e.status === 'success' ? 'ok' : e.status === 'running' ? 'w' : 'ko'}">${esc({ success: 'riuscita', error: 'errore', running: 'in corso', crashed: 'interrotta', waiting: 'in attesa', canceled: 'annullata' }[e.status] || e.status)}</span></div>`).join('') || '<div class="empty">Nessun dato</div>');

    disegnaLinea();
    disegnaAvvisi();
    disegnaCodaProduzione();
    disegnaLog();
  }

  // ---------- log: filtri, ricerca, orario locale ----------
  const vistaLog = { tipo: 'tutto', q: '' };
  const classeLog = (l) => (/errore|fallit|non riuscit|scartat/i.test(l) ? 'e' : /salvato|caricat|applicati|inviat|\bok\b/i.test(l) ? 'o' : /attenzione|troppo|rigener|occupat|non usato|riprovo/i.test(l) ? 'w' : '');
  const rigaLocale = (l) => {
    const m = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/.exec(l);
    return m ? new Date(m[1]).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '  ' + m[2] : l;
  };
  const righeLog = () => ((statoUltimo && statoUltimo.logProduzione) || []).filter((l) => (vistaLog.tipo === 'tutto' || classeLog(l) === vistaLog.tipo) && l.toLowerCase().includes(vistaLog.q.toLowerCase()));
  function disegnaLog() {
    const box = $('#logBox');
    if (window.getSelection && box.contains(window.getSelection().anchorNode) && String(window.getSelection())) return; // non cancellare una selezione
    const inFondo = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    const prima = box.scrollTop;
    const righe = righeLog();
    box.innerHTML = righe.map((l) => `<div class="${classeLog(l)}">${esc(rigaLocale(l))}</div>`).join('') || '<div>Nessuna riga corrisponde.</div>';
    box.scrollTop = inFondo ? box.scrollHeight : prima;
    $('#logConta').textContent = righe.length + ' righe';
  }

  // ---------- analisi (ogni 30 s) ----------
  let dati = null;
  let filtro = { q: '', famiglia: 'tutte' };

  function disegnaDati(d) {
    dati = d;
    const L = d.libreria, V = d.voti, Q = d.qualita, R = d.render;
    $('#sotto').textContent = `${n0(L.totale)} brani, ${n0(d.generi.length)} generi. Dati delle ${new Date(d.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

    $('#k-tot').textContent = n0(L.totale);
    $('#k-ore').textContent = n1(L.durataTot_h);
    $('#k-voti').textContent = n0(V.totale);
    $('#k-media').textContent = V.mediaGlobale === null ? '—' : n1(V.mediaGlobale);

    // i giorni iniziali senza brani non si mostrano (resta almeno una settimana)
    const primo = L.timeline.findIndex((x) => x.brani > 0);
    const giorni = L.timeline.slice(Math.max(0, Math.min(primo < 0 ? 0 : primo, L.timeline.length - 7)));
    $('#tl-tot').textContent = n0(giorni.reduce((a, x) => a + x.brani, 0)) + ' negli ultimi ' + giorni.length + ' giorni';
    imposta('#timeline', barre(giorni, {
      h: 200, etichetta: (x) => x.giorno.slice(8, 10) + '/' + x.giorno.slice(5, 7),
      valore: (x) => x.brani, titolo: (x) => x.giorno.slice(8, 10) + '/' + x.giorno.slice(5, 7) + ': ' + x.brani + ' brani',
    }));

    imposta('#donut', barreOrizz(Object.entries(L.perFamiglia).sort((a, b) => b[1] - a[1]).map(([nome, valore]) => ({ nome, valore }))));
    imposta('#ultimiBrani', L.recenti.slice(0, 8).map((t) => `<div class="disco">${tastoAscolta(t, 'grande')}${titoloBrano(t, 'nome')}<small>${esc(nm(t.categoria))}</small><small>${data(t.generato_il)}</small></div>`).join('') || '<div class="empty">Il primo brano arriva in circa dieci minuti.</div>');
    // stessa regola della pagina Voti: i brani degli ultimi 15 minuti sono ancora in lavorazione
    const daVotare = L.recenti.filter((t) => t.voto === null && t.numero !== null && Date.now() - Date.parse(t.generato_il) >= 15 * 60000).length;
    $('#navVoti').hidden = !daVotare;
    $('#navVoti').textContent = daVotare > 999 ? '999+' : daVotare;

    // Qualità e tempi
    const ult = R.ultimi || [];
    imposta('#rStats', `<div class="kv"><span>Medio</span><span>${sec(R.medio_s)}</span><span>Minimo</span><span>${sec(R.min_s)}</span>
      <span>Massimo</span><span>${sec(R.max_s)}</span><span>Caricati nelle ultime 24 h</span><span>${n0(R.caricati24h)}</span>
      <span>Rigenerazioni nel log</span><span>${n0(Q.rigenerazioni)}</span></div>`);
    imposta('#rChart', ult.length ? lineaRender(ult) : '<div class="empty">Nessun render registrato</div>');
    imposta('#tipi', barreOrizz(Object.entries(L.perTipo).sort((a, b) => b[1] - a[1]).map(([nome, valore]) => ({ nome, valore }))));
    imposta('#bpmChart', barre(L.bpmIstogramma, { h: 190, etichetta: (x) => x.da, valore: (x) => x.n, titolo: (x) => x.da + '–' + (x.da + 9) + ' bpm: ' + x.n }));
    imposta('#qRing', `<div class="grande-numero">${n1(Q.tassoScarto || 0)}%</div><p>dei brani creati non supera il controllo</p>
      <div class="kv"><span>Accettati</span><span>${n0(Q.accettati)}</span><span>Scartati</span><span>${n0(Q.scartati)}</span></div>`);
    imposta('#qMotivi', barreOrizz(Q.motivi.map((m) => ({ nome: m.motivo.replace(/#/g, 'N'), valore: m.n })), { vuoto: 'Nessuno scarto registrato.' }));
    imposta('#qCat', barreOrizz(Q.perCategoria.map((c) => ({ nome: nm(c.categoria), valore: c.n })), { vuoto: 'Nessuno scarto.' }));
    $('#eTot').textContent = n0(d.errori.totale24h) + ' in tutto';
    imposta('#eTop', d.errori.top.map((e) => `<div class="srv"><span style="font-size:12.5px">${esc(e.errore)}</span><span class="pill n">${n0(e.n)}</span></div>`).join('') || '<div class="empty">Nessun errore.</div>');

    // Generi
    renderGeneri();
    if (vt.caricato) { disegnaCoda(); disegnaVotati(); }
    // i nomi leggibili possono arrivare dopo la prima lettura dell'andamento
    if (an.dati) { disegnaGeneriAn(); for (const x of $('#aGenere').options) if (x.value) x.textContent = nm(x.value); }

    // Voti
    imposta('#vDonut', V.totale ? barreOrizz([5, 4, 3, 2, 1].map((k) => ({ nome: '★'.repeat(k), valore: V.distribuzione[k] || 0 }))) : '<div class="empty">Nessun brano ancora votato.</div>');
    $('#vNota').textContent = V.totale ? V.totale + ' brani votati su ' + V.su : '';
    imposta('#vCat', barreOrizz(V.perCategoria.map((c) => ({ nome: nm(c.categoria), valore: c.media })), { max: 5, decimali: true, vuoto: 'Ancora nessun voto.' }));
    const perTitolo = new Map(L.recenti.map((t) => [t.titolo + '|' + t.categoria, t]));
    const brano = (x) => { const t = perTitolo.get(x.titolo + '|' + x.categoria) || x; return `<div class="brano-riga">${tastoAscolta(t)}<div>${titoloBrano(t)}<small>${esc(nm(x.categoria))}</small></div>${stelle(x.voto)}</div>`; };
    imposta('#vMiglio', V.migliori.map(brano).join('') || '<div class="empty">Nessun brano con voto alto.</div>');
    imposta('#vPeggio', V.peggiori.map(brano).join('') || '<div class="empty">Nessun brano con voto basso.</div>');

    // Libreria
    $('#lCar').textContent = `${n0(L.caricati)} di ${n0(L.totale)} brani su iBroadcast, ${n0(L.ascoltiTot)} ascolti`;
    disegnaLibreria();
    disegnaLinea();
    disegnaAvvisi();
    disegnaCodaProduzione();
  }

  const lib = { q: '', genere: '', ambito: '', voto: '', ordine: 'generato_il', verso: -1, quanti: 50 };
  const COL_LIB = [['titolo', 'Titolo'], ['categoria', 'Genere'], ['durata_s', 'Durata', 'num'], ['bpm', 'BPM', 'num extra'], ['voto', 'Voto'], ['ascolti', 'Ascolti', 'num extra'], ['generato_il', 'Creato', 'extra']];
  const durata = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : '—');
  function disegnaLibreria() {
    if (!dati) return;
    const tutti = dati.libreria.recenti;
    const generi = [...new Set(tutti.map((t) => t.categoria).filter(Boolean))].sort((a, b) => nm(a).localeCompare(nm(b)));
    imposta('#lGen', '<option value="">Tutti i generi</option>' + generi.map((g) => `<option value="${esc(g)}">${esc(nm(g))}</option>`).join(''));
    imposta('#lAmbitoF', '<option value="">Yoga e sottofondo</option>' + Object.keys(dati.libreria.perAmbito).sort().map((a) => `<option value="${esc(a)}">Solo ${esc(a)}</option>`).join(''));
    $('#lGen').value = lib.genere;
    $('#lAmbitoF').value = lib.ambito;
    const q = lib.q.trim().toLowerCase();
    const voti = { no: (v) => v === null, si: (v) => v !== null, alti: (v) => v >= 4, bassi: (v) => v !== null && v <= 2 };
    const lista = tutti.filter((t) => (!lib.genere || t.categoria === lib.genere) && (!lib.ambito || t.ambito === lib.ambito) && (!lib.voto || voti[lib.voto](t.voto))
      && (!q || [t.titolo, nm(t.categoria), t.categoria, t.tipo, t.famiglia].join(' ').toLowerCase().includes(q)));
    const chiave = (t) => (lib.ordine === 'categoria' ? nm(t.categoria) : t[lib.ordine]);
    lista.sort((a, b) => {
      const x = chiave(a), y = chiave(b);
      if (x === null || x === undefined || y === null || y === undefined) return (x === null || x === undefined) - (y === null || y === undefined);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * lib.verso;
    });
    $('#lConta').textContent = n0(lista.length) + ' di ' + n0(tutti.length) + ' brani';
    $('#lAltri').hidden = lista.length <= lib.quanti;
    imposta('#recenti', `<thead><tr><th><span class="muted">Ascolta</span></th>${COL_LIB.map(([c, nome, cl]) => `<th class="${cl || ''}"${lib.ordine === c ? ` aria-sort="${lib.verso > 0 ? 'ascending' : 'descending'}"` : ''}><button type="button" data-lord="${c}">${nome}${lib.ordine === c ? (lib.verso > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead><tbody>${
      lista.slice(0, lib.quanti).map((t) => `<tr><td>${tastoAscolta(t)}</td><td class="nome">${titoloBrano(t)}${t.caricato ? '' : '<small>non ancora su iBroadcast</small>'}</td><td>${esc(nm(t.categoria))}</td>
        <td class="num">${durata(t.durata_s)}</td><td class="num extra">${n0(t.bpm)}</td>
        <td>${t.numero === null ? stelle(t.voto) : `<button class="link" data-vota="${t.numero}" data-tip="Apre il brano nella pagina Voti">${t.voto === null ? 'Vota' : stelle(t.voto)}</button>`}</td>
        <td class="num extra">${n0(t.ascolti)}</td><td class="muted extra">${data(t.generato_il)}</td></tr>`).join('')
      || '<tr><td colspan="8" class="empty">Nessun brano corrisponde: togli un filtro o cambia la ricerca.</td></tr>'}</tbody>`);
  }

  function lineaRender(ult) {
    const w = 760, h = 230, pad = { l: 40, r: 14, t: 16, b: 28 };
    const max = Math.max(...ult.map((x) => Math.max(x.render, x.richiesti)), 1) * 1.08;
    const step = (w - pad.l - pad.r) / Math.max(1, ult.length - 1);
    const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
    const pts = ult.map((x, i) => [pad.l + i * step, y(x.render)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const ref = ult.map((x, i) => [pad.l + i * step, y(x.richiesti)]);
    const dRef = ref.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      g += `<line class="gridline" x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${pad.l - 8}" y="${yy + 3}" text-anchor="end">${Math.round(v)}s</text>`;
    }
    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="var(--s1)"><title>render ${ult[i].render}s · richiesti ${ult[i].richiesti}s</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${w} ${h}">
      ${g}
      <path d="${dRef}" fill="none" stroke="var(--s2)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div class="legenda-g"><span><i style="background:var(--s1)"></i>tempo di creazione</span><span><i style="background:var(--s2)"></i>durata richiesta</span></div>`;
  }

  // ---------- generi ----------
  function renderGeneri() {
    if (!dati) return;
    const famiglie = [...new Set(dati.generi.map((g) => g.famiglia).filter(Boolean))].sort();
    imposta('#gFam', '<option value="tutte">Tutte le famiglie</option>' + famiglie.map((f) => `<option>${esc(f)}</option>`).join(''));
    $('#gFam').value = filtro.famiglia;
    const q = filtro.q.trim().toLowerCase();
    const lista = dati.generi.filter((g) => {
      if (filtro.famiglia !== 'tutte' && g.famiglia !== filtro.famiglia) return false;
      if (!q) return true;
      return [g.nome, g.genere, g.stile, g.attivita, ...[].concat(g.strumenti || []), ...(g.varianti || []), ...(g.influenze || [])].join(' ').toLowerCase().includes(q);
    });
    const ordine = $('#gOrd').value;
    if (ordine === 'genere') lista.sort((a, b) => a.genere.localeCompare(b.genere));
    if (ordine === 'brani') lista.sort((a, b) => b.brani - a.brani);
    if (ordine === 'voto') lista.sort((a, b) => (b.votoMedio || 0) - (a.votoMedio || 0));
    $('#gConta').textContent = lista.length + ' di ' + dati.generi.length;
    // le schede aperte restano aperte dopo l'aggiornamento
    const aperte = new Set([...document.querySelectorAll('#gcards details[open]')].map((d) => d.dataset.g));
    const elenco = (v) => [].concat(v || []).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
    imposta('#gcards', lista.map((g) => {
      const tintaG = (g.colori || [])[1] || (g.colori || [])[0] || '';
      return `<article class="gc${g.attivo ? '' : ' sospeso'}"${/^#[0-9a-f]{6}$/i.test(tintaG) ? ` style="--tinta:${tintaG}"` : ''}>
        <h3><span>${esc(g.genere)}</span><label class="switch" data-tip="${g.attivo ? 'In produzione: clic per sospendere' : 'Sospeso: clic per produrlo di nuovo'}"><input type="checkbox" data-attiva="${esc(g.nome)}" aria-label="Produci ${esc(g.genere)}" ${g.attivo ? 'checked' : ''}><span></span></label></h3>
        <div class="gn">${esc([g.famiglia, g.ambito].filter(Boolean).join(', '))}${g.vocale ? ', voci senza parole' : ''}${g.attivo ? '' : ' (sospeso)'}</div>
        <div class="attivita">${esc(g.attivita)}</div>
        <div class="dati"><div><b>${g.bpm[0]}–${g.bpm[1]}</b><small>BPM</small></div><div><b>${n0(g.brani)}</b><small>brani</small></div><div><b>${g.votoMedio === null ? '—' : n1(g.votoMedio)}</b><small>voto medio</small></div></div>
        <div class="azioni"><button class="btn small" data-produci="${esc(g.nome)}" data-tip="Il prossimo brano sarà di questo genere">Produci ora</button><button class="btn small ghost" data-stile="${esc(g.nome)}">Modifica stile</button><button class="btn small ghost" data-brani="${esc(g.nome)}" ${g.brani ? '' : 'disabled'}>Ascolta i brani</button></div>
        <details data-g="${esc(g.nome)}"${aperte.has(g.nome) ? ' open' : ''}><summary>Specifiche complete</summary>
          <div class="det">
            <p><b>Stile</b><br>${esc(g.stile)}</p>
            <p><b>Strumenti</b><br>${elenco(g.strumenti)}</p>
            <p><b>Strutture</b><br>${elenco(g.strutture)}</p>
            <p><b>Varianti</b><br>${elenco(g.varianti)}</p>
            <p><b>Influenze</b><br>${elenco(g.influenze)}</p>
            <p><b>Tonalità</b><br>${elenco(g.tonalita)}</p>
            <p><b>Evitare</b><br>${elenco(g.vietati)}</p>
            <p><b>Brani</b>: ${n0(g.brani)}, caricati ${n0(g.caricati)}, ascolti ${n0(g.ascoltiTot)}, scartati ${n0(g.scartati)}</p>
            <p><b>Ultimo brano</b>: ${data(g.ultimo)}, durata media ${sec(g.durataMedia_s)}</p>
            <p><b>Colori</b>: ${(g.colori || []).map((x) => `<i class="sw" style="background:${esc(x)}"></i>`).join(' ')}</p>
          </div>
        </details></article>`;
    }).join('') || '<div class="empty">Nessun genere corrisponde alla ricerca.</div>');
  }
  $('#gcards').addEventListener('change', async (e) => {
    const c = e.target.closest('input[data-attiva]');
    if (!c) return;
    try {
      await invia('/api/controllo/genere', { nome: c.dataset.attiva, attivo: c.checked });
      toast(`${nm(c.dataset.attiva)}: ${c.checked ? 'in produzione' : 'sospeso'}`);
      const g = dati.generi.find((x) => x.nome === c.dataset.attiva);
      if (g) g.attivo = c.checked; // subito a video: l'analisi della libreria si aggiorna ogni 30 s
      renderGeneri();
      await caricaControllo(true);
    } catch (x) { c.checked = !c.checked; toast(x.message, 'err'); }
  });

  // vista della pagina Generi: schede o tabella dei pesi
  let genVista = 'schede';
  function mostraVistaGeneri(vista) {
    genVista = vista === 'pesi' ? 'pesi' : 'schede';
    document.querySelectorAll('#gsub button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gVista === genVista)));
    $('#g-schede').hidden = genVista !== 'schede';
    $('#c-generi').hidden = genVista !== 'pesi';
    if (genVista === 'pesi') caricaControllo();
  }
  $('#gsub').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g-vista]');
    if (!b) return;
    mostraVistaGeneri(b.dataset.gVista);
    history.replaceState(null, '', genVista === 'pesi' ? '#generi/pesi' : '#generi');
  });

  // ---------- controllo ----------
  let ctrl = null;
  let ctrlSub = 'produzione';
  const CTRL_SEZIONI = ['produzione', 'guida', 'note', 'parametri', 'messaggi', 'storico'];
  let noteGenere = null;

  function toast(testo, tipo) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (tipo === 'err' ? ' err' : '');
    t.textContent = testo;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }
  function chiedi(titolo, testo, etichetta = 'Conferma', tipo = '') {
    return new Promise((ok) => {
      const m = $('#modal');
      $('#mTit').textContent = titolo;
      $('#mTesto').textContent = testo;
      $('#mSi').textContent = etichetta;
      $('#mSi').className = 'btn' + (tipo === 'sicuro' ? '' : /Svuota|Elimina|Sospendi/.test(etichetta) ? ' danger' : '');
      const prima = document.activeElement;
      m.hidden = false;
      m.onkeydown = (e) => { if (e.key !== 'Tab') return; e.preventDefault(); (document.activeElement === $('#mSi') ? $('#mNo') : $('#mSi')).focus(); };
      const chiudi = (esito) => {
        m.hidden = true;
        if (prima && prima.isConnected) prima.focus();
        $('#mSi').onclick = null; $('#mNo').onclick = null; m.onclick = null;
        ok(esito);
      };
      $('#mSi').onclick = () => chiudi(true);
      $('#mNo').onclick = () => chiudi(false);
      m.onclick = (e) => { if (e.target === m) chiudi(false); };
      document.addEventListener('keydown', function k(e) {
        if (m.hidden) { document.removeEventListener('keydown', k); return; }
        if (e.key === 'Escape') { document.removeEventListener('keydown', k); chiudi(false); }
      });
      $('#mSi').focus();
    });
  }
  // invio di una modifica: intestazione X-Controllo obbligatoria lato gateway
  async function invia(url, corpo, signal) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Controllo': '1' }, body: JSON.stringify(corpo), cache: 'no-store', signal });
    const j = await r.json().catch(() => ({ ok: false, error: 'risposta non valida' }));
    if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  async function esegui(fn, messaggio) {
    try {
      await fn();
      if (messaggio) toast(messaggio, 'ok');
      await caricaControllo(true);
    } catch (e) {
      toast(e.message, 'err');
      await caricaControllo(true);
    }
  }
  function alPasso(input) {
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--p', ((Number(input.value) - min) / (max - min) * 100) + '%');
  }

  async function caricaControllo(silenzioso) {
    try {
      ctrl = await leggi('/api/controllo');
      disegnaControllo();
    } catch (e) {
      if (!silenzioso) toast('Impossibile leggere i dati di controllo: ' + e.message, 'err');
    }
  }

  function disegnaControllo() {
    if (!ctrl) return;
    if (!$('#c-generi').hidden) disegnaGeneri();
    if (!$('#t-controllo').classList.contains('on')) return;
    document.querySelectorAll('#csub button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.s === ctrlSub ? 'true' : 'false'));
    CTRL_SEZIONI.forEach((s) => { $('#c-' + s).hidden = s !== ctrlSub; });
    if (ctrlSub === 'produzione') disegnaProduzione();
    if (ctrlSub === 'parametri') disegnaParametri();
    if (ctrlSub === 'guida') disegnaGuida();
    if (ctrlSub === 'note') disegnaNote();
    if (ctrlSub === 'messaggi') disegnaMessaggi();
    if (ctrlSub === 'storico') disegnaStorico();
  }

  function disegnaProduzione() {
    const pausa = ctrl.comandi.pausa === true;
    const pendenti = [];
    if (ctrl.comandi.svuotaCoda) pendenti.push('svuotamento della coda');
    if (ctrl.comandi.produciGenere) pendenti.push('genere forzato: ' + nm(ctrl.comandi.produciGenere));
    const sf = ctrl.sfondi || { fatti: 0, totale: 0 };
    const scelto = $('#selGen') && $('#selGen').value;
    const inCoda = ((statoUltimo && statoUltimo.pipeline.prossimi) || []).map((c) => `<div class="srv"><span>${esc(c.titolo)}</span><span class="muted">${esc(nm(c.categoria))}</span></div>`).join('');
    const opzioni = perFamiglia(ctrl.generi).map(([titolo, lista]) => `<optgroup label="${esc(titolo)}">${lista.map((g) => `<option value="${esc(g.nome)}">${esc(g.etichetta)}${g.attivo ? '' : ' (sospeso)'}</option>`).join('')}</optgroup>`).join('');
    $('#c-produzione').innerHTML = `
      <div class="grid">
        <div class="card c6">
          <h2>Stato della produzione</h2>
          <p class="muted" style="margin:0 0 14px">${pausa
            ? 'La produzione è in pausa: il render in corso finisce, ma non ne partono di nuovi.'
            : 'La produzione è attiva: il sistema crea un brano alla volta.'}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${pausa
              ? '<button class="btn" id="bPausa">Riprendi la produzione</button>'
              : '<button class="btn warn" id="bPausa">Metti in pausa</button>'}
          </div>
        </div>
        <div class="card c6">
          <h2>Coda</h2>
          <p class="muted" style="margin:0 0 14px">I brani in attesa di render. Svuotarla non interrompe il brano in lavorazione.</p>
          ${inCoda || '<div class="empty">La coda è vuota.</div>'}
          <p style="margin:12px 0 0"><button class="btn danger" id="bCoda" ${inCoda ? '' : 'disabled'}>Svuota la coda</button></p>
        </div>
        <div class="card c12">
          <h2>Sfondi delle copertine <small>${n0(sf.fatti)} su ${n0(sf.totale)} pronti</small></h2>
          <p class="muted" style="margin:0 0 14px">${sf.inCorso
            ? (sf.inChiusura ? 'Mi fermo dopo l’immagine in lavorazione, poi la produzione torna com’era.' : 'Generazione in corso: la produzione è in pausa.')
            : 'La generazione mette in pausa la produzione, aspetta il brano in lavorazione e alla fine la ripristina. Puoi fermarla quando vuoi: riparte da dove era arrivata.'}</p>
          ${sf.ultima ? `<p class="muted" style="margin:0 0 14px;font-size:12px" aria-live="polite">${esc(sf.ultima)}</p>` : ''}
          ${sf.inCorso
            ? `<button class="btn" id="bSfondiStop" ${sf.inChiusura ? 'disabled' : ''}>Ferma la generazione</button>`
            : `<button class="btn warn" id="bSfondi" ${sf.fatti >= sf.totale ? 'disabled' : ''}>Metti in pausa e genera gli sfondi</button>`}
        </div>
        <div class="card c12">
          <h2>Produci ora un genere <small>ha la precedenza sulla rotazione, una sola volta</small></h2>
          <div class="addrow" style="max-width:640px">
            <select class="field" id="selGen">${opzioni}</select>
            <button class="btn" id="bGen">Produci questo genere</button>
          </div>
        </div>
        ${pendenti.length ? `<div class="card c12"><h2>Comandi in attesa</h2>${pendenti.map((p) => `<div class="srv"><span>${esc(p)}</span><span class="pill w">in attesa</span></div>`).join('')}</div>` : ''}
      </div>`;
    $('#bPausa').onclick = () => esegui(() => invia('/api/controllo/comando', { azione: pausa ? 'riprendi' : 'pausa' }),
      pausa ? 'Produzione ripresa' : 'Produzione in pausa');
    $('#bCoda').onclick = async () => {
      if (await chiedi('Svuotare la coda?', 'I brani in attesa verranno eliminati dalla coda. Il render in corso non viene toccato.', 'Svuota')) {
        esegui(() => invia('/api/controllo/comando', { azione: 'svuota_coda' }), 'Coda svuotata al prossimo giro');
      }
    };
    if (scelto) $('#selGen').value = scelto;
    if ($('#bSfondi')) $('#bSfondi').onclick = async () => {
      if (await chiedi('Generare gli sfondi?', 'La produzione va in pausa finché la generazione non finisce o la fermi.', 'Genera')) {
        esegui(() => invia('/api/controllo/comando', { azione: 'sfondi_avvia' }), 'Generazione degli sfondi avviata');
      }
    };
    if ($('#bSfondiStop')) $('#bSfondiStop').onclick = () => esegui(() => invia('/api/controllo/comando', { azione: 'sfondi_ferma' }), 'Fermo la generazione');
    $('#bGen').onclick = () => {
      const g = $('#selGen').value;
      esegui(() => invia('/api/controllo/comando', { azione: 'produci', genere: g }), 'Genere in produzione: ' + nm(g));
    };
  }

  function disegnaParametri() {
    const gruppi = {};
    for (const p of ctrl.parametri) (gruppi[p.gruppo] = gruppi[p.gruppo] || []).push(p);
    const html = Object.entries(gruppi).map(([g, lista]) => `
      <div class="card cgroup"><h3>${esc(g)}</h3>
        ${lista.map((p) => `
          <div class="prow">
            <div><div class="nm">${esc(p.etichetta)}${p.personalizzato ? '<span class="badge">modificato</span>' : ''}</div>
              <div class="ds">${esc(p.descrizione)}</div></div>
            <div class="ctl">
              <input type="range" min="${p.min}" max="${p.max}" step="${p.passo}" value="${p.valore}" data-k="${esc(p.chiave)}" aria-label="${esc(p.etichetta)}">
              <input class="field num" type="number" min="${p.min}" max="${p.max}" step="${p.passo}" value="${p.valore}" data-n="${esc(p.chiave)}" aria-label="${esc(p.etichetta)} valore">
              <span class="muted" style="min-width:34px;font-size:12px">${esc(p.unita)}</span>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn small" data-salva="${esc(p.chiave)}" disabled>Salva</button>
              <button class="btn small ghost" data-def="${esc(p.chiave)}" data-val="${p.def}" ${p.personalizzato ? '' : 'disabled'}>Predefinito</button>
            </div>
          </div>`).join('')}
      </div>`).join('');
    $('#c-parametri').innerHTML = html;
    const cerca = (k) => ctrl.parametri.find((p) => p.chiave === k);
    const cambiato = (k, v) => { document.querySelector(`button[data-salva="${k}"]`).disabled = v === '' || Number(v) === cerca(k).valore; };
    $('#c-parametri').querySelectorAll('input[type="range"]').forEach((r) => {
      alPasso(r);
      r.addEventListener('input', () => {
        const n = document.querySelector(`input[data-n="${r.dataset.k}"]`);
        n.value = r.value; alPasso(r); cambiato(r.dataset.k, r.value);
      });
    });
    $('#c-parametri').querySelectorAll('input[type="number"]').forEach((n) => {
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector(`button[data-salva="${n.dataset.n}"]`).click(); });
      n.addEventListener('input', () => {
        const r = document.querySelector(`input[data-k="${n.dataset.n}"]`);
        if (n.value !== '') { r.value = n.value; alPasso(r); }
        cambiato(n.dataset.n, n.value);
      });
    });
    $('#c-parametri').querySelectorAll('button[data-salva]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.salva;
        const v = Number(document.querySelector(`input[data-n="${k}"]`).value);
        const p = cerca(k);
        if (Number.isNaN(v) || v < p.min || v > p.max) { toast(`${p.etichetta}: valore tra ${p.min} e ${p.max}`, 'err'); return; }
        esegui(() => invia('/api/controllo/parametro', { chiave: k, valore: v }), p.etichetta + ' salvato');
      };
    });
    $('#c-parametri').querySelectorAll('button[data-def]').forEach((b) => {
      b.onclick = async () => {
        const k = b.dataset.def, p = cerca(k);
        if (await chiedi('Ripristinare il valore predefinito?', `${p.etichetta} tornerà a ${p.def}${p.unita ? ' ' + p.unita : ''}.`, 'Ripristina')) {
          esegui(() => invia('/api/controllo/parametro', { chiave: k, valore: p.def }), p.etichetta + ' ripristinato');
        }
      };
    });
  }

  function disegnaMessaggi() {
    const { impostazioni: imp, definizioni, frequenze } = ctrl.messaggi;
    const ore = (da, a, scelta) => Array.from({ length: a - da + 1 }, (_, i) => da + i)
      .map((h) => `<option value="${h}" ${h === scelta ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
    const freq = (m) => m < 60 ? m + ' minuti' : m === 60 ? '1 ora' : m / 60 + ' ore';
    $('#c-messaggi').innerHTML = `
      <div class="grid">
        <div class="card c12">
          <h2>Quando <small>ora di questo PC</small></h2>
          <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end">
            <label>Un riepilogo ogni<br><select class="field" id="mFreq">${frequenze.map((m) => `<option value="${m}" ${m === imp.frequenzaMin ? 'selected' : ''}>${freq(m)}</option>`).join('')}</select></label>
            <label>Inizio invii<br><select class="field" id="mInizio">${ore(0, 23, imp.inizio)}</select></label>
            <label>Stop invii<br><select class="field" id="mFine">${ore(1, 24, imp.fine)}</select></label>
          </div>
          <p class="muted" style="margin:14px 0 0">L'ultimo riepilogo parte all'ora di stop. Poi, fino all'inizio, non arriva nessun messaggio automatico. Le risposte ai tuoi comandi arrivano sempre.</p>
        </div>
        ${Object.entries(definizioni).map(([nome, def]) => `
        <div class="card c4" data-tipo="${esc(nome)}">
          <h2>${esc(def.etichetta)} <label class="switch"><input type="checkbox" data-attivo ${imp.tipi[nome].attivo ? 'checked' : ''} aria-label="attiva ${esc(def.etichetta)}"><span></span></label></h2>
          <p class="muted" style="margin:0 0 12px">${esc(def.descrizione)}</p>
          ${Object.entries(def.dati).map(([d, testo]) => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer"><input type="checkbox" value="${esc(d)}" data-dato ${imp.tipi[nome].dati.includes(d) ? 'checked' : ''}> ${esc(testo)}</label>`).join('')}
        </div>`).join('')}
        <div class="card c12"><button class="btn" id="mSalva">Salva le impostazioni dei messaggi</button></div>
      </div>`;
    $('#mSalva').onclick = async () => {
      const tipi = {};
      $('#c-messaggi').querySelectorAll('[data-tipo]').forEach((c) => {
        tipi[c.dataset.tipo] = { attivo: c.querySelector('[data-attivo]').checked, dati: [...c.querySelectorAll('[data-dato]:checked')].map((x) => x.value) };
      });
      const corpo = { frequenzaMin: Number($('#mFreq').value), inizio: Number($('#mInizio').value), fine: Number($('#mFine').value), tipi };
      // in caso di errore le scelte restano a video, pronte da correggere
      try { await invia('/api/controllo/messaggi', corpo); toast('Impostazioni dei messaggi salvate', 'ok'); await caricaControllo(true); }
      catch (e) { toast(e.message, 'err'); }
    };
  }

  const vistaGeneri = { stato: '', ordine: '', verso: 1 };
  function generiMostrati() {
    const q = $('#cGenQ').value.trim().toLowerCase();
    const lista = ctrl.generi.filter((g) => (!vistaGeneri.stato || g.attivo === (vistaGeneri.stato === 'si')) && [g.etichetta, g.nome, g.famiglia, g.ambito].join(' ').toLowerCase().includes(q));
    const k = vistaGeneri.ordine;
    if (k) lista.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) : a[k] - b[k]) * vistaGeneri.verso);
    return lista;
  }
  function disegnaGeneri() {
    // La struttura (barra di ricerca e tabella) si crea una sola volta; a ogni modifica si aggiorna solo il corpo
    if (!$('#gTbody')) {
      $('#c-generi').innerHTML = `
      <div class="toolbar">
        <input class="search" id="cGenQ" type="search" placeholder="Cerca un genere…" aria-label="Cerca genere">
        <div id="cGenFil" style="display:flex;gap:8px" role="group" aria-label="stato"><button class="fchip" data-st="" aria-pressed="true">tutti</button><button class="fchip" data-st="si" aria-pressed="false">attivi</button><button class="fchip" data-st="no" aria-pressed="false">sospesi</button></div>
        <button class="btn small" id="bAttMostrati" data-tip="Attiva tutti i generi che vedi nell'elenco">Attiva i mostrati</button>
        <button class="btn small warn" id="bSospMostrati" data-tip="Sospende tutti i generi che vedi nell'elenco">Sospendi i mostrati</button>
        <button class="btn small ghost" id="bPesiUno">Pesi a 1</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="scroll"><table class="gtable">
          <thead><tr><th><button type="button" data-gord="etichetta">Genere</button></th><th class="num"><button type="button" data-gord="brani">Brani</button></th><th><button type="button" data-gord="attivo">Attivo</button></th><th><button type="button" data-gord="peso">Peso di frequenza</button></th><th></th></tr></thead>
          <tbody id="gTbody"></tbody>
        </table></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Il peso indica quanto spesso esce un genere: 1 è la norma, 0 non esce mai, 5 esce cinque volte più spesso. I generi con pochi brani restano privilegiati dalla rotazione.</p>`;
      $('#cGenQ').addEventListener('input', () => disegnaGeneri());
      const massa = async (attivo) => {
        const scelti = generiMostrati().filter((g) => g.attivo !== attivo);
        if (!scelti.length) { toast('Nessun genere da cambiare', 'ok'); return; }
        if (await chiedi(attivo ? 'Attivare i generi mostrati?' : 'Sospendere i generi mostrati?', `Cambierà lo stato di ${scelti.length} generi.`, attivo ? 'Attiva' : 'Sospendi')) {
          esegui(async () => { for (const g of scelti) await invia('/api/controllo/genere', { nome: g.nome, attivo }); }, 'Generi aggiornati: ' + scelti.length);
        }
      };
      $('#bAttMostrati').onclick = () => massa(true);
      $('#bSospMostrati').onclick = () => massa(false);
      $('#cGenFil').onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; vistaGeneri.stato = b.dataset.st; disegnaGeneri(); };
      $('#c-generi').querySelector('thead').onclick = (e) => {
        const b = e.target.closest('[data-gord]'); if (!b) return;
        vistaGeneri.verso = vistaGeneri.ordine === b.dataset.gord ? -vistaGeneri.verso : (b.dataset.gord === 'etichetta' ? 1 : -1);
        vistaGeneri.ordine = b.dataset.gord; disegnaGeneri();
      };
      $('#bPesiUno').onclick = async () => {
        const diversi = ctrl.generi.filter((g) => g.peso !== 1);
        if (!diversi.length) { toast('Tutti i pesi sono già a 1', 'ok'); return; }
        if (await chiedi('Riportare tutti i pesi a 1?', `Verranno riportati a 1 i pesi di ${diversi.length} generi.`, 'Riporta a 1')) {
          esegui(async () => { for (const g of diversi) await invia('/api/controllo/genere', { nome: g.nome, peso: 1 }); }, 'Pesi riportati a 1');
        }
      };
    }
    document.querySelectorAll('#cGenFil [data-st]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.st === vistaGeneri.stato)));
    $('#gTbody').innerHTML = generiMostrati().map((g) => `
            <tr>
              <td class="nm">${esc(g.etichetta)}<br><small class="muted">${esc([g.ambito, g.famiglia].filter(Boolean).join(' · '))}</small></td>
              <td class="num">${n0(g.brani)}</td>
              <td><label class="switch"><input type="checkbox" data-att="${esc(g.nome)}" aria-label="${esc(g.etichetta)} attivo" ${g.attivo ? 'checked' : ''}><span></span></label></td>
              <td><div style="display:flex;align-items:center;gap:10px">
                <input type="range" min="0" max="5" step="0.05" value="${g.peso}" data-peso="${esc(g.nome)}" aria-label="peso ${esc(g.etichetta)}">
                <span class="num" style="min-width:40px">${n1(g.peso)}</span></div></td>
              <td><button class="link" data-stile="${esc(g.nome)}">stile</button></td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">Nessun genere corrisponde.</td></tr>';
    $('#c-generi').querySelectorAll('input[data-att]').forEach((c) => {
      c.onchange = () => esegui(() => invia('/api/controllo/genere', { nome: c.dataset.att, attivo: c.checked }),
        `${nm(c.dataset.att)}: ${c.checked ? 'attivato' : 'sospeso'}`);
    });
    $('#c-generi').querySelectorAll('input[data-peso]').forEach((r) => {
      alPasso(r);
      r.addEventListener('input', () => { r.parentElement.querySelector('span').textContent = n1(Number(r.value)); alPasso(r); });
      r.onchange = () => esegui(() => invia('/api/controllo/genere', { nome: r.dataset.peso, peso: Number(r.value) }),
        `${nm(r.dataset.peso)}: peso ${n1(Number(r.value))}`);
    });
  }

  // Tooltip: qualunque elemento con data-tip, al passaggio del mouse o con la tastiera
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let tipDi = null;
  function mostraTip(el) {
    if (el === tipDi) return;
    nascondiTip();
    if (!el) return;
    tipDi = el;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    el.setAttribute('aria-describedby', 'tip');
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) + 'px';
    tip.style.top = (r.top - t.height - 8 >= 8 ? r.top - t.height - 8 : r.bottom + 8) + 'px';
  }
  function nascondiTip() {
    if (tipDi) tipDi.removeAttribute('aria-describedby');
    tipDi = null;
    tip.hidden = true;
  }
  document.addEventListener('mouseover', (e) => mostraTip(e.target.closest('[data-tip]')));
  document.addEventListener('focusin', (e) => mostraTip(e.target.closest('[data-tip]')));
  document.addEventListener('focusout', nascondiTip);
  document.addEventListener('click', nascondiTip, true);
  document.addEventListener('scroll', nascondiTip, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') nascondiTip(); });

  // Linee guida a blocchi: si salvano solo le aggiunte e le esclusioni rispetto al catalogo
  let guidaScheda = 'stile', guidaAmbito = 'generale', guidaFam = 'strumenti', guidaCerca = '', guidaFiltro = '', guidaFiltroTempo = '', guidaVariante = 0, guidaRichiesta = 0, guidaScorri = 0;
  const SCHEDE = { stile: 'Stile', tempo: 'Tempo e struttura', note: 'Note' };
  const TIP_SCHEDE = {
    stile: 'I termini inglesi che descrivono la musica al motore, per tutti i generi o per uno.',
    tempo: 'Velocità, durata e forma dei brani, genere per genere.', note: 'Indicazioni scritte che la revisione automatica legge.',
  };
  const FAMIGLIE = { genere: 'Genere', strumenti: 'Strumenti', ritmo: 'Ritmo', atmosfera: 'Atmosfera', timbro: 'Timbro', produzione: 'Produzione', voce: 'Voce' };
  const ARGOMENTI = { genere: 'Genere', strumenti: 'Strumenti', variante: 'Variante', ritmo: 'Ritmo', atmosfera: 'Atmosfera', produzione: 'Produzione', aggiunte: 'Aggiunte', fisso: 'Sempre presenti' };
  const EFFETTI = {
    genere: 'Orienta lo stile dell\'intero brano.', strumenti: 'Il motore tende a far suonare questo strumento.', ritmo: 'Cambia pulsazione e andamento.',
    atmosfera: 'Colora l\'umore del brano.', timbro: 'Cambia il colore del suono.', produzione: 'Cambia spazio, riverbero e missaggio.', voce: 'Riguarda la voce: si usa solo nei generi vocali.',
  };
  const TIP_ORIGINE = {
    catalogo: 'Viene dal catalogo del genere.', tuo: 'Lo hai aggiunto tu a questo genere.', generale: 'Lo hai aggiunto per tutti i generi.',
    revisione: 'Aggiunto dalla revisione automatica in base ai tuoi voti.', nota: 'Viene da una tua nota per il genere.',
  };
  const TIP_STRUTTURE = {
    piatto: 'Energia costante, senza picchi.', onda: 'Energia che sale e scende a ondate.', arco: 'Cresce fino al centro e poi si distende.',
    crescendo: 'Cresce gradualmente fino al finale.', loop: 'Sezioni che ritornano in ciclo.',
  };
  // cosa fa un termine: spiegazione ed effetto della sua famiglia
  function spiega(t) {
    const k = String(t).toLowerCase();
    const fisso = /^instrumental$/.test(k) ? 'Chiede un brano senza voce.' : /^wordless vocals$/.test(k) ? 'Chiede vocalizzi senza parole.'
      : /^no (vocals|lyrics)$/.test(k) ? 'Ribadisce che il brano non deve avere parole o voce.' : /\bbpm$/.test(k) ? 'Velocità: battiti al minuto, scelta nella fascia del genere.'
      : /^[a-g](#|b)? (major|minor)$/.test(k) ? 'Tonalità del brano (major = maggiore, minor = minore).' : '';
    if (fisso) return fisso;
    const famiglia = Object.keys(EFFETTI).find((f) => (ctrl.vocabolario[f] || []).includes(k));
    const testo = ctrl.spiegazioni[k];
    if (!testo) return 'Termine libero: non è nel vocabolario, l\'effetto sul motore non è prevedibile.';
    return testo.charAt(0).toUpperCase() + testo.slice(1) + '.' + (famiglia ? '\n' + EFFETTI[famiglia] : '');
  }
  const ORIGINI = { catalogo: 'catalogo', tuo: 'tuo', generale: 'per tutti i generi', revisione: 'revisione automatica', nota: 'dalle note', fisso: 'fisso' };

  const indirizzoGuida = () => '#controllo/guida' + (guidaScheda !== 'stile' ? '/' + guidaScheda : guidaAmbito !== 'generale' ? '/' + encodeURIComponent(guidaAmbito) : '');
  function apriGuida(parte) {
    if (SCHEDE[parte]) guidaScheda = parte;
    else if (parte) { guidaScheda = 'stile'; guidaAmbito = decodeURIComponent(parte); }
  }
  function vaiGuida(scheda) {
    guidaScheda = scheda;
    history.replaceState(null, '', indirizzoGuida());
    disegnaGuida();
  }
  function scegliAmbito(nome) {
    guidaAmbito = nome; guidaVariante = 0; guidaCerca = '';
    vaiGuida('stile');
  }
  const tinta = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  const perFamiglia = (elenco) => {
    const gruppi = {};
    for (const x of elenco) (gruppi[[x.ambito, x.famiglia].filter(Boolean).join(' · ') || 'altro'] ||= []).push(x);
    return Object.entries(gruppi).sort((x, y) => x[0].localeCompare(y[0])).map(([titolo, lista]) => [titolo, lista.sort((x, y) => x.etichetta.localeCompare(y.etichetta))]);
  };
  const salvaGuida = (corpo, messaggio) => esegui(() => invia('/api/controllo/guida', corpo), messaggio);

  async function disegnaGuida() {
    if (guidaAmbito !== 'generale' && !ctrl.generi.some((x) => x.nome === guidaAmbito)) guidaAmbito = 'generale';
    const richiesta = ++guidaRichiesta;
    let anteprima = null;
    if (guidaScheda === 'stile' && guidaAmbito !== 'generale') {
      try {
        anteprima = await leggi('/api/controllo/stile?genere=' + encodeURIComponent(guidaAmbito) + '&variante=' + guidaVariante);
      } catch (e) { toast('Impossibile leggere lo stile del genere: ' + e.message, 'err'); return; }
    }
    if (richiesta === guidaRichiesta) mostraGuida(anteprima);
  }

  function mostraGuida(a) {
    const radice = $('#c-guida');
    const scorrimento = $('#gVoci') ? $('#gVoci').scrollTop : null;
    const g = ctrl.guida;
    const schede = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="sub-nav" role="group" aria-label="sezioni delle linee guida" style="margin:0">${Object.entries(SCHEDE).map(([k, t]) => `<button type="button" data-scheda="${k}" data-tip="${esc(TIP_SCHEDE[k])}" aria-pressed="${k === guidaScheda}">${t}</button>`).join('')}</div>
      <span class="muted" style="font-size:12px">Versione ${esc(g.versione ?? '—')} · aggiornate ${data(g.aggiornato)} · le modifiche valgono dal prossimo brano</span></div>`;
    radice.innerHTML = schede + '<div id="gCorpo"></div>';
    radice.querySelectorAll('[data-scheda]').forEach((b) => { b.onclick = () => vaiGuida(b.dataset.scheda); });
    if (guidaScheda === 'tempo') return schedaTempo();
    if (guidaScheda === 'note') return schedaNote();
    return schedaStile(a, scorrimento);
  }

  function schedaStile(a, scorrimento) {
    const g = ctrl.guida;
    const genere = guidaAmbito !== 'generale';
    const scheda = genere ? ctrl.generi.find((x) => x.nome === guidaAmbito) : null;
    const salvati = genere ? (g.blocchi_generi[guidaAmbito] || {}) : { aggiunti: g.style_extra, esclusi: g.style_avoid };
    const aggiunti = (salvati.aggiunti || []).map((v) => v.toLowerCase());
    const esclusi = (salvati.esclusi || []).map((v) => v.toLowerCase());
    const noti = new Set(Object.values(ctrl.vocabolario).flat());
    const voci_ = new Set(ctrl.vocabolario.voce || []);
    const vocale = !!(a && a.vocale);
    const famiglie = Object.keys(FAMIGLIE).filter((f) => f !== 'voce' || genere);
    if (!famiglie.includes(guidaFam)) guidaFam = 'strumenti';
    const salva = (piu, meno, messaggio, azzera) => salvaGuida({ campo: 'blocchi', ambito: guidaAmbito, aggiunti: piu, esclusi: meno, azzera }, messaggio);
    const senza = (lista, v) => lista.filter((x) => x !== v);
    // un secondo clic sullo stesso segno annulla la scelta
    const aggiungi = (v) => (aggiunti.includes(v) ? salva(senza(aggiunti, v), esclusi, 'Rimosso: ' + v) : salva(aggiunti.concat(v), senza(esclusi, v), 'Aggiunto: ' + v));
    const evita = (v) => (esclusi.includes(v) ? salva(aggiunti, senza(esclusi, v), 'Rimesso: ' + v) : salva(senza(aggiunti, v), esclusi.concat(v), 'Da evitare: ' + v));
    const chip = (testo, classe, extra, etichetta) => `<button type="button" class="blocco ${classe}" data-t="${esc(testo)}" ${extra || ''} data-tip="${esc(spiega(testo) + '\n\n' + etichetta)}" aria-label="${esc(testo + ': ' + etichetta)}">${esc(testo)}</button>`;
    const libero = (v) => (noti.has(v) ? '' : ' libero');
    const modifiche = (n) => {
      const b = g.blocchi_generi[n] || {};
      return (b.aggiunti || []).length + (b.esclusi || []).length + ((g.stile_generi || {})[n] || []).length;
    };
    const generali = g.style_extra.length + g.style_avoid.length;

    const voce = (nome, extra) => `<button type="button" class="gvoce ${extra || ''}" data-g="${esc(nome)}" aria-current="${nome === guidaAmbito}">`;
    const lato = `<aside class="card guida-lato" aria-label="generi">
      <input class="field" id="gFiltro" type="search" placeholder="Cerca un genere" aria-label="cerca un genere" value="${esc(guidaFiltro)}">
      <div class="guida-voci" id="gVoci">${voce('generale')}<i style="background:var(--accent)"></i><span>Tutti i generi</span>${generali ? `<em data-tip="Quante modifiche ci sono.">${generali}</em>` : ''}</button>
        ${perFamiglia(ctrl.generi).map(([titolo, elenco]) => `<div data-gruppo><h3>${esc(titolo)}</h3>${elenco.map((x) => `${voce(x.nome, x.attivo ? '' : 'sospeso')}<i style="${tinta(x.colore) ? 'background:' + tinta(x.colore) : ''}"></i><span title="${esc(x.etichetta + (x.attivo ? '' : ' (sospeso)'))}">${esc(x.etichetta)}</span>${modifiche(x.nome) ? `<em data-tip="Termini aggiunti, evitati o proposti dalla revisione.">${modifiche(x.nome)}</em>` : ''}</button>`).join('')}</div>`).join('')}</div></aside>`;

    const quante = genere ? modifiche(guidaAmbito) : generali;
    const testa = `<div class="card guida-testa" style="${scheda && tinta(scheda.colore) ? 'border-left-color:' + tinta(scheda.colore) : ''}">
      <div><div class="occhiello">Stai modificando</div><h2>${esc(scheda ? scheda.etichetta : 'Tutti i generi')}</h2>
        ${scheda ? `<span class="tag">${esc([scheda.ambito, scheda.famiglia].filter(Boolean).join(' · '))}</span> <span class="tag ${scheda.attivo ? 'acc' : ''}" data-tip="${scheda.attivo ? 'Il sistema produce brani di questo genere.' : 'Il genere è sospeso: si riattiva in Controllo, Generi.'}">${scheda.attivo ? 'in produzione' : 'sospeso'}</span> <span class="tag">${vocale ? 'vocalizzi senza parole' : 'strumentale'}</span> <span class="tag">${esc(a.bpm)} BPM</span>` : '<span class="muted" style="font-size:12.5px">Le scelte fatte qui valgono per ogni brano.</span>'}</div>
      <div class="azioni">${scheda ? '<button class="btn small ghost" id="gTempo" data-tip="Apre velocità, durata e forma di questo genere.">Tempo e struttura</button>' : ''}
        <button class="btn small ghost" id="gAzzera" data-tip="${genere ? 'Toglie i termini aggiunti, quelli da evitare e quelli della revisione per questo genere.' : 'Toglie i termini aggiunti ed evitati per tutti i generi.'}" ${quante ? '' : 'disabled'}>Torna al predefinito</button></div></div>`;

    let stileHtml;
    if (genere) {
      const presenti = new Set(a.blocchi.map((b) => b.testo.toLowerCase()));
      const altri = esclusi.filter((v) => !presenti.has(v));
      const origini = [...new Set(a.blocchi.filter((b) => !b.escluso).map((b) => b.origine))];
      const blocco = (b) => {
        const k = b.testo.toLowerCase();
        if (b.origine === 'fisso') return chip(b.testo, 'o-fisso', 'aria-disabled="true"', 'Sempre presente: non si può togliere.');
        if (b.escluso) return chip(b.testo, 'escluso', 'data-fai="ripristina"', esclusi.includes(k) ? 'Ora è tolto dallo stile. Clic per rimetterlo.' : 'Tolto per tutti i generi.');
        const extra = b.origine === 'tuo' || b.origine === 'generale' ? libero(k) : '';
        if (b.origine === 'tuo') return chip(b.testo, 'o-tuo' + extra, 'data-fai="rimuovi"', TIP_ORIGINE.tuo + ' Clic per rimuoverlo.');
        return chip(b.testo, 'o-' + b.origine + extra, 'data-fai="escludi"', TIP_ORIGINE[b.origine] + ' Clic per toglierlo dallo stile.');
      };
      const righe = Object.entries(ARGOMENTI).map(([k, titolo]) => {
        const suoi = a.blocchi.filter((b) => b.argomento === k).map(blocco).concat(k === 'aggiunte' ? altri.map((v) => chip(v, 'escluso', 'data-fai="ripristina"', 'È nell\'elenco da evitare. Clic per toglierlo dall\'elenco.')) : []);
        return suoi.length ? `<dt>${titolo}</dt><dd><div class="blocchi">${suoi.join('')}</div></dd>` : '';
      }).join('');
      stileHtml = `<div class="card"><h2>Stile del genere <small>clic su un termine per toglierlo o rimetterlo</small></h2>
        <dl class="argomenti" id="gPrompt">${righe}</dl>
        <div class="legenda">${Object.keys(ORIGINI).filter((o) => origini.includes(o)).map((o) => `<span><b class="blocco o-${o}"></b>${ORIGINI[o]}</span>`).join('')}${a.blocchi.some((b) => b.escluso) || altri.length ? '<span><b class="blocco escluso"></b>da evitare</span>' : ''}</div>
        <div class="sezione"><h4><span data-tip="Il testo che descrive il brano a YuE2. Strumenti, variante e influenza cambiano da un brano all'altro.">Esempio di prompt inviato al motore · ${n0(a.conteggio)} termini</span>
          ${a.varianti.length ? `<label style="font-weight:400" data-tip="Ogni genere ha alcune varianti di colore: scegline una per vedere come cambia il prompt.">Variante <select class="field" id="gVariante">${a.varianti.map((v, i) => `<option value="${i}" ${i === guidaVariante ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : ''}</h4>
          <div class="prompt">${esc(a.esempio)}</div>${a.avvisi.map((x) => `<div class="avviso" role="status">${esc(x)}</div>`).join('')}</div></div>`;
    } else {
      const riga = (titolo, lista, classe, vuoto) => `<dt>${titolo}</dt><dd><div class="blocchi">${lista.map((v) => chip(v, classe + libero(v), `data-fai="${classe === 'escluso' ? 'ripristina' : 'rimuovi'}"`, classe === 'escluso' ? 'Tolto dallo stile di tutti i generi. Clic per annullare.' : 'Aggiunto allo stile di tutti i generi. Clic per rimuoverlo.')).join('') || `<span class="muted" style="font-size:12.5px">${vuoto}</span>`}</div></dd>`;
      stileHtml = `<div class="card"><h2>Regole per tutti i generi <small>clic su un termine per toglierlo</small></h2>
        <dl class="argomenti" id="gPrompt">${riga('Aggiunti', aggiunti, 'o-generale', 'Nessuno: usa + qui sotto.')}${riga('Da evitare', esclusi, 'escluso', 'Nessuno: usa − qui sotto.')}</dl></div>`;
    }

    const scelta = `<div class="card"><h2>Vocabolario <small>+ aggiunge allo stile (${aggiunti.length} di 8) · − da evitare</small></h2>
      <input class="field" id="gCerca" type="search" maxlength="60" placeholder="Cerca in tutto il vocabolario, o scrivi un termine nuovo e premi Invio" value="${esc(guidaCerca)}" aria-label="cerca o scrivi un termine" style="width:100%">
      <div class="termini"><div class="termini-famiglie" role="group" aria-label="argomento">${famiglie.map((f) => `<button type="button" class="gvoce" data-fam="${f}" data-tip="${esc(EFFETTI[f])}"><span>${FAMIGLIE[f]}</span><small>${n0((ctrl.vocabolario[f] || []).length)}</small></button>`).join('')}</div>
        <div class="termini-elenco" id="gVocab"></div></div></div>`;

    const corpo = $('#gCorpo');
    corpo.innerHTML = `<div class="guida">${lato}<div class="guida-corpo">${testa}${stileHtml}${scelta}</div></div>`;

    const clic = (selettore, fn) => corpo.querySelectorAll(selettore).forEach((b) => { b.onclick = () => fn(b); });
    const voci = $('#gVoci');
    if (scorrimento !== null) voci.scrollTop = scorrimento;
    else { const corrente = voci.querySelector('[aria-current="true"]'); voci.scrollTop = corrente.offsetTop - voci.offsetTop - 60; }
    const filtra = () => {
      const f = guidaFiltro.trim().toLowerCase();
      voci.querySelectorAll('.gvoce').forEach((b) => { b.style.display = !f || (b.textContent + ' ' + b.dataset.g).toLowerCase().includes(f) ? '' : 'none'; });
      voci.querySelectorAll('[data-gruppo]').forEach((d) => { d.style.display = [...d.querySelectorAll('.gvoce')].some((b) => b.style.display !== 'none') ? '' : 'none'; });
    };
    filtra();
    $('#gFiltro').oninput = (e) => { guidaFiltro = e.target.value; filtra(); };
    clic('[data-g]', (b) => scegliAmbito(b.dataset.g));

    const voceVietata = (t) => !vocale && voci_.has(t);
    const mostraVocabolario = () => {
      const cerca = guidaCerca.trim().toLowerCase();
      corpo.querySelectorAll('[data-fam]').forEach((b) => b.setAttribute('aria-current', String(!cerca && b.dataset.fam === guidaFam)));
      const fonte = cerca ? famiglie.flatMap((f) => ctrl.vocabolario[f] || []) : (ctrl.vocabolario[guidaFam] || []);
      const trovati = fonte.filter((t) => t.includes(cerca));
      if (cerca.length > 1 && !noti.has(cerca)) trovati.unshift(cerca);
      $('#gVocab').innerHTML = trovati.map((t) => {
        const piu = aggiunti.includes(t), meno = esclusi.includes(t), nuovo = !noti.has(t);
        return `<div class="termine${piu ? ' piu' : meno ? ' meno' : ''}"><span tabindex="0" data-tip="${esc(spiega(t))}">${esc(t)}${nuovo ? ' <small class="muted">(nuovo)</small>' : ''}</span>
          <button type="button" class="segno piu" data-piu="${esc(t)}" aria-pressed="${piu}" aria-label="aggiungi ${esc(t)}" data-tip="${esc(voceVietata(t) && !piu ? 'Le voci non si possono aggiungere ai brani strumentali.' : piu ? 'Aggiunto: clic per annullare.' : 'Aggiunge «' + t + '» allo stile' + (genere ? ' di questo genere.' : ' di tutti i generi.'))}" ${voceVietata(t) && !piu ? 'aria-disabled="true"' : ''}>+</button>
          <button type="button" class="segno meno" data-meno="${esc(t)}" aria-pressed="${meno}" aria-label="evita ${esc(t)}" data-tip="${esc(meno ? 'Da evitare: clic per annullare.' : 'Toglie «' + t + '» dallo stile' + (genere ? ' di questo genere' : ' di tutti i generi') + ', anche se viene dal catalogo. Il motore non riceve un divieto: il termine non gli viene detto.')}">−</button></div>`;
      }).join('') || '<div class="termine muted">Nessun termine trovato.</div>';
      clic('[data-piu]', (b) => (b.getAttribute('aria-disabled') === 'true' ? toast('Le voci non vanno nei brani strumentali', 'err') : aggiungi(b.dataset.piu)));
      clic('[data-meno]', (b) => evita(b.dataset.meno));
    };
    mostraVocabolario();
    const elencoTermini = $('#gVocab');
    elencoTermini.scrollTop = guidaScorri;
    elencoTermini.onscroll = () => { guidaScorri = elencoTermini.scrollTop; };
    $('#gCerca').oninput = (e) => { guidaCerca = e.target.value; mostraVocabolario(); elencoTermini.scrollTop = 0; };
    $('#gCerca').onkeydown = (e) => {
      const v = guidaCerca.trim().toLowerCase();
      if (e.key !== 'Enter' || !v || aggiunti.includes(v)) return;
      guidaCerca = '';
      aggiungi(v);
    };
    clic('[data-fam]', (b) => { guidaFam = b.dataset.fam; guidaCerca = ''; $('#gCerca').value = ''; mostraVocabolario(); elencoTermini.scrollTop = 0; });
    $('#gAzzera').onclick = async () => {
      const testo = genere ? 'Si tolgono i termini aggiunti, quelli da evitare e quelli della revisione per ' + scheda.etichetta + '.' : 'Si tolgono i termini aggiunti e quelli da evitare per tutti i generi.';
      if (await chiedi('Tornare al predefinito?', testo, 'Torna al predefinito')) salva([], [], 'Ripristinato', true);
    };
    if ($('#gTempo')) $('#gTempo').onclick = () => { guidaFiltroTempo = scheda.etichetta; vaiGuida('tempo'); };
    if ($('#gVariante')) $('#gVariante').onchange = (e) => { guidaVariante = Number(e.target.value); disegnaGuida(); };
    clic('#gPrompt [data-fai]', (b) => {
      const v = b.dataset.t.toLowerCase(), fai = b.dataset.fai;
      if (fai === 'escludi') return evita(v);
      if (fai === 'rimuovi') return salva(senza(aggiunti, v), esclusi, 'Rimosso: ' + v);
      if (!esclusi.includes(v)) return toast('Escluso per tutti i generi: cambialo in "Tutti i generi"', 'err');
      return salva(aggiunti, senza(esclusi, v), 'Rimesso: ' + v);
    });
  }

  // Bpm, durata e strutture di tutti i generi: un campo vuoto vale il predefinito
  function schedaTempo() {
    const g = ctrl.guida;
    const durata = ['durMin', 'durMax'].map((k) => (ctrl.parametri.find((p) => p.chiave === k) || {}).valore).join('-');
    const campo = (x, chiave, salvato, predefinito, nome) => `<input class="field${salvato ? ' mio' : ''}" data-campo="${chiave}" data-genere="${esc(x.nome)}" value="${esc(salvato || '')}" placeholder="${esc(predefinito)}" aria-label="${nome} di ${esc(x.etichetta)}, minimo-massimo">`;
    const strutture = (x) => {
      const scelte = g.struttura_pref[x.nome];
      return `<div class="strutture${scelte ? '' : ' predefinito'}">${x.strutture.map((s) => `<button type="button" class="fchip" data-tip="${esc(TIP_STRUTTURE[s] || s)}" data-struttura="${esc(s)}" data-genere="${esc(x.nome)}" aria-pressed="${!scelte || scelte.includes(s)}">${esc(s)}</button>`).join('')}</div>`;
    };
    const corpo = $('#gCorpo');
    corpo.innerHTML = `<div class="card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <input class="field" id="gFiltroTempo" type="search" placeholder="Cerca un genere o una famiglia" value="${esc(guidaFiltroTempo)}" aria-label="cerca un genere" style="flex:1;min-width:220px">
        <span class="muted" style="font-size:12px">${n0(ctrl.generi.length)} generi · in grigio il valore predefinito, evidenziati quelli cambiati · svuota un campo per tornare al predefinito</span></div>
      <div class="scroll"><table class="tempo"><thead><tr><th>Genere</th><th data-tip="Battiti al minuto, formato minimo-massimo. Più alto vuol dire più veloce.">BPM</th><th data-tip="Durata richiesta per i brani, in secondi, formato minimo-massimo.">Durata (s)</th><th data-tip="La forma del brano. Sono accese quelle che il sistema può usare: clic per accendere o spegnere.">Strutture usate</th></tr></thead>
        ${perFamiglia(ctrl.generi).map(([titolo, elenco]) => `<tbody><tr class="gruppo"><td colspan="4">${esc(titolo)}</td></tr>${elenco.map((x) => `<tr data-cerca="${esc((x.etichetta + ' ' + x.nome + ' ' + titolo).toLowerCase())}"><td${x.attivo ? '' : ' class="muted"'}>${esc(x.etichetta)}${x.attivo ? '' : ' <small>(sospeso)</small>'}</td>
          <td>${campo(x, 'bpm_range', g.bpm_range[x.nome], x.bpm.join('-'), 'bpm')}</td><td>${campo(x, 'durata_hint', g.durata_hint[x.nome], durata, 'durata in secondi')}</td><td>${strutture(x)}</td></tr>`).join('')}</tbody>`).join('')}</table></div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">La revisione automatica può aggiornare questi valori in base ai tuoi voti.</p></div>`;
    const filtra = () => {
      const f = guidaFiltroTempo.trim().toLowerCase();
      corpo.querySelectorAll('tbody').forEach((t) => {
        const righe = [...t.querySelectorAll('tr[data-cerca]')];
        righe.forEach((r) => { r.style.display = r.dataset.cerca.includes(f) ? '' : 'none'; });
        t.style.display = righe.some((r) => r.style.display !== 'none') ? '' : 'none';
      });
    };
    filtra();
    $('#gFiltroTempo').oninput = (e) => { guidaFiltroTempo = e.target.value; filtra(); };
    corpo.querySelectorAll('input[data-campo]').forEach((i) => {
      i.onchange = () => salvaGuida({ campo: i.dataset.campo, categoria: i.dataset.genere, valore: i.value.trim() }, i.value.trim() ? 'Salvato' : 'Tornato al predefinito');
    });
    corpo.querySelectorAll('[data-struttura]').forEach((b) => {
      b.onclick = () => {
        const x = ctrl.generi.find((y) => y.nome === b.dataset.genere);
        const attuali = g.struttura_pref[x.nome] || x.strutture;
        const s = b.dataset.struttura;
        const valori = attuali.includes(s) ? attuali.filter((y) => y !== s) : attuali.concat(s);
        salvaGuida({ campo: 'struttura_pref', categoria: x.nome, valori }, valori.length ? 'Strutture aggiornate' : 'Tornato al predefinito');
      };
    });
  }

  function schedaNote() {
    const g = ctrl.guida;
    $('#gCorpo').innerHTML = `<div class="card" style="max-width:820px"><h2>Note per il sistema <small>lette dalla revisione automatica, che può riscriverle</small></h2>
      ${g.note.map((n, i) => `<div class="srv"><span style="font-size:13px">${esc(n)}</span><button class="btn small ghost" data-nota="${i}">Rimuovi</button></div>`).join('') || '<div class="empty">Nessuna nota.</div>'}
      <div class="addrow" style="margin-top:12px"><input class="field" id="in-note" placeholder="Scrivi una nota, per esempio: più pause tra le sezioni" aria-label="nuova nota" maxlength="300"><button class="btn small" id="gNotaVai" data-tip="La nota viene letta alla prossima revisione automatica.">Aggiungi</button></div>
      <p class="muted" style="font-size:12px;margin:12px 0 0">Per una richiesta su un solo genere usa <b>Note per genere</b>.</p></div>`;
    const salvaNote = (valori) => salvaGuida({ campo: 'note', valori }, 'Note aggiornate');
    $('#gCorpo').querySelectorAll('[data-nota]').forEach((b) => { b.onclick = () => salvaNote(g.note.filter((_, k) => k !== Number(b.dataset.nota))); });
    $('#gNotaVai').onclick = () => {
      const testo = $('#in-note').value.trim();
      if (!testo) return toast('Scrivi prima una nota', 'err');
      return salvaNote(g.note.concat([testo]));
    };
    $('#in-note').onkeydown = (e) => { if (e.key === 'Enter') $('#gNotaVai').click(); };
  }

  const vistaStorico = { sezione: '', q: '', quanti: 40 };
  const leggibile = (v) => (v === null || v === undefined ? 'predefinito'
    : Array.isArray(v) ? v.map(leggibile).join(', ') || 'vuoto'
      : typeof v === 'object' ? Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => k + ': ' + leggibile(x)).join(' · ') || 'vuoto'
        : typeof v === 'boolean' ? (v ? 'sì' : 'no') : String(v));
  // sostituisce i nomi interni dei generi con quelli leggibili
  const conNomi = (testo) => ctrl.generi.slice().sort((a, b) => b.nome.length - a.nome.length).reduce((t, g) => t.split(g.nome).join(g.etichetta), String(testo));
  function disegnaStorico() {
    const righe = ctrl.storico || [];
    if (!$('#sTbody')) {
      $('#c-storico').innerHTML = `
        <div class="toolbar">
          <select class="field" id="sSez" aria-label="Filtra per sezione"></select>
          <input class="search" id="sQ" type="search" placeholder="Cerca nello storico, per esempio un genere" aria-label="Cerca nello storico">
          <span class="conteggio" id="sConta"></span>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><div class="scroll"><table class="storico">
          <thead><tr><th>Quando</th><th>Sezione</th><th>Voce</th><th>Prima</th><th>Dopo</th></tr></thead><tbody id="sTbody"></tbody></table></div></div>
        <div style="margin-top:12px"><button class="btn small ghost" id="sAltri">Mostra altre 80</button></div>
        <p class="muted" style="font-size:12.5px;margin-top:10px">Sono registrate le modifiche fatte da questa pagina, con il valore precedente. Per tornare indietro, riporta il valore precedente dalla sezione corrispondente.</p>`;
      $('#sSez').onchange = (e) => { vistaStorico.sezione = e.target.value; disegnaStorico(); };
      $('#sQ').oninput = (e) => { vistaStorico.q = e.target.value; disegnaStorico(); };
      $('#sAltri').onclick = () => { vistaStorico.quanti += 80; disegnaStorico(); };
    }
    const sezioni = [...new Set(righe.map((r) => r.sezione))].sort();
    $('#sSez').innerHTML = '<option value="">Tutte le sezioni</option>' + sezioni.map((x) => `<option${x === vistaStorico.sezione ? ' selected' : ''}>${esc(x)}</option>`).join('');
    const q = vistaStorico.q.trim().toLowerCase();
    const lista = righe.map((r) => ({ ...r, voce: conNomi(r.chiave), a: leggibile(r.prima), b: leggibile(r.dopo) }))
      .filter((r) => (!vistaStorico.sezione || r.sezione === vistaStorico.sezione) && (!q || [r.sezione, r.voce, r.chiave, r.a, r.b].join(' ').toLowerCase().includes(q)));
    const breve = (t) => (t.length > 120 ? `<span data-tip="${esc(t.slice(0, 900))}" tabindex="0">${esc(t.slice(0, 117))}…</span>` : esc(t));
    $('#sConta').textContent = n0(lista.length) + ' di ' + n0(righe.length) + ' modifiche';
    $('#sAltri').hidden = lista.length <= vistaStorico.quanti;
    $('#sTbody').innerHTML = lista.slice(0, vistaStorico.quanti).map((r) => `<tr><td class="muted" style="white-space:nowrap">${data(r.ts)}</td><td><span class="tag">${esc(r.sezione)}</span></td><td>${esc(r.voce)}</td>
      <td class="valore muted">${breve(r.a)}</td><td class="valore">${breve(r.b)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nessuna modifica corrisponde.</td></tr>';
  }

  // Note per genere: istruzioni scritte dal produttore, tradotte in inglese e aggiunte allo stile
  function disegnaNote() {
    const generi = ctrl.generi;
    if (!noteGenere || !generi.find((g) => g.nome === noteGenere)) {
      const conNote = generi.find((g) => g.note.length);
      noteGenere = conNote ? conNote.nome : generi[0].nome;
    }
    const g = generi.find((x) => x.nome === noteGenere);
    const totNote = generi.reduce((a, x) => a + x.note.length, 0);
    $('#c-note').innerHTML = `
      <div class="grid">
        <div class="card c4">
          <h2>Generi <small>${n0(totNote)} note in totale</small></h2>
          <input class="search" id="nQ" type="search" placeholder="Cerca un genere…" aria-label="Cerca genere" style="width:100%;margin-bottom:10px">
          <div id="nLista" class="note-lista"></div>
        </div>
        <div class="card c8" id="nPannello"></div>
      </div>`;
    const disegnaLista = () => {
      const q = $('#nQ').value.trim().toLowerCase();
      $('#nLista').innerHTML = generi.filter((x) => (x.etichetta + ' ' + x.nome).toLowerCase().includes(q)).map((x) => `
        <button class="gvoce" data-ng="${esc(x.nome)}" aria-current="${x.nome === noteGenere}">
          <span>${esc(x.etichetta)}</span>${x.note.length ? `<em>${n0(x.note.length)}</em>` : ''}</button>`).join('');
      $('#nLista').querySelectorAll('button[data-ng]').forEach((b) => {
        b.onclick = () => { noteGenere = b.dataset.ng; disegnaNote(); };
      });
    };
    disegnaLista();
    $('#nQ').addEventListener('input', disegnaLista);
    const note = g.note;
    $('#nPannello').innerHTML = `
      <h2>${esc(g.etichetta)} <small><button class="link" data-stile="${esc(g.nome)}">modifica lo stile a blocchi</button></small></h2>
      <p class="muted" style="margin:0 0 14px;font-size:13px">Scrivi cosa vuoi sentire in questo genere, in italiano: per esempio <i>fai più assoli</i> oppure <i>usa il flauto di pan</i>. Il sistema la traduce in inglese e la aggiunge allo stile di ogni brano di questo genere.</p>
      <div style="display:grid;gap:8px;margin-bottom:16px">
        ${note.map((n, i) => `
          <div class="nota"><div><b>${esc(n.testo)}</b>
              <code class="${n.inglese ? '' : 'manca'}">${n.inglese ? esc(n.inglese) : 'traduzione non disponibile: verrà usata la versione in italiano'}</code>
              <small class="muted">${data(n.ts)}</small></div>
            <button class="btn small ghost" data-del="${i}">Elimina</button></div>`).join('') || '<div class="empty">Nessuna nota per questo genere.</div>'}
      </div>
      <div style="display:grid;gap:8px">
        <textarea class="field" id="nTxt" rows="3" maxlength="300" placeholder="Es.: più assoli di chitarra nel finale; usa il flauto di pan come melodia principale" style="resize:vertical;font:inherit"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="muted" style="font-size:12px">Massimo 300 caratteri · 20 note per genere</span>
          <button class="btn" id="nAdd">Aggiungi nota</button>
        </div>
      </div>`;
    $('#nAdd').onclick = async () => {
      const testo = $('#nTxt').value.trim();
      if (testo.length < 3) { toast('Scrivi una nota di almeno 3 caratteri', 'err'); return; }
      const b = $('#nAdd');
      b.disabled = true; b.textContent = 'Traduzione in corso…';
      try {
        const r = await invia('/api/controllo/nota', { nome: g.nome, testo });
        toast(r.tradotta ? 'Nota aggiunta e tradotta' : 'Nota aggiunta (traduzione non disponibile)', 'ok');
        await caricaControllo(true);
      } catch (e) {
        toast(e.message, 'err');
        b.disabled = false; b.textContent = 'Aggiungi nota';
      }
    };
    $('#nPannello').querySelectorAll('button[data-del]').forEach((b) => {
      b.onclick = async () => {
        const i = Number(b.dataset.del);
        if (await chiedi('Eliminare la nota?', `"${note[i].testo}" non verrà più usata nei brani di questo genere.`, 'Elimina')) {
          esegui(() => invia('/api/controllo/nota/rimuovi', { nome: g.nome, indice: i }), 'Nota eliminata');
        }
      };
    });
  }

  document.getElementById('csub').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    ctrlSub = b.dataset.s;
    history.replaceState(null, '', '#controllo/' + ctrlSub);
    disegnaControllo();
  });

  // ---------- ascolto e voto ----------
  // Il lettore e la nota non vengono toccati dagli aggiornamenti periodici: la coda si ricarica
  // solo aprendo la scheda, dopo un voto o cambiando filtro.
  // invio: un voto in corso (tasti doppi o tenuti premuti non votano due volte); caricato: prima lettura riuscita
  const vt = { coda: [], votati: [], filtro: '', cur: null, idx: 0, invio: false, caricato: false };
  const vLista = () => vt.coda.filter((b) => !vt.filtro || b.categoria === vt.filtro);

  function abilitaVoto() {
    const v = vt.cur ? vt.cur.voto : null;
    document.querySelectorAll('#vStelle button').forEach((x) => { x.setAttribute('aria-pressed', String(Number(x.dataset.v) === v)); x.disabled = !vt.cur; });
    $('#vSalta').disabled = !vt.cur;
  }

  function mostraBrano(b) {
    const audio = $('#vAudio');
    if (!b) {
      vt.cur = null;
      $('#vBrano').innerHTML = '<div class="empty">Hai votato tutto. I brani nuovi compaiono qui dopo circa 15 minuti.</div>';
      imposta('#vCop', '');
      audio.removeAttribute('src'); audio.load();
    } else if (!vt.cur || vt.cur.numero !== b.numero) {
      vt.cur = b;
      intestazioneBrano(b);
      audio.src = '/audio/brano?n=' + encodeURIComponent(b.numero);
      $('#vNotaTxt').value = b.nota || '';
    } else {
      // stesso brano: dati aggiornati, lettore fermo; la nota si aggiorna solo se non e' stata toccata
      if ($('#vNotaTxt').value === (vt.cur.nota || '')) $('#vNotaTxt').value = b.nota || '';
      vt.cur = b;
      intestazioneBrano(b);
    }
    abilitaVoto();
  }
  function intestazioneBrano(b) {
    imposta('#vCop', copertina(b));
    $('#vBrano').innerHTML = `<h3>${esc(b.titolo)}</h3><div class="sub">${esc([nm(b.categoria), sec(b.durata_s)].filter(Boolean).join(', '))}</div>
      <button class="link" data-info="${b.numero}">Scheda del brano</button>`;
  }

  function disegnaVotati() {
    $('#vVotati').innerHTML = vt.votati.map((b) => `<button class="vrow" data-n="${esc(b.numero)}"><span>${esc(b.titolo)}<br><small class="muted">${esc(nm(b.categoria))}${b.nota ? ' · ' + esc(b.nota) : ''}</small></span>${stelle(b.voto)}</button>`).join('')
      || '<div class="empty">Nessun brano votato.</div>';
  }

  // Filtro, titolo e brano corrente dalla coda in memoria
  function disegnaCoda() {
    const generi = [...new Set(vt.coda.map((b) => b.categoria).filter(Boolean))].sort();
    if (vt.filtro && !generi.includes(vt.filtro)) vt.filtro = '';
    $('#vFiltro').innerHTML = '<option value="">Tutti i generi</option>' + generi.map((g) => `<option value="${esc(g)}"${g === vt.filtro ? ' selected' : ''}>${esc(nm(g))} (${vt.coda.filter((b) => b.categoria === g).length})</option>`).join('');
    const lista = vLista();
    $('#vCodaTit').textContent = `Da votare (${lista.length})`;
    // il brano corrente resta se e' in coda (con il filtro) o se e' un votato in correzione;
    // altrimenti quello nella stessa posizione (il successivo)
    const c = vt.cur;
    const i = c ? lista.findIndex((b) => b.numero === c.numero) : -1;
    const correzione = c && i < 0 && (!vt.filtro || c.categoria === vt.filtro) && vt.votati.find((v) => v.numero === c.numero);
    if (i >= 0) vt.idx = i;
    else vt.idx = Math.max(0, Math.min(vt.idx, lista.length - 1));
    mostraBrano(i >= 0 ? lista[i] : correzione || lista[vt.idx] || null);
  }

  async function caricaVoti() {
    try {
      const r = await leggi('/api/voti', AbortSignal.timeout(15000));
      vt.coda = r.coda; vt.votati = r.votati; vt.caricato = true;
    } catch (e) {
      toast('Impossibile leggere i brani da votare: ' + e.message, 'err');
      if (!vt.caricato) { $('#vBrano').innerHTML = `<div class="err">Impossibile leggere i brani da votare: ${esc(e.message)}</div>`; abilitaVoto(); }
      return;
    }
    disegnaCoda();
    disegnaVotati();
    // brano chiesto dalla libreria
    if (vt.richiesto !== undefined) {
      const b = vt.coda.concat(vt.votati).find((x) => x.numero === vt.richiesto);
      delete vt.richiesto;
      if (b) { vt.cur = null; mostraBrano(b); } else toast('Il brano non è ancora votabile: attendi qualche minuto', 'err');
    }
  }

  async function votaBrano(voto) {
    const b = vt.cur;
    if (!b || vt.invio) return;
    vt.invio = true;
    try {
      const nota = $('#vNotaTxt').value.trim();
      const corpo = { numero: b.numero, voto };
      if (nota || b.nota) corpo.nota = nota; // nota vuota inviata solo per cancellarne una esistente
      try {
        await invia('/api/controllo/voto', corpo, AbortSignal.timeout(15000));
      } catch (e) { toast(e.name === 'TimeoutError' ? 'Il gateway non risponde: voto non confermato' : e.message, 'err'); return; }
      toast(`Voto ${voto} salvato: ${b.titolo}`);
      // aggiornamento locale subito, cosi' la scheda funziona anche se la rilettura fallisce
      vt.coda = vt.coda.filter((x) => x.numero !== b.numero);
      vt.votati = [{ ...b, voto, nota: corpo.nota ?? b.nota, voto_il: new Date().toISOString() }, ...vt.votati.filter((x) => x.numero !== b.numero)];
      // se nel frattempo e' stato scelto un altro brano (Salta, filtro, Votati ora) resta quello
      const avanti = vt.cur?.numero === b.numero; // l'oggetto puo' essere stato sostituito da una rilettura
      if (avanti) vt.cur = null;
      disegnaCoda();
      disegnaVotati();
      if (avanti && vt.cur) $('#vAudio').play().catch(() => {});
      await caricaVoti();
    } finally { vt.invio = false; }
  }

  $('#vStelle').addEventListener('click', (e) => {
    const x = e.target.closest('button[data-v]');
    if (x) votaBrano(Number(x.dataset.v));
  });
  // Invio tenuto premuto su una stella non ripete il clic
  $('#vStelle').addEventListener('keydown', (e) => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });
  $('#vAudio').addEventListener('error', (e) => {
    if (e.target.getAttribute('src')) toast('Impossibile riprodurre il brano' + (vt.cur ? ': ' + vt.cur.titolo : ''), 'err');
  });
  $('#vSalta').addEventListener('click', () => {
    const lista = vLista();
    if (!lista.length) return;
    const i = lista.findIndex((b) => vt.cur && b.numero === vt.cur.numero);
    vt.idx = (i + 1) % lista.length; // da un brano gia' votato si torna alla coda
    mostraBrano(lista[vt.idx]);
  });
  $('#vFiltro').addEventListener('change', (e) => { vt.filtro = e.target.value; vt.idx = 0; caricaVoti(); });
  $('#vVotati').addEventListener('click', (e) => {
    const x = e.target.closest('button[data-n]');
    const b = x && vt.votati.find((v) => String(v.numero) === x.dataset.n);
    if (!b) return;
    mostraBrano(b);
    const audio = $('#vAudio');
    audio.scrollIntoView({ block: 'center' });
    audio.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    const tasto = e.key.toLowerCase();
    if (!/^[1-5s ]$/.test(tasto) || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (!$('#t-voti').classList.contains('on') || !$('#modal').hidden) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if (tasto === ' ' && t.closest && t.closest('button, audio, [role="button"]')) return; // Spazio preme il controllo a fuoco
    e.preventDefault();
    if (tasto === 's') { $('#vSalta').click(); return; }
    if (tasto === ' ') { const au = $('#vAudio'); if (au.paused) au.play().catch(() => {}); else au.pause(); return; }
    votaBrano(Number(tasto));
  });

  // ---------- lettore comune ----------
  const lettore = { coda: [], brano: null };
  const evidenza = document.head.appendChild(document.createElement('style')); // segna la copertina del brano in ascolto
  const trovaBrano = (n) => dati && dati.libreria.recenti.find((x) => x.numero === n);
  const orologio = (s) => (Number.isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');
  const stelleVoto = (voto, attr) => [1, 2, 3, 4, 5].map((v) => `<button type="button" ${attr}="${v}" class="${voto >= v ? 'on' : ''}" aria-label="Voto ${v} su 5" aria-pressed="${voto === v}">★</button>`).join('');

  async function suona(n) {
    let b = trovaBrano(n);
    if (!b) { try { b = await leggi('/api/brano?n=' + n); } catch (e) { toast('Brano non trovato', 'err'); return; } }
    lettore.brano = b;
    const au = $('#pAudio');
    au.src = '/audio/brano?n=' + encodeURIComponent(n);
    $('#player').hidden = false;
    document.body.classList.add('suona');
    evidenza.textContent = `[data-ascolta="${n}"] > .ic { opacity: 1; background: var(--accent); }`;
    au.play().catch(() => {});
    disegnaLettore();
  }
  // il pulsante di una copertina: gli altri brani dello stesso elenco diventano la coda
  function ascolta(el) {
    const n = Number(el.dataset.ascolta);
    if (lettore.brano && lettore.brano.numero === n) return $('#pPlay').click();
    const elenco = el.closest('[data-coda]');
    lettore.coda = elenco ? [...new Set([...elenco.querySelectorAll('[data-ascolta]')].map((x) => Number(x.dataset.ascolta)))] : [n];
    return suona(n);
  }
  function disegnaLettore() {
    const b = lettore.brano;
    if (!b) return;
    imposta('#pCop', copertina(b));
    $('#pTit').textContent = b.titolo;
    $('#pSub').textContent = nm(b.categoria);
    imposta('#pStelle', stelleVoto(b.voto, 'data-pvoto'));
    const i = lettore.coda.indexOf(b.numero);
    $('#pPrima').disabled = i <= 0;
    $('#pDopo').disabled = i < 0 || i >= lettore.coda.length - 1;
  }
  function passo(d) {
    const i = lettore.coda.indexOf(lettore.brano && lettore.brano.numero) + d;
    if (i >= 0 && i < lettore.coda.length) suona(lettore.coda[i]);
  }
  // voto dal lettore o dalla scheda
  async function votaDa(b, voto) {
    try { await invia('/api/controllo/voto', { numero: b.numero, voto }, AbortSignal.timeout(15000)); }
    catch (e) { toast(e.name === 'TimeoutError' ? 'Il gateway non risponde: voto non confermato' : e.message, 'err'); return false; }
    toast(`Voto ${voto} salvato: ${b.titolo}`);
    b.voto = voto;
    const t = trovaBrano(b.numero);
    if (t) { t.voto = voto; t.voto_il = new Date().toISOString(); }
    if (lettore.brano && lettore.brano.numero === b.numero) lettore.brano.voto = voto;
    disegnaLettore();
    disegnaLibreria();
    disegnaAvvisi();
    if ($('#t-voti').classList.contains('on')) caricaVoti();
    return true;
  }
  {
    const au = $('#pAudio'), barra = $('#pBarra'), vol = $('#pVol');
    const tasto = () => { $('#pPlay').innerHTML = ic(au.paused ? 'play' : 'pausa'); $('#pPlay').setAttribute('aria-label', au.paused ? 'Ascolta' : 'Metti in pausa l\'ascolto'); };
    au.addEventListener('play', () => { $('#vAudio').pause(); tasto(); });
    au.addEventListener('pause', tasto);
    au.addEventListener('ended', () => passo(1));
    au.addEventListener('durationchange', () => { $('#pFine').textContent = orologio(au.duration); });
    au.addEventListener('timeupdate', () => {
      $('#pOra').textContent = orologio(au.currentTime);
      const p = au.duration ? au.currentTime / au.duration : 0;
      barra.value = Math.round(p * 1000);
      barra.style.setProperty('--p', p * 100 + '%');
    });
    au.addEventListener('error', () => { if (au.getAttribute('src')) toast('Impossibile riprodurre il brano', 'err'); });
    barra.style.setProperty('--p', '0%');
    barra.oninput = () => { if (au.duration) au.currentTime = barra.value / 1000 * au.duration; };
    try { const v = Number(localStorage.getItem('volume')); if (v > 0 && v <= 100) vol.value = v; } catch (e) { /* volume pieno */ }
    au.volume = vol.value / 100;
    alPasso(vol);
    vol.oninput = () => { au.volume = vol.value / 100; alPasso(vol); try { localStorage.setItem('volume', vol.value); } catch (e) { /* solo per questa visita */ } };
    $('#pPlay').onclick = () => { if (au.paused) au.play().catch(() => {}); else au.pause(); };
    $('#pPrima').onclick = () => passo(-1);
    $('#pDopo').onclick = () => passo(1);
    $('#pInfo').onclick = () => lettore.brano && apriScheda(lettore.brano.numero);
    $('#pStelle').addEventListener('click', (e) => { const x = e.target.closest('[data-pvoto]'); if (x && lettore.brano) votaDa(lettore.brano, Number(x.dataset.pvoto)); });
    $('#pChiudi').onclick = () => { au.pause(); au.removeAttribute('src'); au.load(); lettore.brano = null; evidenza.textContent = ''; $('#player').hidden = true; document.body.classList.remove('suona'); };
    $('#vAudio').addEventListener('play', () => au.pause());
  }

  // ---------- scheda del brano ----------
  let schedaAperta = null;
  const FONTE_SPARTITO = { modello: 'il modello musicale', compositore: 'il compositore del progetto', motore: 'il motore, durante il render' };
  async function apriScheda(n) {
    const d = $('#scheda');
    d.innerHTML = '<div class="s-corpo"><div class="empty">Caricamento…</div></div>';
    if (!d.open) d.showModal();
    let b;
    try { b = await leggi('/api/brano?n=' + n, AbortSignal.timeout(15000)); }
    catch (e) { d.innerHTML = `<div class="s-corpo"><div class="s-chiudi"><button class="btn small ghost" data-chiudi>Chiudi</button></div><div class="err">Impossibile leggere la scheda: ${esc(e.message)}</div></div>`; return; }
    schedaAperta = b;
    disegnaScheda();
  }
  function disegnaScheda() {
    const b = schedaAperta;
    const riga = (k, v) => (v === null || v === undefined || v === '' ? '' : `<span>${k}</span><span>${esc(v)}</span>`);
    const q = b.qualita;
    $('#scheda').innerHTML = `<div class="s-corpo">
      <div class="s-chiudi"><button class="btn small ghost" data-chiudi aria-label="Chiudi la scheda">${ic('x')} Chiudi</button></div>
      ${copertina(b, 'grande')}
      <h2 id="sTitolo">${esc(b.titolo)}</h2><div class="sub">${esc(nm(b.categoria))}${b.variante ? ', variante ' + esc(b.variante) : ''}</div>
      ${b.descrizione ? `<p>${esc(b.descrizione)}</p>` : ''}
      <div class="stelle-mini" role="group" aria-label="Voto" data-svoti>${stelleVoto(b.voto, 'data-svoto')}</div>
      ${b.nota ? `<p class="muted">Nota: ${esc(b.nota)}</p>` : ''}
      <div class="s-azioni"><button class="btn" data-ascolta="${b.numero}">${ic('play')} Ascolta</button>
        ${b.file ? `<a class="btn ghost" href="/audio/brano?n=${b.numero}&amp;scarica=1" download>Scarica il file</a>` : ''}
        <button class="btn ghost" data-produci="${esc(b.categoria)}">Un altro così</button>
        <button class="btn ghost" data-stile="${esc(b.categoria)}">Stile del genere</button></div>
      <h3>Musica</h3><div class="kv">${riga('Durata', sec(b.durata_s))}${riga('Velocità', b.bpm ? b.bpm + ' bpm' : '')}${riga('Tonalità', b.tonalita)}${riga('Energia', b.energia ? b.energia + ' su 5' : '')}
        ${riga('Struttura', b.struttura)}${riga('Strumenti', b.strumenti.join(', '))}${riga('Influenza', b.influenza)}${riga('Adatto a', b.attivita)}</div>
      ${b.sezioni.length ? `<h3>Sezioni</h3><div>${b.sezioni.map((x) => `<span class="tag">${esc(x.replace(/[\[\]]/g, ''))}</span>`).join('')}</div>` : ''}
      ${b.stile ? `<h3>Descrizione inviata al motore <button class="link" data-copia>Copia</button></h3><div class="prompt">${esc(b.stile)}</div>` : ''}
      <h3>Produzione</h3><div class="kv">${riga('Numero', b.numero)}${riga('Creato', data(b.generato_il))}${riga('Tempo di render', b.render_s ? sec(b.render_s) : '')}
        ${riga('Spartito scritto da', FONTE_SPARTITO[b.score_fonte])}${riga('Controllo qualità', q ? (q.esito === 'ok' ? 'superato' : q.problemi.join('; ')) : '')}
        ${riga('Bitrate', q && q.bitrate ? q.bitrate + ' kbps' : '')}${riga('iBroadcast', b.caricato ? 'caricato' : 'non ancora caricato')}${riga('Ascolti', b.ascolti)}${riga('LoRA', b.lora.join(', '))}</div>
      ${b.file ? `<h3>File</h3><div class="s-percorso">${esc(b.file)}</div>` : ''}</div>`;
  }
  $('#scheda').addEventListener('click', async (e) => {
    const d = $('#scheda');
    if (e.target === d || e.target.closest('[data-chiudi]')) return d.close();
    const v = e.target.closest('[data-svoto]');
    if (v && await votaDa(schedaAperta, Number(v.dataset.svoto))) disegnaScheda();
    if (e.target.closest('[data-copia]')) navigator.clipboard.writeText(schedaAperta.stile).then(() => { e.target.textContent = 'Copiata'; }, () => { e.target.textContent = 'Copia non consentita'; });
  });

  // ---------- andamento ----------
  const quandoPunto = (iso, passo) => new Date(iso).toLocaleString('it-IT', passo === 'ora' ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' });
  const virgola = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));
  const conUnita = (u) => (v) => (v === null || v === undefined ? '—' : virgola(v) + u);

  // Cornice comune dei grafici nel tempo: griglia, date e modifiche (una linea per intervallo)
  function telaio(punti, modifiche, opz, min, max, x0, x1, w) {
    const { passo = 'giorno', formato = virgola } = opz;
    const h = 200, pad = { l: 40, r: 14, t: 14, b: 26 };
    const t0 = Date.parse(punti[0].da), t1 = Date.parse(punti[punti.length - 1].da);
    const x = (t) => t1 > t0 ? x0 + ((t - t0) / (t1 - t0)) * (x1 - x0) : (x0 + x1) / 2;
    const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min));
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4, yy = y(v);
      g += `<line class="gridline" x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${pad.l - 8}" y="${yy + 3}" text-anchor="end">${esc(formato(Math.round(v * 10) / 10))}</text>`;
    }
    const tacche = [...new Set([0, Math.floor((punti.length - 1) / 2), punti.length - 1])];
    g += tacche.map((i) => `<text class="axis" x="${x(Date.parse(punti[i].da))}" y="${h - 8}" text-anchor="middle">${esc(quandoPunto(punti[i].da, passo))}</text>`).join('');
    const gruppi = new Map();
    for (const m of modifiche) {
      let i = punti.length - 1;
      while (i > 0 && Date.parse(punti[i].da) > Date.parse(m.ts)) i--;
      if (!gruppi.has(i)) gruppi.set(i, []);
      gruppi.get(i).push(data(m.ts) + ' · ' + m.sezione + ': ' + m.chiave);
    }
    g += [...gruppi].map(([i, voci]) => {
      const xx = x(Date.parse(punti[i].da)).toFixed(1);
      const testo = voci.slice(0, 8).join('\n') + (voci.length > 8 ? '\n… e altre ' + (voci.length - 8) : '');
      return `<g><title>${esc(testo)}</title><line x1="${xx}" x2="${xx}" y1="${pad.t}" y2="${h - pad.b}" stroke="var(--warn)" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/><line x1="${xx}" x2="${xx}" y1="${pad.t}" y2="${h - pad.b}" stroke="transparent" stroke-width="8"/></g>`;
    }).join('');
    return { w, h, pad, x, y, g };
  }
  const svg = (t, titolo, corpo) => `<svg class="chart" viewBox="0 0 ${t.w} ${t.h}" role="img" aria-label="${esc(titolo)} nel tempo">${t.g}${corpo}</svg>`;
  const tetto = (valori, min, intero) => { const alto = Math.max(...valori, min + 1) * 1.1; return intero ? Math.ceil(alto / 4) * 4 : alto; };

  // Grafico a linea nel tempo: la linea si interrompe sui valori mancanti
  function lineaTempo(punti, modifiche, campo, opz = {}) {
    const { passo = 'giorno', min = 0, maxFisso = null, formato = virgola, vuoto = () => false, dettaglio = () => '' } = opz;
    const validi = punti.filter((p) => p[campo] !== null);
    if (!validi.length) return '<div class="empty">Nessun dato nel periodo</div>';
    const max = maxFisso ?? tetto(validi.map((p) => p[campo]), min, opz.intero); // conteggi: tacche intere
    const t = telaio(punti, modifiche, opz, min, max, 40, 626, 640);
    let d = '', aperto = false;
    for (const p of punti) {
      if (p[campo] === null) { aperto = false; continue; }
      d += (aperto ? 'L' : 'M') + t.x(Date.parse(p.da)).toFixed(1) + ' ' + t.y(p[campo]).toFixed(1) + ' ';
      aperto = true;
    }
    const fitto = punti.length > 60;
    const dots = validi.map((p) => {
      const cx = t.x(Date.parse(p.da)).toFixed(1), cy = t.y(p[campo]).toFixed(1);
      return `<g><title>${esc(quandoPunto(p.da, passo) + ': ' + formato(p[campo]) + dettaglio(p))}</title><circle cx="${cx}" cy="${cy}" r="${fitto ? 5 : 10}" fill="transparent"/><circle cx="${cx}" cy="${cy}" r="${fitto ? 2 : 4}" fill="${vuoto(p) ? 'var(--panel)' : 'var(--s1)'}" stroke="var(--s1)" stroke-width="${fitto ? 1.5 : 2}"/></g>`;
    }).join('');
    return svg(t, opz.titolo, `<path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`);
  }

  // Barre impilate a tutta larghezza: accettati in basso, scartati sopra
  function barreTempo(punti, modifiche, passo) {
    if (!punti.some((p) => p.brani)) return '<div class="empty">Nessun brano nel periodo</div>';
    const w = 1280, spazio = (w - 54) / punti.length, larga = Math.min(Math.max(spazio - 2, 1), 40);
    const t = telaio(punti, modifiche, { passo }, 0, tetto(punti.map((p) => p.brani), 0, true), 40 + spazio / 2, w - 14 - spazio / 2, w);
    const rettangoli = punti.map((p) => {
      if (!p.brani) return '';
      const x = (t.x(Date.parse(p.da)) - larga / 2).toFixed(1), base = t.y(0), a = t.y(p.accettati), s = t.y(p.brani);
      return `<g><title>${esc(quandoPunto(p.da, passo) + ': ' + p.accettati + ' accettati, ' + p.scartati + ' scartati')}</title>` +
        (p.accettati ? `<rect x="${x}" y="${a}" width="${larga}" height="${base - a}" rx="2" fill="var(--s1)"/>` : '') +
        (p.scartati ? `<rect x="${x}" y="${s}" width="${larga}" height="${Math.max(a - s - (p.accettati ? 2 : 0), 1)}" rx="2" fill="var(--s2)"/>` : '') + '</g>';
    }).join('');
    return svg(t, 'Brani generati', rettangoli) + '<div class="legenda"><span><i class="dot" style="background:var(--s1)"></i>Accettati</span><span><i class="dot" style="background:var(--s2)"></i>Scartati</span></div>';
  }

  // [campo, nome, formato, verso: 1 alto è meglio, -1 basso è meglio, 0 neutro, unità della differenza]
  const INDICI = [
    ['brani', 'Brani generati', n0, 0, ''],
    ['ore', 'Ore di musica buona', conUnita(' h'), 0, ' h'],
    ['scartoPct', 'Brani scartati', conUnita('%'), -1, ' punti'],
    ['voto', 'Voto medio', virgola, 1, ''],
    ['coperturaPct', 'Brani votati', conUnita('%'), 1, ' punti'],
    ['resa', 'Render per secondo di musica buona', conUnita(' s'), -1, ' s'],
    ['renderMedio', 'Render medio per brano', conUnita(' s'), -1, ' s'],
    ['rigeneratiPct', 'Brani rigenerati', conUnita('%'), -1, ' punti'],
    ['durataPct', 'Durata ottenuta sulla richiesta', conUnita('%'), 0, ' punti'],
    ['caricatiPct', 'Caricati su iBroadcast', conUnita('%'), 1, ' punti'],
    ['ascolti', 'Ascolti dei brani del periodo', n0, 0, ''],
    ['errori', 'Errori', n0, -1, ''],
  ];
  function indiciHtml(adesso, prima) {
    return INDICI.map(([c, nome, formato, verso, unita]) => {
      let sotto = c === 'voto' && adesso.votati ? 'su ' + adesso.votati + ' voti' : '', classe = '';
      if (prima && adesso[c] !== null && prima[c] !== null) {
        const d = Math.round((adesso[c] - prima[c]) * 100) / 100;
        if (d && verso) classe = d * verso > 0 ? 'su' : 'giu';
        sotto = (sotto ? sotto + ' · ' : '') + (d ? (d > 0 ? '↑ +' : '↓ ') + virgola(d) + unita : '→ invariato');
      }
      return `<div><small>${nome}</small><b>${esc(formato(adesso[c]))}</b><em class="${classe}">${esc(sotto)}</em></div>`;
    }).join('');
  }

  const COL_GENERI = [['genere', 'Genere', String], ['brani', 'Brani', n0], ['scartoPct', 'Scartati', conUnita('%')], ['voto', 'Voto', virgola], ['votati', 'Voti', n0], ['resa', 'Resa', virgola], ['renderMedio', 'Render (s)', virgola], ['rigeneratiPct', 'Rigenerati', conUnita('%')], ['ore', 'Ore', virgola], ['ascolti', 'Ascolti', n0]];
  const ESITI = { migliora: ['↑', 'var(--ok)'], stabile: ['→', 'var(--muted)'], peggiora: ['↓', 'var(--danger)'], 'dati insufficienti': ['–', 'var(--faint)'] };
  const AN_FILTRI = { ambito: 'aAmbito', famiglia: 'aFamiglia', genere: 'aGenere', tipo: 'aTipo', struttura: 'aStruttura' };
  const an = { richiesta: 0, dati: null, ordine: 'brani', verso: -1 };

  function disegnaGeneriAn() {
    const righe = [...an.dati.perGenere].sort((a, b) => {
      const x = a[an.ordine], y = b[an.ordine];
      if (x === null || y === null) return (x === null) - (y === null); // i valori mancanti in fondo
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * an.verso;
    });
    const freccia = (c) => (an.ordine === c ? (an.verso > 0 ? ' ↑' : ' ↓') : '');
    $('#aGeneri').innerHTML = !righe.length ? '<div class="empty">Nessun brano nel periodo</div>' : '<table class="an-gen"><thead><tr>' +
      COL_GENERI.map(([c, nome]) => `<th${an.ordine === c ? ` aria-sort="${an.verso > 0 ? 'ascending' : 'descending'}"` : ''} class="${c === 'genere' ? '' : 'num'}"><button type="button" data-ordina="${c}">${nome}${freccia(c)}</button></th>`).join('') + '</tr></thead><tbody>' +
      righe.map((r) => '<tr>' + COL_GENERI.map(([c, , formato]) => c === 'genere'
        ? `<td><button type="button" data-genere="${esc(r.genere)}">${esc(nm(r.genere))}</button></td>`
        : `<td class="num">${esc(formato(r[c]))}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
  }

  function disegnaAndamento() {
    const r = an.dati;
    const voce = (nome, esito) => { const [segno, c] = ESITI[esito] || ESITI['dati insufficienti']; return `<div><i style="color:${c}" aria-hidden="true">${segno}</i>${nome}: <b>${esc(esito)}</b></div>`; };
    $('#aEsito').innerHTML = voce('Voto', r.esito.voto) + voce('Scarti', r.esito.scarti);
    const filtrato = Object.values(AN_FILTRI).some((id) => $('#' + id).value);
    $('#aNota').textContent = 'Passo ' + (r.passo === 'ora' ? 'per ora' : 'per giorno') +
      ($('#aPasso').value && $('#aPasso').value !== r.passo ? ' (oltre 7 giorni i punti per ora non sono disponibili)' : '') +
      (r.troncato ? ' · i grafici mostrano solo gli intervalli più recenti, gli indici coprono tutto il periodo' : '') +
      (filtrato ? ' · i filtri su ambito, famiglia, genere, tipo e struttura non si applicano agli errori' : '');
    $('#aConfronto').textContent = r.precedente ? 'variazione sul periodo precedente di pari durata' : $('#aPeriodo').value ? 'nessun dato nel periodo precedente per il confronto' : 'tutto lo storico';
    $('#aKpi').innerHTML = indiciHtml(r.riepilogo, r.precedente);

    const p = r.punti, passo = r.passo, m = $('#aModifiche').checked ? r.modifiche : [];
    $('#aProduzione').innerHTML = barreTempo(p, m, passo);
    const linea = (id, campo, titolo, opz = {}) => { $(id).innerHTML = lineaTempo(p, m, campo, { titolo, passo, dettaglio: (x) => ` (${x.brani} brani)`, ...opz }); };
    linea('#aVoto', 'voto', 'Voto medio', { min: 1, maxFisso: 5, vuoto: (x) => x.votati < 5, dettaglio: (x) => ` (${x.votati} voti)` });
    linea('#aScarti', 'scartoPct', 'Brani scartati', { maxFisso: 100, formato: conUnita('%'), dettaglio: (x) => ` (${x.scartati} su ${x.brani})` });
    linea('#aResa', 'resa', 'Secondi di render per secondo di musica buona');
    linea('#aRender', 'renderMedio', 'Render medio per brano', { intero: true });
    linea('#aRigenerati', 'rigeneratiPct', 'Brani rigenerati', { maxFisso: 100, formato: conUnita('%') });
    linea('#aDurata', 'durataPct', 'Durata ottenuta sulla richiesta', { formato: conUnita('%') });
    linea('#aOre', 'ore', 'Ore di musica buona');
    linea('#aErrori', 'errori', 'Errori', { intero: true, dettaglio: () => '' });

    $('#aDistribuzione').innerHTML = r.distribuzione.some(Boolean)
      ? barre(r.distribuzione.map((n, i) => ({ etichetta: (i + 1) + '★', valore: n })), { h: 220 })
      : '<div class="empty">Nessun voto nel periodo</div>';
    $('#aMotivi').innerHTML = barreOrizz(r.motivi);
    $('#aErroriTop').innerHTML = barreOrizz(r.erroriTop);
    disegnaGeneriAn();

    $('#aModTitolo').textContent = 'Modifiche nel periodo (' + r.modifiche.length + ')';
    $('#aModElenco').innerHTML = r.modifiche.length ? '<table><tbody>' + [...r.modifiche].reverse().map((x) => `<tr><td>${esc(data(x.ts))}</td><td>${esc(x.sezione)}</td><td>${esc(x.chiave)}</td></tr>`).join('') + '</tbody></table>' : '<div class="empty">Nessuna modifica</div>';
    const col = [['accettati', 'Accettati'], ['scartati', 'Scartati'], ['voto', 'Voto'], ['resa', 'Resa'], ['renderMedio', 'Render (s)'], ['rigeneratiPct', 'Rigen. %'], ['durataPct', 'Durata %'], ['ore', 'Ore'], ['errori', 'Errori']];
    const pieni = p.filter((x) => x.brani || x.errori).reverse();
    $('#aTabella').innerHTML = pieni.length ? '<table><thead><tr><th>Intervallo</th>' + col.map(([, n]) => `<th class="num">${n}</th>`).join('') + '</tr></thead><tbody>' +
      pieni.map((x) => `<tr><td>${esc(quandoPunto(x.da, passo))}</td>` + col.map(([c]) => `<td class="num">${esc(virgola(x[c]))}</td>`).join('') + '</tr>').join('') + '</tbody></table>' : '<div class="empty">Nessun dato</div>';
  }

  function menuAndamento(opzioni) {
    for (const [campo, id] of Object.entries(AN_FILTRI)) {
      const sel = $('#' + id), scelto = sel.value;
      const valori = scelto && !opzioni[campo].includes(scelto) ? [...opzioni[campo], scelto] : opzioni[campo];
      // si ridisegna solo se cambia, così un menu aperto non si richiude a ogni aggiornamento
      if (sel.dataset.voci === valori.join('|')) continue;
      sel.dataset.voci = valori.join('|');
      sel.innerHTML = sel.options[0].outerHTML + valori.map((v) => `<option value="${esc(v)}">${esc(campo === 'genere' ? nm(v) : v)}</option>`).join('');
      sel.value = scelto;
    }
  }

  async function caricaAndamento() {
    const n = ++an.richiesta;
    const q = new URLSearchParams({ periodo: $('#aPeriodo').value, passo: $('#aPasso').value });
    for (const [campo, id] of Object.entries(AN_FILTRI)) if ($('#' + id).value) q.set(campo, $('#' + id).value);
    let r;
    try { r = await leggi('/api/andamento?' + q); }
    catch (e) { if (n === an.richiesta) $('#aEsito').innerHTML = '<span class="err">Impossibile leggere l\'andamento: ' + esc(e.message) + '</span>'; return; }
    if (n !== an.richiesta) return; // è già partita una richiesta più recente
    if (!r.riepilogo) { $('#aEsito').innerHTML = '<span class="err">Il gateway è di una versione precedente: va riavviato</span>'; return; }
    an.dati = r;
    menuAndamento(r.opzioni);
    disegnaAndamento();
  }
  for (const id of ['aPeriodo', 'aPasso', 'aGenere', 'aTipo', 'aStruttura']) $('#' + id).addEventListener('change', caricaAndamento);
  // cambiando ambito o famiglia le scelte più strette non valgono più
  $('#aAmbito').addEventListener('change', () => { $('#aFamiglia').value = $('#aGenere').value = ''; caricaAndamento(); });
  $('#aFamiglia').addEventListener('change', () => { $('#aGenere').value = ''; caricaAndamento(); });
  $('#aModifiche').addEventListener('change', () => { if (an.dati) disegnaAndamento(); });
  $('#aAzzera').addEventListener('click', () => {
    for (const id of Object.values(AN_FILTRI)) $('#' + id).value = '';
    $('#aPeriodo').value = '7'; $('#aPasso').value = ''; $('#aModifiche').checked = true;
    caricaAndamento();
  });
  $('#aGeneri').addEventListener('click', (e) => {
    const o = e.target.closest('button[data-ordina]'), g = e.target.closest('button[data-genere]');
    if (o) {
      const c = o.dataset.ordina;
      an.verso = an.ordine === c ? -an.verso : c === 'genere' ? 1 : -1;
      an.ordine = c;
      disegnaGeneriAn();
      $('#aGeneri').querySelector(`[data-ordina="${c}"]`).focus({ preventScroll: true });
    } else if (g) { $('#aGenere').value = g.dataset.genere; caricaAndamento(); }
  });
  setInterval(() => { if ($('#t-andamento').classList.contains('on')) caricaAndamento(); }, 30000);

  // ---------- navigazione ----------
  const TITOLI = { panoramica: 'Panoramica', libreria: 'Libreria', voti: 'Voti', generi: 'Generi', controllo: 'Controllo', andamento: 'Andamento', qualita: 'Qualità e tempi', log: 'Log e sistema' };
  function vai(indirizzo) {
    const parti = String(indirizzo || '').split('/');
    let tab = parti[0];
    // indirizzi della versione precedente salvati tra i preferiti
    if (tab === 'render') tab = 'qualita';
    if (tab === 'controllo' && parti[1] === 'generi') { tab = 'generi'; parti[1] = 'pesi'; }
    if (tab === 'controllo' && CTRL_SEZIONI.includes(parti[1])) ctrlSub = parti[1]; // es. #controllo/note
    if (parti[1] === 'guida') apriGuida(parti[2]); // es. #controllo/guida/tempo oppure /guida/Metal
    if (!TITOLI[tab]) tab = 'panoramica';
    document.querySelectorAll('section.tab').forEach((s) => s.classList.toggle('on', s.id === 't-' + tab));
    document.querySelectorAll('#nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    $('#titolo').textContent = TITOLI[tab];
    document.title = TITOLI[tab] + ' · Officina Sonora';
    const corrente = document.querySelector('#nav button[aria-current="page"]');
    const nav = $('#nav');
    if (corrente && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = corrente.offsetLeft - nav.clientWidth / 2;
    const hash = tab === 'controllo' ? (ctrlSub === 'guida' ? indirizzoGuida() : '#controllo/' + ctrlSub) : tab === 'generi' && parti[1] === 'pesi' ? '#generi/pesi' : '#' + tab;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (tab === 'controllo') caricaControllo();
    if (tab === 'generi') mostraVistaGeneri(parti[1]);
    if (tab === 'voti') caricaVoti(); else $('#vAudio').pause();
    if (tab === 'andamento') caricaAndamento();
  }
  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) vai(b.dataset.tab);
  });
  $('#gFam').addEventListener('change', (e) => { filtro.famiglia = e.target.value; renderGeneri(); });
  $('#q').addEventListener('input', (e) => { filtro.q = e.target.value; renderGeneri(); });
  // azioni presenti in piu' pagine
  async function produci(g) {
    if (!(await chiedi('Produrre questo genere?', 'Il prossimo brano sarà di ' + nm(g) + '. La richiesta vale una sola volta.', 'Produci', 'sicuro'))) return;
    try { await invia('/api/controllo/comando', { azione: 'produci', genere: g }); toast('Richiesto: ' + nm(g)); aggiornaStato(); } catch (x) { toast(x.message, 'err'); }
  }
  async function cambiaPausa(pausa) {
    try {
      await invia('/api/controllo/comando', { azione: pausa ? 'pausa' : 'riprendi' });
      toast(pausa ? 'Produzione in pausa: il brano in corso finisce' : 'Produzione ripresa');
    } catch (x) { toast(x.message, 'err'); }
    await aggiornaStato();
    if ($('#t-controllo').classList.contains('on')) caricaControllo(true);
  }
  $('#bProd').onclick = () => cambiaPausa(!(statoUltimo && inPausa(statoUltimo)));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vai], [data-ascolta], [data-info], [data-vota], [data-stile], [data-produci], [data-brani], [data-riprendi]');
    if (!$('#sistema').contains(e.target)) $('#sistema').open = false;
    if (!b) return;
    if (b.dataset.ascolta) return ascolta(b);
    if (b.dataset.info) return apriScheda(Number(b.dataset.info));
    if (b.closest('#scheda')) $('#scheda').close();
    if (b.dataset.vai) return vai(b.dataset.vai);
    if (b.dataset.vota) { vt.richiesto = Number(b.dataset.vota); vt.filtro = ''; return vai('voti'); }
    if (b.dataset.stile) { apriGuida(encodeURIComponent(b.dataset.stile)); return vai('controllo/guida/' + encodeURIComponent(b.dataset.stile)); }
    if (b.dataset.brani) { lib.genere = b.dataset.brani; lib.ambito = lib.voto = lib.q = ''; $('#lQ').value = $('#lVotoF').value = ''; disegnaLibreria(); return vai('libreria'); }
    if ('riprendi' in b.dataset) return cambiaPausa(false);
    return produci(b.dataset.produci);
  });
  document.addEventListener('keydown', (e) => {
    const campo = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (campo || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === '/') { e.preventDefault(); vai('libreria'); $('#lQ').focus(); return; }
    // lettore comune: spazio e frecce (nella pagina Voti valgono i suoi comandi)
    if ($('#player').hidden || $('#t-voti').classList.contains('on') || $('#scheda').open || !$('#modal').hidden) return;
    if (e.key === ' ' && !e.target.closest('button, summary, a')) { e.preventDefault(); $('#pPlay').click(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const au = $('#pAudio'); au.currentTime = Math.max(0, au.currentTime + (e.key === 'ArrowLeft' ? -10 : 10)); }
  });
  // menu laterale: intero o a sole icone (con il nome nel suggerimento)
  function menu(stretto) {
    if (stretto) document.documentElement.dataset.menu = 'stretto'; else delete document.documentElement.dataset.menu;
    document.querySelectorAll('#nav button').forEach((b) => { if (stretto) b.dataset.tip = b.firstChild.nextSibling.textContent.trim(); else delete b.dataset.tip; });
    const b = $('#bMenu'), testo = stretto ? 'Allarga il menu' : 'Riduci il menu';
    b.setAttribute('aria-expanded', String(!stretto));
    b.querySelector('span').textContent = testo;
    if (stretto) b.dataset.tip = testo; else delete b.dataset.tip;
  }
  $('#bMenu').onclick = () => {
    const stretto = !document.documentElement.dataset.menu;
    nascondiTip();
    menu(stretto);
    try { localStorage.setItem('menu', stretto ? 'stretto' : 'intero'); } catch (e) { /* resta per questa visita */ }
  };
  menu(document.documentElement.dataset.menu === 'stretto');
  $('#bTema').onclick = () => {
    const scuro = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const nuovo = scuro ? 'light' : 'dark';
    document.documentElement.dataset.theme = nuovo;
    try { localStorage.setItem('tema', nuovo); } catch (e) { /* resta per questa visita */ }
  };
  $('#gOrd').onchange = renderGeneri;
  const aggiornaLibreria = () => { lib.quanti = 50; disegnaLibreria(); };
  $('#lQ').oninput = (e) => { lib.q = e.target.value; aggiornaLibreria(); };
  $('#lGen').onchange = (e) => { lib.genere = e.target.value; aggiornaLibreria(); };
  $('#lVotoF').onchange = (e) => { lib.voto = e.target.value; aggiornaLibreria(); };
  $('#lAmbitoF').onchange = (e) => { lib.ambito = e.target.value; aggiornaLibreria(); };
  $('#lAltri').onclick = () => { lib.quanti += 50; disegnaLibreria(); };
  $('#recenti').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lord]');
    if (!b) return;
    lib.verso = lib.ordine === b.dataset.lord ? -lib.verso : (['titolo', 'categoria', 'tipo'].includes(b.dataset.lord) ? 1 : -1);
    lib.ordine = b.dataset.lord;
    disegnaLibreria();
  });
  $('#logTipi').onclick = (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    vistaLog.tipo = b.dataset.l;
    document.querySelectorAll('#logTipi [data-l]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    disegnaLog();
  };
  $('#logQ').oninput = (e) => { vistaLog.q = e.target.value; disegnaLog(); };
  $('#logCopia').onclick = () => navigator.clipboard.writeText(righeLog().map(rigaLocale).join('\n'))
    .then(() => toast('Log copiato'), () => toast('Copia non consentita dal browser', 'err'));

  vai((location.hash || '#panoramica').slice(1));
  window.addEventListener('hashchange', () => vai(location.hash.slice(1)));

  // ---------- caricamento ----------
  async function leggi(url, signal) {
    const r = await fetch(url, { cache: 'no-store', signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function aggiornaStato() {
    let stato;
    try { stato = await leggi('/api/stato', AbortSignal.timeout(20000)); }
    catch (e) {
      $('#offline').hidden = false;
      $('#sisDot').className = $('#prodDot').className = 'dot ko';
      $('#sisTesto').textContent = 'Connessione persa';
      $('#prodTesto').textContent = 'Stato sconosciuto';
      $('#bProd').disabled = true;
      return;
    }
    $('#offline').hidden = true;
    disegnaStato(stato);
  }
  async function aggiornaDati() {
    try { disegnaDati(await leggi('/api/dati')); }
    catch (e) { $('#sotto').innerHTML = '<span class="err">Impossibile leggere i dati: ' + esc(e.message) + '</span>'; }
  }
  aggiornaStato();
  aggiornaDati();
  setInterval(aggiornaStato, 5000);
  // avanzamento degli sfondi mentre si generano
  setInterval(() => { if (ctrl && ctrl.sfondi && ctrl.sfondi.inCorso && ctrlSub === 'produzione' && $('#bSfondiStop')) caricaControllo(true); }, 10000);
  setInterval(aggiornaDati, 30000);
})();
