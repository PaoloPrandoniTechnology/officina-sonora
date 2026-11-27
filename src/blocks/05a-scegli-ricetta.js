// BLOCCO 5a - Scegli ricetta: sceglie categoria, tipo, struttura e fascia di bpm (UCB sui voti),
// la variante del genere e il set di strumenti. Non chiama il modello.
const state = $input.first().json.state;
if (state.queue.length > 0 || state.job) return [{ json: { state, skip: true } }];
if (CFG.comandi.pausa) return [{ json: { state, skip: true } }]; // produzione in pausa dalla dashboard

const guidance = readGuidance();
const slot = pickSlot(state, guidance);
if (CFG.comandi.produciGenere) { log(`produzione forzata: genere ${CFG.comandi.produciGenere}`); aggiornaComandi({ produciGenere: null }); }
const cat = slot.category;
const variante = pickVariante(cat, libraryTracks());
const memoria = leggiMemoria();
const strumenti = strumentiDelGruppo(cat, gruppoMemoria(memoria, cat.name));
salvaMemoria(memoria);
const influenza = scegliInfluenza(cat);
const tonalita = (cat.tonalita && cat.tonalita.length) ? cat.tonalita[Math.floor(Math.random() * cat.tonalita.length)] : '';
const [dmin, dmax] = durRange(guidance, cat.name);

return [{ json: { state, skip: false, guidance, slot, cat, variante, strumenti, influenza, tonalita, dmin, dmax } }];
