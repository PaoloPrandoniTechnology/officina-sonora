// Telegram riceve avvisi di errore solo per casi gravi che richiedono un tuo intervento.
const fs = require('fs');
const file = 'E:/n8n/yoga/src/blocks/08-telegram.js';
let s = fs.readFileSync(file, 'utf8');
const ancora = '  for (const [key, n] of Object.entries(conta)) {\n    if (n < 3) continue;';
if (!s.includes(ancora)) throw new Error('ancora non trovata');
s = s.replace(ancora, `  // Solo i casi che richiedono un tuo intervento: il resto (ritardi, riprove, attese) resta nel log
  const GRAVE = /refresh (token )?non valido|invalid_grant|login iBroadcast non riuscito|credenzial|gateway non configurato|scrittura fuori|lettura bloccata|spazio|disco pieno|motore YuE2 non attivo.*(riavvio fallito)|token Telegram/i;
  for (const [key, n] of Object.entries(conta)) {
    if (!GRAVE.test(key)) continue;
    if (n < 3) continue;`);
fs.writeFileSync(file, s);
console.log('avvisi: solo casi gravi');
