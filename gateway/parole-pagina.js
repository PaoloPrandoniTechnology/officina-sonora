// Pagina Testi: le parole dei brani cantati. Elenco a sinistra, sezioni a blocchi al centro (con sillabe e rime
// verso per verso), assistente, controlli e anteprima a destra. Salva da sola; in produzione va solo l'approvato.
window.PaginaParole = function (app) {
  'use strict';
  const { $, esc, toast, chiedi, invia, leggi } = app;
  const M = window.ModelloParole;
  const radice = $('#paPagina');
  let dati = null;
  let doc = null; // il testo aperto (copia di lavoro)
  let selezione = { sezione: 0, verso: 0 };
  let proposte = null;
  let annulla = [];
  let timer = null;
  let salvataggio = Promise.resolve();
  let occupato = '';
  let filtro = { genere: '', stato: '' };

  const genere = (nome) => dati.generi.find((g) => g.nome === nome);
  const lingua = () => (doc && ((genere(doc.genere) || {}).lingua || {}).codice) || (doc && doc.lingua) || 'it';
  const bpm = () => { const g = doc && genere(doc.genere); return g ? (g.bpm[0] + g.bpm[1]) / 2 : 90; };
  const tempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const statoDi = (t) => (t.usato ? ['usato', 'Usato'] : t.stato === 'approvato' ? ['ok', 'Approvato'] : ['bozza', 'Bozza']);
  const MODI = { auto: 'le parole si scrivono da sole', approvazione: 'l’IA propone, tu approvi', miei: 'solo parole tue' };

  function elenco() {
    const lista = dati.testi.filter((t) => (!filtro.genere || t.genere === filtro.genere) && (!filtro.stato || statoDi(t)[0] === filtro.stato));
    if (!lista.length) return '<div class="empty">Nessun testo qui. Premi «Nuovo testo».</div>';
    return lista.map((t) => {
      const [s, nome] = statoDi(t);
      const prima = (t.sezioni.find((x) => x.righe.length) || { righe: [] }).righe[0] || 'ancora senza versi';
      return `<button type="button" class="pa-voce" data-apri="${esc(t.id)}" aria-current="${doc && doc.id === t.id}">
        <b>${esc(t.titolo || 'Senza titolo')}</b><span class="pa-stato ${s}">${nome}</span>
        <small>${esc((genere(t.genere) || {}).etichetta || t.genere)}${t.autore === 'ia' ? ' · scritto dall’IA' : ''}</small><i>${esc(prima)}</i></button>`;
    }).join('');
  }

  function guide(righe) {
    const rime = M.schemaRime(righe, lingua());
    return righe.map((r, i) => (r.trim() ? `<span><b>${M.sillabe(r, lingua())}</b><i class="r${rime[i] === '-' ? '' : ' si'}">${rime[i] === '-' ? '·' : rime[i]}</i></span>` : '<span></span>')).join('');
  }
  const righeGrezze = (s) => (s.testo !== undefined ? s.testo : s.righe.join('\n')).split('\n');

  function blocco(s, i) {
    const righe = righeGrezze(s);
    const fermo = Boolean(doc.usato);
    return `<section class="pa-blocco ${s.tipo}${i === selezione.sezione ? ' scelto' : ''}" data-s="${i}">
      <header>
        <select class="field" data-tipo="${i}" aria-label="Tipo della sezione ${i + 1}" ${fermo ? 'disabled' : ''}>${Object.entries(M.TIPI).map(([v, n]) => `<option value="${v}"${v === s.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <small data-conta="${i}">${righe.filter((r) => r.trim()).length} versi</small>
        <span class="pa-azioni">${fermo ? '' : [['su', '↑', 'Sposta su'], ['giu', '↓', 'Sposta giù'], ['copia', '⧉', 'Duplica la sezione'], ['via', '✕', 'Elimina la sezione']].map(([a, x, n]) => `<button type="button" class="segno" data-sez="${a}" data-i="${i}" aria-label="${n}" data-tip="${n}">${x}</button>`).join('')}</span>
      </header>
      <div class="pa-corpo"><div class="pa-guide" data-guide="${i}" aria-hidden="true">${guide(righe)}</div>
        <textarea data-testo="${i}" rows="${Math.max(2, righe.length)}" wrap="off" spellcheck="true" lang="${esc(lingua())}" aria-label="Versi: ${M.TIPI[s.tipo]}" placeholder="${s.tipo === 'intro' || s.tipo === 'outro' ? 'Lascia vuoto per una parte solo suonata' : 'Un verso per riga'}" ${fermo ? 'readonly' : ''}>${esc(righe.join('\n'))}</textarea></div>
    </section>`;
  }

  function editor() {
    if (!doc) return '<div class="empty pa-vuoto">Scegli un testo a sinistra, oppure creane uno nuovo.</div>';
    if (doc.nuovo) {
      return `<div class="pa-nuovo"><h2>Nuovo testo</h2><p class="muted">Per quale genere?</p>
        <div class="segmenti">${dati.generi.map((g) => `<button type="button" class="btn ghost" data-nuovo="${esc(g.nome)}" aria-pressed="${doc.genere === g.nome}">${esc(g.etichetta)} <small>${esc(g.lingua.nome)}</small></button>`).join('')}</div>
        <label>Oppure incolla qui un testo già scritto (con o senza etichette come [Strofa], [Ritornello])<textarea class="field" id="paIncolla" rows="9" placeholder="[Strofa]&#10;…"></textarea></label>
        <div class="segmenti"><button type="button" class="btn" data-az="crea">Inizia a scrivere</button><button type="button" class="btn ghost" data-az="annullaNuovo">Annulla</button></div></div>`;
    }
    return `<div class="pa-testa">
        <input class="field pa-titolo" id="paTitolo" value="${esc(doc.titolo)}" maxlength="80" placeholder="Titolo (se vuoto lo sceglie il sistema)" aria-label="Titolo" ${doc.usato ? 'readonly' : ''}>
        <span class="tag">${esc((genere(doc.genere) || {}).etichetta || doc.genere)}</span>
        <span class="muted" id="paSalvato" role="status"></span>
      </div>
      ${doc.usato ? `<p class="pa-avviso">Testo già usato nel brano «${esc(doc.usato.titolo)}»: si legge soltanto. «Duplica» ne fa una copia da modificare.</p>` : ''}
      ${doc.sezioni.map(blocco).join('')}
      ${doc.usato ? '' : `<div class="pa-aggiungi"><span class="muted">Aggiungi:</span>${Object.entries(M.TIPI).map(([v, n]) => `<button type="button" class="btn small ghost" data-aggiungi="${v}">+ ${n}</button>`).join('')}</div>`}`;
  }

  function laterale() {
    if (!doc || doc.nuovo) {
      return `<div class="card"><h2>Generi cantati</h2>${dati.generi.map((g) => `<p><b>${esc(g.etichetta)}</b><br><small class="muted">${esc(g.lingua.nome)} · ${MODI[g.modo]} · testi pronti: ${g.pronti}</small></p>`).join('')}
        <p class="muted pa-piccolo">Lingua, voce e modo si cambiano nella pagina Generi.</p></div>`;
    }
    const controlli = M.controlli(doc.sezioni.map((s) => ({ tipo: s.tipo, righe: righeGrezze(s) })), { lingua: lingua(), bpm: bpm() });
    const blocco0 = controlli.some((c) => c.grave && !c.ok);
    const approvato = doc.stato === 'approvato';
    return `<div class="card pa-stato-card"><h2>Stato <span class="pa-stato ${statoDi(doc)[0]}">${statoDi(doc)[1]}</span></h2>
        ${doc.usato ? '' : `<button type="button" class="btn" data-az="${approvato ? 'ritira' : 'approva'}" ${!approvato && blocco0 ? 'disabled' : ''}>${approvato ? 'Torna in bozza' : 'Approva per la produzione'}</button>`}
        <div class="segmenti"><button type="button" class="btn small ghost" data-az="duplica">Duplica</button><button type="button" class="btn small ghost" data-az="annulla" ${annulla.length && !doc.usato ? '' : 'disabled'}>Annulla modifica</button><button type="button" class="btn small danger" data-az="elimina">Elimina</button></div></div>
      ${doc.usato ? '' : `<div class="card"><h2>Assistente</h2>
        <label>Tema o richiesta<input class="field" id="paTema" maxlength="300" value="${esc(doc.tema || '')}" placeholder="${esc((genere(doc.genere) || {}).temi || 'di che cosa parla')}"></label>
        <div class="pa-aiuti"><button type="button" class="btn small" data-ia="tutto">Scrivi tutto il testo</button><button type="button" class="btn small ghost" data-ia="sezione">Riscrivi la sezione</button><button type="button" class="btn small ghost" data-ia="verso">Alternative al verso</button><button type="button" class="btn small ghost" data-ia="rime">Rime per il verso</button></div>
        <p class="muted pa-piccolo">Sezione e verso sono quelli dove si trova il cursore.</p>
        <div id="paProposte" aria-live="polite">${occupato ? `<div class="empty">${esc(occupato)}</div>` : proposte ? `<div class="pa-proposte">${proposte.voci.map((p, i) => (proposte.azione === 'rime' ? `<span class="tag">${esc(p)}</span>` : `<button type="button" class="btn small ghost" data-usa="${i}">${esc(p)}</button>`)).join('')}</div>` : ''}</div></div>`}
      <div class="card"><h2>Controlli</h2><ul class="pa-controlli">${controlli.map((c) => `<li class="${c.ok ? 'ok' : c.grave ? 'no' : 'forse'}">${c.ok ? '✓' : c.grave ? '✕' : '!'} ${esc(c.testo)}</li>`).join('')}</ul></div>
      <div class="card"><h2>Cosa riceve il motore</h2><pre class="pa-anteprima">${esc(M.lyricsDi(doc.sezioni.map((s) => ({ tipo: s.tipo, righe: righeGrezze(s) }))))}</pre></div>`;
  }

  function disegna() {
    if (!dati.generi.length) {
      radice.innerHTML = '<div class="card"><h2>Nessun genere con testo cantato</h2><p>Per scrivere parole serve almeno un genere con la voce «Testo cantato».</p><button type="button" class="btn" data-vai="generi">Apri Generi</button></div>';
      return;
    }
    const opz = (v, n, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(n)}</option>`;
    radice.innerHTML = `<div class="pa">
      <aside class="pa-sinistra">
        <button type="button" class="btn" data-az="nuovo">+ Nuovo testo</button>
        <select class="field" data-filtro="genere" aria-label="Filtra per genere">${opz('', 'Tutti i generi', filtro.genere)}${dati.generi.map((g) => opz(g.nome, g.etichetta, filtro.genere)).join('')}</select>
        <select class="field" data-filtro="stato" aria-label="Filtra per stato">${opz('', 'Tutti', filtro.stato)}${opz('bozza', 'Da approvare', filtro.stato)}${opz('ok', 'Approvati', filtro.stato)}${opz('usato', 'Usati', filtro.stato)}</select>
        <div class="pa-elenco" id="paElenco">${elenco()}</div>
      </aside>
      <div class="pa-centro" id="paCentro">${editor()}</div>
      <aside class="pa-destra" id="paDestra">${laterale()}</aside></div>`;
  }
  const ridisegnaLato = () => {
    const tema = $('#paTema');
    const attivo = tema && document.activeElement === tema;
    if (tema && doc) doc.tema = tema.value;
    $('#paDestra').innerHTML = laterale();
    if (attivo) $('#paTema').focus();
  };

  // ---------- salvataggio ----------
  const fotografa = () => { annulla.push(JSON.stringify({ titolo: doc.titolo, sezioni: doc.sezioni.map((s) => ({ tipo: s.tipo, righe: righeGrezze(s) })) })); if (annulla.length > 60) annulla.shift(); };
  const messaggio = (t) => { const el = $('#paSalvato'); if (el) el.textContent = t; };
  function corpo(d, stato) {
    return { id: d.id, titolo: d.titolo, genere: d.genere, tema: d.tema, stato, autore: d.autore === 'ia' ? 'misto' : d.autore, sezioni: d.sezioni.map((s) => ({ tipo: s.tipo, righe: righeGrezze(s) })) };
  }
  // ogni salvataggio parte dopo il precedente: un testo nuovo non nasce due volte
  function salva(stato = 'bozza') {
    clearTimeout(timer); timer = null;
    const d = doc;
    if (!d || d.nuovo || d.usato) return salvataggio;
    salvataggio = salvataggio.then(async () => {
      const r = await invia('/api/parole/salva', corpo(d, stato));
      d.id = r.testo.id; d.stato = r.testo.stato;
      const i = dati.testi.findIndex((t) => t.id === d.id);
      if (i < 0) dati.testi.unshift({ ...r.testo, usato: null }); else dati.testi[i] = { ...r.testo, usato: null };
      if (d === doc) { messaggio('Salvato'); const el = $('#paElenco'); if (el) el.innerHTML = elenco(); }
    }).catch((e) => { messaggio('Non salvato'); toast(e.message, 'err'); });
    return salvataggio;
  }
  function cambiato() {
    // una modifica riporta il testo in bozza: parole a metà non vanno in produzione
    const eraApprovato = doc.stato === 'approvato';
    doc.stato = 'bozza';
    messaggio(eraApprovato ? 'Tornato in bozza: approvalo di nuovo' : 'Salvo…');
    clearTimeout(timer);
    timer = setTimeout(() => salva(), 900);
  }

  function apri(id) {
    if (timer) salva();
    const t = dati.testi.find((x) => x.id === id);
    doc = t ? JSON.parse(JSON.stringify(t)) : null;
    selezione = { sezione: 0, verso: 0 }; proposte = null; annulla = [];
    disegna();
  }
  async function aggiorna() {
    dati = await leggi('/api/parole');
    if (doc && !doc.nuovo) { const t = dati.testi.find((x) => x.id === doc.id); doc = t ? JSON.parse(JSON.stringify(t)) : null; }
    disegna();
  }

  async function assistente(azione) {
    if (occupato) return;
    const d = doc;
    d.tema = $('#paTema').value;
    const sezioni = d.sezioni.map((s) => ({ tipo: s.tipo, righe: righeGrezze(s).filter((r) => r.trim()) }));
    const s = d.sezioni[selezione.sezione];
    const riga = s ? righeGrezze(s)[selezione.verso] || '' : '';
    if (azione === 'tutto' && sezioni.some((x) => x.righe.length) && !(await chiedi('Riscrivere tutto il testo?', 'I versi attuali vengono sostituiti. «Annulla modifica» li riporta.', 'Riscrivi'))) return;
    if ((azione === 'verso' || azione === 'rime') && !riga.trim()) return toast('Metti il cursore su un verso', 'err');
    occupato = 'Sto scrivendo…'; proposte = null; ridisegnaLato();
    try {
      // il verso scelto si conta tra le righe piene della sezione inviata
      if (azione === 'tutto') {
        const r = await invia('/api/parole/proponi', { genere: d.genere, tema: d.tema });
        if (d !== doc) return;
        fotografa(); doc.sezioni = r.sezioni; if (!doc.titolo) doc.titolo = r.titolo; selezione = { sezione: 0, verso: 0 }; cambiato();
      } else {
        const r = await invia('/api/parole/assisti', { azione, genere: d.genere, sezioni, indice: selezione.sezione, riga, richiesta: d.tema });
        if (d !== doc) return;
        if (azione === 'sezione') { fotografa(); doc.sezioni[selezione.sezione] = { tipo: s.tipo, righe: r.righe }; cambiato(); }
        else proposte = { azione, voci: r.proposte, ...selezione };
      }
    } catch (e) { toast(e.message, 'err'); }
    finally { occupato = ''; if (d === doc) { $('#paCentro').innerHTML = editor(); ridisegnaLato(); } }
  }

  // ---------- eventi ----------
  radice.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.apri) return apri(d.apri);
    if (d.nuovo) { doc.genere = d.nuovo; radice.querySelectorAll('[data-nuovo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (d.aggiungi) { fotografa(); doc.sezioni.push({ tipo: d.aggiungi, righe: [] }); selezione = { sezione: doc.sezioni.length - 1, verso: 0 }; cambiato(); $('#paCentro').innerHTML = editor(); ridisegnaLato(); return $(`[data-testo="${selezione.sezione}"]`).focus(); }
    if (d.sez) {
      const i = Number(d.i), s = doc.sezioni;
      fotografa();
      if (d.sez === 'su' && i > 0) [s[i - 1], s[i]] = [s[i], s[i - 1]];
      if (d.sez === 'giu' && i < s.length - 1) [s[i + 1], s[i]] = [s[i], s[i + 1]];
      if (d.sez === 'copia') s.splice(i + 1, 0, { tipo: s[i].tipo, righe: righeGrezze(s[i]) });
      if (d.sez === 'via') s.splice(i, 1);
      selezione = { sezione: 0, verso: 0 }; proposte = null; cambiato(); $('#paCentro').innerHTML = editor(); return ridisegnaLato();
    }
    if (d.ia) return assistente(d.ia);
    if (d.usa !== undefined) {
      const s = doc.sezioni[proposte.sezione];
      if (!s) return;
      fotografa();
      const righe = righeGrezze(s);
      righe[proposte.verso] = proposte.voci[Number(d.usa)];
      doc.sezioni[proposte.sezione] = { tipo: s.tipo, righe };
      proposte = null; cambiato(); $('#paCentro').innerHTML = editor(); return ridisegnaLato();
    }
    const az = d.az;
    if (!az) return;
    if (az === 'nuovo') { if (timer) salva(); doc = { nuovo: true, genere: filtro.genere || dati.generi[0].nome }; return disegna(); }
    if (az === 'annullaNuovo') { doc = null; return disegna(); }
    if (az === 'crea') {
      const incollato = M.daTesto($('#paIncolla').value);
      const nome = doc.genere;
      doc = { genere: nome, titolo: '', tema: '', stato: 'bozza', autore: 'tu', usato: null, sezioni: incollato.length ? incollato : ['verse', 'chorus', 'verse', 'chorus'].map((tipo) => ({ tipo, righe: [] })) };
      selezione = { sezione: 0, verso: 0 }; annulla = []; proposte = null;
      disegna(); salva(); return;
    }
    if (az === 'annulla') {
      const prima = annulla.pop();
      if (!prima) return;
      Object.assign(doc, JSON.parse(prima)); cambiato(); $('#paCentro').innerHTML = editor(); return ridisegnaLato();
    }
    if (az === 'approva' || az === 'ritira') { await salva(az === 'approva' ? 'approvato' : 'bozza'); if (az === 'approva' && doc.stato === 'approvato') toast('Approvato: andrà in produzione con il suo genere', 'ok'); return disegna(); }
    if (az === 'duplica') {
      try { await salvataggio; if (timer) await salva(); const r = await invia('/api/parole/duplica', { id: doc.id }); await aggiorna(); apri(r.testo.id); } catch (x) { toast(x.message, 'err'); }
      return;
    }
    if (az === 'elimina') {
      if (!(await chiedi('Eliminare il testo?', `«${doc.titolo || 'Senza titolo'}» verrà eliminato per sempre.`, 'Elimina', 'danger'))) return;
      clearTimeout(timer); timer = null;
      try { await salvataggio; if (doc.id) await invia('/api/parole/elimina', { id: doc.id }); doc = null; await aggiorna(); } catch (x) { toast(x.message, 'err'); }
    }
  });
  radice.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'paTitolo') { doc.titolo = t.value; return cambiato(); }
    if (t.id === 'paTema') { doc.tema = t.value; return; }
    if (t.dataset.testo === undefined) return;
    const i = Number(t.dataset.testo), s = doc.sezioni[i];
    if (!t.dataset.fotografato) { fotografa(); t.dataset.fotografato = '1'; }
    s.testo = t.value;
    const righe = t.value.split('\n');
    t.rows = Math.max(2, righe.length);
    radice.querySelector(`[data-guide="${i}"]`).innerHTML = guide(righe);
    radice.querySelector(`[data-conta="${i}"]`).textContent = `${righe.filter((r) => r.trim()).length} versi`;
    cambiato(); ridisegnaLato();
  });
  radice.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.filtro) { filtro[t.dataset.filtro] = t.value; $('#paElenco').innerHTML = elenco(); return; }
    if (t.dataset.tipo !== undefined) { fotografa(); const s = doc.sezioni[Number(t.dataset.tipo)]; s.tipo = t.value; cambiato(); $('#paCentro').innerHTML = editor(); ridisegnaLato(); }
  });
  // dove si trova il cursore: sezione e verso a cui si applicano gli aiuti
  for (const ev of ['keyup', 'click', 'focusin']) {
    radice.addEventListener(ev, (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.testo === undefined) return;
      selezione = { sezione: Number(t.dataset.testo), verso: t.value.slice(0, t.selectionStart).split('\n').length - 1 };
      radice.querySelectorAll('.pa-blocco').forEach((x) => x.classList.toggle('scelto', Number(x.dataset.s) === selezione.sezione));
    });
  }
  window.addEventListener('beforeunload', (e) => { if (timer) { salva(); e.preventDefault(); } });

  return {
    ferma() { if (timer) salva(); },
    pagina() {
      if (dati) disegna(); else radice.innerHTML = '<div class="empty">Caricamento…</div>';
      salvataggio.then(aggiorna).catch((e) => { radice.innerHTML = `<div class="empty">Testi non disponibili: ${esc(e.message)}</div>`; });
    },
  };
};
