// Editor di un genere (finestra a schede ancorate): si sceglie con pulsanti ed elenchi, si scrive solo dove serve
// un testo libero. Vale per qualsiasi genere; si puo' partire da zero, da una copia o da una proposta dell'IA.
window.EditorGeneri = function (app) {
  'use strict';
  const { $, esc, toast, chiedi, invia, leggi, salvato } = app;
  const finestra = $('#finestra');
  let dati = null;
  let m = null; // il modulo
  let prima = '';
  let occupato = false;

  const SEZIONI = [['identita', 'Identità'], ['carattere', 'Carattere'], ['strumenti', 'Strumenti'], ['armonia', 'Tempo e armonia'], ['voce', 'Voce'], ['suono', 'Suono e copertina']];
  const ENERGIE = [[1, '1 molto calmo'], [2, '2 calmo'], [3, '3 medio'], [4, '4 vivace'], [5, '5 intenso']];
  const ESTRI = [[0, 'Quiete: ripetizione voluta'], [1, 'Vivo: variazioni e un assolo'], [2, 'Pieno: sorprese e richiami']];
  const RUOLI = [['fisso', 'Sempre'], ['scelta', 'A rotazione'], ['riserva', 'Mai da solo']];

  function daScheda(c) {
    const en = c.en || {};
    const org = c.organico || {};
    const nomi = c.strumenti || [];
    return {
      name: c.name || '', genere: c.genere || '', raccolta: c.raccolta || (dati.raccolte[0] || {}).nome || '', famiglia: c.famiglia || '', attivita: c.attivita || '',
      energia: c.energia || 3, estro: c.estro ?? 1, carattere: c.carattere || 'cine', voce: c.voce || 'strumentale', bpm: [...(c.bpm || [80, 100])],
      strutture: [...(c.strutture || ['arco'])], tonalita: [...(c.tonalita || ['La minore', 'Do maggiore'])], durata: c.durata || '',
      strumenti: nomi.length ? nomi.map((it) => ({ it, en: (en.instruments || {})[it] || '', ruolo: !c.organico ? 'scelta' : (org.fissi || []).includes(it) ? 'fisso' : (org.scelta || []).includes(it) ? 'scelta' : 'riserva' }))
        : [{ it: '', en: '', ruolo: 'fisso' }, { it: '', en: '', ruolo: 'fisso' }, { it: '', en: '', ruolo: 'scelta' }],
      en: { genre: en.genre || '', rhythm: en.rhythm || '', mood: en.mood || '', space: en.space || '' },
      stile: c.stile || '', vietati: (c.vietati || []).join(', '),
      influenze: (c.influenze || []).map((i) => ({ genere: i.genere || i, peso: i.peso || 1, en: (en.influences || {})[i.genere || i] || i.genere || i })),
      lora: ((c.lora || [])[0] || {}).name || '', lingua: c.lingua || (dati.lingue[0] || {}).codice || 'it', timbro: c.timbro || 'femminile', testi: c.testi || 'approvazione', temi: c.temi || '',
      copertina: { etichetta: (c.copertina || {}).etichetta || '', prompt: (c.copertina || {}).prompt || '' }, colori: [...(c.colori || ['#22303c', '#5b8a9a', '#eef3f4'])],
    };
  }

  // gruppi di pulsanti: una scelta (aria-pressed unico) o piu' scelte
  const scelte = (campo, voci, valore, multi = false) => `<div class="segmenti ge-scelte" data-scelte="${campo}"${multi ? ' data-multi' : ''}>${voci.map(([v, n, aiuto]) => `<button type="button" class="btn small ghost" data-v="${esc(v)}" aria-pressed="${multi ? valore.includes(v) : String(valore) === String(v)}"${aiuto ? ` data-tip="${esc(aiuto)}"` : ''}>${esc(n)}</button>`).join('')}</div>`;
  const campo = (percorso, nome, valore, extra = '') => `<label class="ge-campo">${nome}<input class="field" data-p="${percorso}" value="${esc(valore)}" ${extra}></label>`;
  const riga = (nome, contenuto, aiuto = '') => `<div class="ge-riga"><div class="ge-nome">${nome}${aiuto ? `<small>${aiuto}</small>` : ''}</div><div>${contenuto}</div></div>`;

  const sezioni = {
    identita: () => `
      ${riga('Nome', campo('genere', '', m.genere, 'maxlength="60" placeholder="es. Cumbia andina" aria-label="Nome del genere"') + (m.name ? `<small class="muted">Sigla fissa: ${esc(m.name)} (cartelle, playlist e voti)</small>` : ''))}
      ${riga('Raccolta', `${scelte('raccolta', dati.raccolte.map((r) => [r.nome, r.nome, `Playlist «${r.playlist} - …»`]), m.raccolta)}<div class="ge-nuova"><input class="field" id="geRaccolta" maxlength="40" placeholder="Nuova raccolta" aria-label="Nome della nuova raccolta"><button type="button" class="btn small ghost" data-ge="raccolta">Aggiungi</button></div>`, 'Cartella della libreria e playlist')}
      ${riga('Famiglia', `${scelte('famiglia', dati.famiglie.map((f) => [f, f]), m.famiglia)}<div class="ge-nuova">${campo('famiglia', '', m.famiglia, 'maxlength="40" aria-label="Famiglia" placeholder="oppure scrivine una nuova"')}</div>`)}
      ${riga('A cosa serve', campo('attivita', '', m.attivita, 'maxlength="160" aria-label="A cosa serve" placeholder="es. lavoro, ballo, ascolto, yoga"'), 'Un’etichetta: non cambia la produzione')}`,
    carattere: () => `
      ${riga('Energia', scelte('energia', ENERGIE, m.energia))}
      ${riga('Estro', scelte('estro', ESTRI, m.estro), 'Quanto il brano cambia mentre suona')}
      ${riga('Carattere', scelte('carattere', Object.entries(dati.caratteri), m.carattere), 'Accordi e andamento del compositore')}`,
    strumenti: () => `<p class="muted ge-nota">Il nome è per te, la descrizione in inglese è ciò che legge il motore. «Sempre» in ogni brano, «A rotazione» uno o due per volta, «Mai da solo» resta in scheda.</p>
      <div class="ge-strumenti">${m.strumenti.map((s, i) => `<div class="ge-str">
        <input class="field" data-p="strumenti.${i}.it" value="${esc(s.it)}" maxlength="50" placeholder="strumento" aria-label="Strumento ${i + 1}">
        <input class="field" data-p="strumenti.${i}.en" value="${esc(s.en)}" maxlength="80" placeholder="descrizione in inglese, es. warm nylon guitar" aria-label="Descrizione inglese dello strumento ${i + 1}">
        ${scelte(`strumenti.${i}.ruolo`, RUOLI, s.ruolo)}
        <button type="button" class="segno" data-ge="via" data-i="${i}" aria-label="Togli lo strumento ${i + 1}">✕</button></div>`).join('')}</div>
      <button type="button" class="btn small ghost" data-ge="piu">+ Strumento</button>`,
    armonia: () => `
      ${riga('Velocità (BPM)', `<div class="ge-bpm">${[0, 1].map((i) => `<label>${i ? 'a' : 'da'} <input type="range" min="30" max="220" value="${m.bpm[i]}" data-bpm="${i}" aria-label="BPM ${i ? 'massimi' : 'minimi'}"><b data-bpmv="${i}">${m.bpm[i]}</b></label>`).join('')}</div>`)}
      ${riga('Tonalità', `<div class="ge-tonalita">${['maggiore', 'minore'].map((modo) => scelte('tonalita', dati.tonalita.filter((t) => t.endsWith(modo)).map((t) => [t, t.replace(` ${modo}`, modo === 'minore' ? ' m' : '').replace(' bemolle', '♭').replace(' diesis', '♯'), t]), m.tonalita, true)).join('')}</div>`, 'Ogni brano ne pesca una')}
      ${riga('Forme', scelte('strutture', Object.entries(dati.strutture).map(([n, s]) => [n, n, s.join(' ')]), m.strutture, true), 'Le successioni di sezioni ammesse')}
      ${riga('Durata', campo('durata', '', m.durata, 'maxlength="9" placeholder="secondi, es. 180-240 (facoltativa)" aria-label="Durata in secondi"'))}`,
    voce: () => `
      ${riga('Voce', scelte('voce', Object.entries(dati.voci), m.voce))}
      ${m.voce === 'testo' ? `
      ${riga('Lingua', `${scelte('lingua', dati.lingue.map((l) => [l.codice, l.nome]), m.lingua)}<div class="ge-nuova"><input class="field" id="geLinNome" maxlength="30" placeholder="Nuova lingua (es. Spagnolo)" aria-label="Nome della lingua"><input class="field" id="geLinEn" maxlength="30" placeholder="in inglese (Spanish)" aria-label="Nome inglese"><input class="field num" id="geLinCod" maxlength="3" placeholder="es" aria-label="Sigla"><button type="button" class="btn small ghost" data-ge="lingua">Aggiungi</button></div>`, 'YuE2 non garantisce tutte le lingue: ascolta un brano di prova')}
      ${riga('Chi canta', scelte('timbro', Object.entries(dati.timbri), m.timbro))}
      ${riga('Parole', scelte('testi', Object.entries(dati.modiTesti), m.testi), 'I testi si scrivono nella pagina Testi')}
      ${riga('Temi', campo('temi', '', m.temi, 'maxlength="300" aria-label="Temi" placeholder="di cosa parlano le canzoni proposte dall’IA"'))}` : `<p class="muted ge-nota">${m.voce === 'vocalizzi' ? 'Voci su vocali, senza parole.' : 'Solo strumenti.'}</p>`}
      ${riga('LoRA', `<select class="field" data-p="lora" aria-label="LoRA del genere"><option value="">Nessuna</option>${dati.lora.map((l) => `<option value="${esc(l.nome)}"${l.nome === m.lora ? ' selected' : ''}>${esc(l.etichetta)}</option>`).join('')}</select><small class="muted" id="geLoraNota">${esc((dati.lora.find((l) => l.nome === m.lora) || {}).descrizione || '')}</small>`, m.voce === 'testo' ? 'Una voce o uno stile in più, usata nei brani cantati' : 'Usata se in Score scegli «solo quella del genere»')}`,
    suono: () => `
      ${riga('Genere in inglese', campo('en.genre', '', m.en.genre, 'maxlength="120" aria-label="Genere in inglese" placeholder="es. Andean cumbia"'), 'Il primo descrittore per il motore')}
      ${riga('Ritmo', campo('en.rhythm', '', m.en.rhythm, 'maxlength="160" aria-label="Ritmo in inglese" placeholder="steady cumbia groove"'))}
      ${riga('Atmosfera', campo('en.mood', '', m.en.mood, 'maxlength="160" aria-label="Atmosfera in inglese" placeholder="festive, warm"'))}
      ${riga('Spazio e mix', campo('en.space', '', m.en.space, 'maxlength="160" aria-label="Suono in inglese" placeholder="natural room, clear mix"'))}
      ${riga('Descrizione', campo('stile', '', m.stile, 'maxlength="300" aria-label="Descrizione dello stile" placeholder="una riga che riassume lo stile"'))}
      ${riga('Da evitare', campo('vietati', '', m.vietati, 'aria-label="Da evitare" placeholder="separati da virgole"'))}
      ${riga('Nome in copertina', campo('copertina.etichetta', '', m.copertina.etichetta, 'maxlength="30" aria-label="Nome in copertina"'))}
      ${riga('Immagine di copertina', campo('copertina.prompt', '', m.copertina.prompt, 'maxlength="400" aria-label="Immagine di copertina" placeholder="in inglese, senza scritte"'))}
      ${riga('Colori', `<div class="ge-colori">${m.colori.map((c, i) => `<input type="color" value="${esc(c)}" data-p="colori.${i}" aria-label="Colore ${i + 1}">`).join('')}</div>`)}`,
  };
  const ridisegna = (id) => { finestra.querySelector(`#ge-${id} .ge-contenuto`).innerHTML = sezioni[id](); };

  function disegna() {
    const nuovo = !m.name;
    finestra.innerHTML = `<form method="dialog" class="ge">
      <header class="ge-testa"><h2 id="fTitolo">${nuovo ? 'Nuovo genere' : esc(m.genere)}</h2><button type="button" class="btn small ghost" data-ge="chiudi">Chiudi</button></header>
      ${nuovo ? `<div class="ge-avvio">
        <label>Parti da un genere esistente<select class="field" id="geCopia"><option value="">— scheda vuota —</option>${dati.generi.map((g) => `<option value="${esc(g.name)}">${esc(g.genere || g.name)}</option>`).join('')}</select></label>
        <label class="ge-ia">Oppure descrivilo e fatti proporre la scheda<span><input class="field" id="geDescrivi" maxlength="400" placeholder="es. cumbia andina con flauti, allegra"><button type="button" class="btn" data-ge="proponi">Proponi</button></span></label></div>` : ''}
      <div class="ge-corpo">
        <nav class="ge-indice" aria-label="Parti della scheda">${SEZIONI.map(([id, n]) => `<button type="button" data-ge="vai" data-a="${id}">${n}</button>`).join('')}</nav>
        <div class="ge-fogli">${SEZIONI.map(([id, n]) => `<section id="ge-${id}"><h3>${n}</h3><div class="ge-contenuto">${sezioni[id]()}</div></section>`).join('')}</div>
      </div>
      <footer class="ge-piede"><p class="err" id="geErrore" role="alert"></p>
        ${!nuovo ? `<button type="button" class="btn small danger" data-ge="elimina" ${(dati.generi.find((g) => g.name === m.name) || {}).brani ? 'disabled data-tip="Ha brani in libreria: puoi solo sospenderlo"' : ''}>Elimina</button>` : '<span class="muted">Un genere nuovo nasce sospeso: accendilo quando è pronto.</span>'}
        <button type="button" class="btn" data-ge="salva">Salva</button></footer></form>`;
  }

  const imposta = (percorso, v) => { const p = percorso.split('.'); const u = p.pop(); p.reduce((o, k) => o[k], m)[u] = v; };
  const errore = (t) => { const el = finestra.querySelector('#geErrore'); if (el) el.textContent = t; };
  const corpoInvio = () => ({ ...m, strumenti: m.strumenti.filter((s) => s.it.trim()), name: m.name || undefined });
  const cambiata = () => JSON.stringify(m) !== prima;
  async function chiudi() {
    if (cambiata() && !(await chiediSopra('Uscire senza salvare?', 'Le modifiche alla scheda vanno perse.', 'Esci'))) return;
    finestra.close();
  }
  // la conferma deve stare sopra la finestra: si chiede dentro la finestra stessa
  function chiediSopra(titolo, testo, si) {
    return new Promise((ok) => {
      const d = document.createElement('div');
      d.className = 'ge-conferma';
      d.innerHTML = `<div class="card" role="alertdialog" aria-label="${esc(titolo)}"><h2>${esc(titolo)}</h2><p>${esc(testo)}</p><div class="segmenti"><button type="button" class="btn ghost" data-r="">Annulla</button><button type="button" class="btn danger" data-r="1">${esc(si)}</button></div></div>`;
      d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { e.stopPropagation(); d.remove(); ok(Boolean(b.dataset.r)); } });
      finestra.append(d);
      d.querySelector('button').focus();
    });
  }

  finestra.addEventListener('click', async (e) => {
    if (!finestra.querySelector('form.ge')) return;
    const v = e.target.closest('[data-scelte] [data-v]');
    if (v) {
      const g = v.closest('[data-scelte]'), c = g.dataset.scelte, val = v.dataset.v;
      if (g.hasAttribute('data-multi')) {
        m[c] = m[c].includes(val) ? m[c].filter((x) => x !== val) : [...m[c], val];
        v.setAttribute('aria-pressed', String(m[c].includes(val)));
      } else {
        imposta(c, c === 'energia' || c === 'estro' ? Number(val) : val);
        g.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === v)));
        if (c === 'voce') ridisegna('voce');
        if (c === 'famiglia') finestra.querySelector('[data-p="famiglia"]').value = val;
      }
      return;
    }
    const b = e.target.closest('[data-ge]');
    if (!b) return;
    const az = b.dataset.ge;
    if (az === 'chiudi') return chiudi();
    if (az === 'vai') return finestra.querySelector(`#ge-${b.dataset.a}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (az === 'piu') { m.strumenti.push({ it: '', en: '', ruolo: 'scelta' }); return ridisegna('strumenti'); }
    if (az === 'via') { m.strumenti.splice(Number(b.dataset.i), 1); return ridisegna('strumenti'); }
    if (occupato) return;
    occupato = true; b.disabled = true; errore('');
    try {
      if (az === 'raccolta') {
        const nome = finestra.querySelector('#geRaccolta').value.trim();
        await invia('/api/generi/raccolta', { nome });
        dati = await leggi('/api/generi'); m.raccolta = nome; ridisegna('identita');
      } else if (az === 'lingua') {
        const codice = finestra.querySelector('#geLinCod').value.trim().toLowerCase();
        await invia('/api/generi/lingua', { codice, nome: finestra.querySelector('#geLinNome').value, en: finestra.querySelector('#geLinEn').value });
        dati = await leggi('/api/generi'); m.lingua = codice; ridisegna('voce');
      } else if (az === 'proponi') {
        const descrizione = finestra.querySelector('#geDescrivi').value.trim();
        if (!descrizione) return errore('Scrivi due parole sul genere che vuoi.');
        b.textContent = 'Preparo…';
        const { proposta: p } = await invia('/api/generi/proponi', { descrizione, voce: m.voce });
        // della proposta si prende solo cio' che la scheda sa mostrare; il salvataggio ricontrolla tutto
        const base = daScheda({});
        const st = (Array.isArray(p.strumenti) ? p.strumenti : []).filter((s) => s && s.it);
        m = {
          ...base, voce: m.voce, genere: String(p.genere || descrizione).slice(0, 60), famiglia: String(p.famiglia || ''), attivita: String(p.attivita || ''),
          energia: Math.min(5, Math.max(1, Math.round(p.energia) || 3)), estro: Math.min(2, Math.max(0, Math.round(p.estro) || 0)),
          carattere: dati.caratteri[p.carattere] ? p.carattere : base.carattere,
          bpm: Array.isArray(p.bpm) && p.bpm.length === 2 ? p.bpm.map((x) => Math.min(220, Math.max(30, Math.round(x) || 90))).sort((x, y) => x - y) : base.bpm,
          strutture: [].concat(p.strutture || []).filter((s) => dati.strutture[s]), tonalita: [].concat(p.tonalita || []).filter((t) => dati.tonalita.includes(t)),
          strumenti: st.length ? st.slice(0, 10).map((s) => ({ it: String(s.it), en: String(s.en || ''), ruolo: s.ruolo === 'fisso' ? 'fisso' : 'scelta' })) : base.strumenti,
          en: Object.fromEntries(['genre', 'rhythm', 'mood', 'space'].map((k) => [k, String((p.en || {})[k] || '')])), stile: String(p.stile || ''),
          vietati: [].concat(p.vietati || []).join(', '), copertina: { etichetta: String((p.copertina || {}).etichetta || '').slice(0, 30), prompt: String((p.copertina || {}).prompt || '') },
        };
        if (!m.strutture.length) m.strutture = base.strutture;
        if (!m.tonalita.length) m.tonalita = base.tonalita;
        disegna(); toast('Scheda proposta: controllala prima di salvare', 'ok');
      } else if (az === 'salva') {
        const r = await invia('/api/generi/salva', corpoInvio());
        prima = JSON.stringify(m); finestra.close();
        toast(r.nuovo ? 'Genere creato, per ora sospeso' : 'Salvato: vale dal prossimo brano', 'ok');
        await salvato();
      } else if (az === 'elimina') {
        if (!(await chiediSopra('Eliminare il genere?', `«${m.genere}» sparisce dal catalogo.`, 'Elimina'))) return;
        await invia('/api/generi/elimina', { name: m.name });
        prima = JSON.stringify(m); finestra.close(); toast('Genere eliminato', 'ok'); await salvato();
      }
    } catch (x) { errore(x.message); }
    finally { occupato = false; b.disabled = false; if (az === 'proponi' && b.isConnected) b.textContent = 'Proponi'; }
  });
  finestra.addEventListener('input', (e) => {
    if (!finestra.querySelector('form.ge')) return;
    const t = e.target;
    if (t.dataset.p) {
      imposta(t.dataset.p, t.value);
      if (t.dataset.p === 'famiglia') finestra.querySelectorAll('[data-scelte="famiglia"] [data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === t.value)));
      if (t.dataset.p === 'lora') finestra.querySelector('#geLoraNota').textContent = (dati.lora.find((l) => l.nome === t.value) || {}).descrizione || '';
    }
    if (t.dataset.bpm !== undefined) {
      const i = Number(t.dataset.bpm), altro = 1 - i;
      m.bpm[i] = Number(t.value);
      if ((i === 0) === (m.bpm[i] > m.bpm[altro])) m.bpm[altro] = m.bpm[i]; // il minimo non supera il massimo
      for (const k of [0, 1]) { finestra.querySelector(`[data-bpm="${k}"]`).value = m.bpm[k]; finestra.querySelector(`[data-bpmv="${k}"]`).textContent = m.bpm[k]; }
    }
  });
  finestra.addEventListener('change', (e) => {
    if (e.target.id !== 'geCopia') return;
    const c = dati.generi.find((g) => g.name === e.target.value);
    m = daScheda(c ? { ...c, name: '', genere: `${c.genere || c.name} (copia)` } : {});
    disegna(); finestra.querySelector('#geCopia').value = e.target.value;
  });
  finestra.addEventListener('cancel', (e) => { if (finestra.querySelector('form.ge') && cambiata()) { e.preventDefault(); chiudi(); } });

  return {
    // nome: sigla del genere da modificare; vuoto = nuovo
    async apri(nome) {
      try { dati = await leggi('/api/generi'); } catch (e) { return toast('Schede non disponibili: ' + e.message, 'err'); }
      const c = nome ? dati.generi.find((g) => g.name === nome) : {};
      if (!c) return toast('Genere non trovato', 'err');
      m = daScheda(c);
      prima = JSON.stringify(m);
      disegna();
      finestra.showModal();
      finestra.querySelector('.ge-fogli').scrollTop = 0;
    },
  };
};
