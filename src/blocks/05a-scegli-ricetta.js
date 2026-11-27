// BLOCCO 5a - Scegli ricetta: sceglie categoria, tipo, struttura e fascia di bpm (UCB sui voti),
// la variante del genere e il set di strumenti. Non chiama il modello.
const state = $input.first().json.state;
if (state.queue.length > 0 || state.job) return [{ json: { state, skip: true } }];

const guidance = readGuidance();
const slot = pickSlot(state, guidance);
const cat = slot.category;
const variante = pickVariante(cat, libraryTracks(), readVotes());
const strumenti = scegliStrumenti(cat);
const influenza = scegliInfluenza(cat);
const tonalita = (cat.tonalita && cat.tonalita.length) ? cat.tonalita[Math.floor(Math.random() * cat.tonalita.length)] : '';
const [dmin, dmax] = durRange(guidance, cat.name);

return [{ json: { state, skip: false, guidance, slot, cat, variante, strumenti, influenza, tonalita, dmin, dmax } }];
