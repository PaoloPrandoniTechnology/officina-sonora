// Scrittura atomica: file temporaneo e rinomina. Su Windows la rinomina fallisce per un istante se il file
// è aperto da un altro processo (antivirus, blocchi di n8n): si riprova.
const fs = require('fs');

function scriviAtomico(file, testo, suffisso = '.tmp') {
  const tmp = file + suffisso;
  fs.writeFileSync(tmp, testo);
  for (let i = 0; ; i++) {
    try { return fs.renameSync(tmp, file); } catch (e) {
      if (i >= 40 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

module.exports = { scriviAtomico };
