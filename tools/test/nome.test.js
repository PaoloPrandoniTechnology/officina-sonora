const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const VIETATI = /yoga music|yoga-music|n8n[\\/]+yoga|yogaMusicSupervisor|yoga-workflow|YMF_|__yoga|musica per (il )?yoga|per centri yoga/i;

test('nessun riferimento al vecchio nome', () => {
  const file = execSync('git ls-files', { cwd: RADICE, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/^(docs|config\/history)\//.test(f) && f !== 'tools/test/nome.test.js' && !/\.(png|jpg|mp3)$/.test(f));
  const trovati = file.filter((f) => fs.existsSync(path.join(RADICE, f)) && VIETATI.test(fs.readFileSync(path.join(RADICE, f), 'utf8')));
  assert.deepEqual(trovati, []);
});
