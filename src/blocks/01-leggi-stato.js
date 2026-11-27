// BLOCCO 1 - Leggi stato: carica state.json e dice se c'e' un render in corso.
const state = loadState();
return [{ json: { state, hasJob: !!state.job } }];
