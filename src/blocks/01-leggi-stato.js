// BLOCCO 1 - Leggi stato: carica state.json e dice se c'e' un render in corso.
const state = loadState();
// Una sola esecuzione della pipeline alla volta: se il lock e' occupato questo giro non fa nulla
const token = acquireLock('pipeline');
if (!token) {
  log('pipeline occupata da un\'altra esecuzione: salto questo giro');
  return [{ json: { state, hasJob: !!state.job, locked: true } }];
}
state.lockToken = token; // non viene salvato: 07 lo rimuove prima di scrivere
return [{ json: { state, hasJob: !!state.job, locked: false } }];
