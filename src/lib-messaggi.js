// ---- Messaggi Telegram: impostazioni, fascia oraria e testi. Solo funzioni pure. ----
// Usato dai blocchi n8n (incollato da build-workflow.mjs) e dal gateway (gateway\controllo.js).

const MESSAGGI_FREQUENZE = [30, 60, 120, 180, 240, 360, 720]; // minuti
const TOLLERANZA_STOP_MIN = 15; // l'invio dello stop puo' partire con qualche minuto di ritardo

const MESSAGGI_DEF = {
  riepilogo: {
    etichetta: 'Riepilogo brani',
    descrizione: 'I brani caricati su iBroadcast dall\'ultimo invio, con la frequenza scelta qui sopra.',
    dati: {
      conteggio: 'Numero di brani', titoli: 'Titoli', genere: 'Genere', tipo: 'Tipo e struttura',
      musica: 'Energia, bpm, tonalità', durata: 'Durata', render: 'Tempo di render', id: 'Id iBroadcast', totale: 'Totale prodotti',
    },
  },
  rapporto: {
    etichetta: 'Rapporto giornaliero',
    descrizione: 'Una volta al giorno, alla prima ora della fascia.',
    dati: {
      conteggi: 'Brani, voti, errori', esperimenti: 'Esperimenti attivi', salute: 'Salute del sistema', errori: 'Errori principali',
      migliori: 'Ricette migliori', rivedere: 'Ricette da rivedere', commento: 'Commento automatico',
    },
  },
  avvisi: {
    etichetta: 'Avvisi gravi',
    descrizione: 'Errori ripetuti che richiedono un tuo intervento. Fuori fascia vengono conservati e inviati alla riapertura.',
    dati: { testo: 'Testo dell\'errore', ripetizioni: 'Numero di ripetizioni', ora: 'Ora dell\'ultimo' },
  },
};

function orariValidi(inizio, fine) {
  return Number.isInteger(inizio) && Number.isInteger(fine) && inizio >= 0 && fine <= 24 && inizio < fine;
}

// Impostazioni salvate -> impostazioni complete: cio' che manca o non e' valido torna al predefinito
function impostazioniMessaggi(salvate) {
  const s = salvate || {};
  const orari = orariValidi(s.inizio, s.fine) ? s : { inizio: 8, fine: 22 };
  const tipi = {};
  for (const [nome, def] of Object.entries(MESSAGGI_DEF)) {
    const t = (s.tipi || {})[nome] || {};
    const tutti = Object.keys(def.dati);
    tipi[nome] = { attivo: t.attivo !== false, dati: Array.isArray(t.dati) ? tutti.filter((d) => t.dati.includes(d)) : tutti };
  }
  return {
    frequenzaMin: MESSAGGI_FREQUENZE.includes(s.frequenzaMin) ? s.frequenzaMin : 60,
    inizio: orari.inizio, fine: orari.fine, tipi,
  };
}

const minutiDelGiorno = (d) => d.getHours() * 60 + d.getMinutes();

function inFascia(imp, adesso) {
  const m = minutiDelGiorno(adesso);
  return m >= imp.inizio * 60 && m < imp.fine * 60;
}

// Orario (timestamp) dell'ultimo invio previsto, oppure null fuori fascia. Lo stop e' sempre un invio.
function slotRiepilogo(imp, adesso) {
  const m = minutiDelGiorno(adesso);
  const da = imp.inizio * 60, a = imp.fine * 60;
  if (m < da || m > a + TOLLERANZA_STOP_MIN) return null;
  const s = m >= a ? a : da + Math.floor((m - da) / imp.frequenzaMin) * imp.frequenzaMin;
  return new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate(), 0, s).getTime();
}

const durataTesto = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : 'n.d.');
const nd = (v) => v || 'n.d.';

function rigaBrano(b, c) {
  return [
    c('titoli') ? b.titolo : null,
    c('genere') ? nd(b.genere || b.categoria) : null,
    c('tipo') ? `${nd(b.tipo)}/${nd(b.struttura)}` : null,
    c('musica') ? `energia ${nd(b.energia)}/5, ${nd(b.bpm)} bpm, ${nd(b.tonalita)}` : null,
    c('durata') ? durataTesto(b.durata_s) : null,
    c('render') ? `render ${nd(b.render_s)} s` : null,
    c('id') ? `id ${nd(b.ibroadcast && b.ibroadcast.track_id)}` : null,
  ].filter(Boolean).join(' · ');
}

// Un solo messaggio: se l'elenco non ci sta, si indica quanti brani sono stati omessi
function testoRiepilogo(brani, dati, totale) {
  const c = (d) => dati.includes(d);
  const testa = c('conteggio') ? `🎵 Riepilogo: ${brani.length} ${brani.length === 1 ? 'nuovo brano' : 'nuovi brani'} su iBroadcast` : '🎵 Riepilogo brani';
  const coda = c('totale') && totale ? `\nBrani prodotti finora: ${totale}` : '';
  const righe = brani.map((b) => rigaBrano(b, c)).filter(Boolean).map((r) => '• ' + r);
  let corpo = '';
  for (let i = 0; i < righe.length; i++) {
    if (testa.length + corpo.length + righe[i].length + coda.length > 3800) { corpo += `\n… e altri ${righe.length - i} brani`; break; }
    corpo += '\n' + righe[i];
  }
  return testa + (corpo ? '\n' + corpo : '') + (coda ? '\n' + coda : '');
}

function testoAvviso(chiave, info, dati) {
  const c = (d) => dati.includes(d);
  const ora = new Date(info.ultimo);
  const hhmm = String(ora.getHours()).padStart(2, '0') + ':' + String(ora.getMinutes()).padStart(2, '0');
  return [
    'Avviso: errore ripetuto' + (c('ripetizioni') ? ` ${info.n} volte in un'ora` : ''),
    c('ora') ? `Ultima volta alle ${hhmm}` : null,
    c('testo') ? chiave : null,
  ].filter(Boolean).join('\n');
}
