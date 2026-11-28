// BLOCCO 5a - Scegli ricetta: sceglie categoria, tipo, struttura e fascia di bpm (UCB sui voti),
// la variante del genere e il set di strumenti. Non chiama il modello.
const state = $input.first().json.state;
if (state.queue.length > 0 || state.job) return [{ json: { state, skip: true } }];
if (CFG.comandi.pausa) return [{ json: { state, skip: true } }]; // produzione in pausa dalla dashboard

const guidance = readGuidance();
// genere cantato «con approvazione» senza testi in attesa: si chiede una bozza (una per giro, al massimo ogni mezz'ora)
const testiScritti = readJsonSafe(CFG.paroleFile, {}).testi || [];
const usati = state.testiUsati || {};
const daScrivere = CFG.categories.find((c) => voceDi(c) === 'testo' && c.testi === 'approvazione' && (CFG.generiOverride[c.name] || {}).attivo !== false
  && Date.now() - ((state.bozzaChiesta || {})[c.name] || 0) > 30 * 60000
  && !testiScritti.some((t) => t.genere === c.name && t.lingua === linguaDi(c).codice && !usati[t.id]));
if (daScrivere) {
  state.bozzaChiesta = { ...(state.bozzaChiesta || {}), [daScrivere.name]: Date.now() };
  try {
    const r = await gw('/parole/bozza', { genere: daScrivere.name });
    log(r.ok ? `bozza di testo per ${daScrivere.name}: "${r.testo.titolo}", da approvare in dashboard` : `bozza di testo per ${daScrivere.name} non riuscita: ${r.error}`);
  } catch (e) { log(`bozza di testo per ${daScrivere.name} non riuscita: ${e.message}`); }
}
const slot = pickSlot(state, guidance);
if (!slot) { log('nessun genere pronto: servono generi nel catalogo e, per quelli cantati, un testo approvato'); return [{ json: { state, skip: true } }]; }
// «Produci ora» resta in attesa finche' il genere non viene scelto (a quello cantato puo' mancare il testo approvato)
const voluto = CFG.comandi.produciGenere;
if (voluto && (voluto === slot.category.name || !CFG.categories.some((c) => c.name === voluto))) { log(`produzione forzata: genere ${voluto}`); aggiornaComandi({ produciGenere: null }); }
const cat = slot.category;
const variante = pickVariante(cat, libraryTracks());
const memoria = leggiMemoria();
const strumenti = strumentiDelGruppo(cat, gruppoMemoria(memoria, cat.name));
salvaMemoria(memoria);
const influenza = scegliInfluenza(cat);
const tonalita = (cat.tonalita && cat.tonalita.length) ? cat.tonalita[Math.floor(Math.random() * cat.tonalita.length)] : '';
const [dmin, dmax] = durRange(guidance, cat.name);

return [{ json: { state, skip: false, guidance, slot, cat, variante, strumenti, influenza, tonalita, dmin, dmax } }];
