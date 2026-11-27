// Protezione del gateway da richieste di altri siti.
// Host: blocca i nomi che puntano a 127.0.0.1 (DNS rebinding). Origin: blocca le POST inviate da altre pagine.
// I blocchi n8n e gli script locali non inviano Origin.
const AMMESSI = ['127.0.0.1:5790', 'localhost:5790'];

function ammessa(method, headers) {
  if (!AMMESSI.includes(headers.host)) return false;
  if (method !== 'POST' || headers.origin === undefined) return true;
  return AMMESSI.some((h) => headers.origin === `http://${h}`);
}

module.exports = { ammessa };
