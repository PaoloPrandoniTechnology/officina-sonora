#!/bin/bash
# Aspetta che non ci sia un render, poi sposta la libreria, aggiorna il codice e pubblica il workflow.
set -u
cd /e/n8n/officina-sonora || exit 1
for i in $(seq 1 120); do
  grep -q '"job": null' state/state.json && break
  sleep 30
done
if ! grep -q '"job": null' state/state.json; then echo "render ancora in corso: rinvio"; exit 1; fi
node tools/riorganizza-libreria.js || exit 1
node tools/riorganizza-codice.js || exit 1
node -e "
const fs=require('fs');const path=require('path');const lib=fs.readFileSync('src/lib.js','utf8')+'\n'+fs.readFileSync('src/lib-apprendimento.js','utf8');
const libIb=fs.readFileSync('src/lib-ibroadcast.js','utf8');const cover=fs.readFileSync('src/cover.js','utf8');
const AF=Object.getPrototypeOf(async function(){}).constructor;
let bad=0;for (const f of fs.readdirSync('src/blocks')) { const extra=/03d1|03d3/.test(f)?libIb+'\n'+cover:''; try { new AF('require','\$input','\$env',lib+'\n'+extra+'\n'+fs.readFileSync(path.join('src/blocks',f),'utf8')); } catch(e){bad++;console.log('FAIL',f,e.message);} } console.log('blocchi non validi:',bad); if(bad) process.exit(1);" || exit 1
node build-workflow.mjs > /dev/null
cd /e/n8n
N8N_USER_FOLDER='E:\n8n\data' NODE_FUNCTION_ALLOW_BUILTIN='fs,path,http,https' N8N_BLOCK_ENV_ACCESS_IN_NODE='false' ./node_modules/.bin/n8n.cmd import:workflow --input=E:/n8n/officina-sonora/officina-sonora-workflow.json 2>&1 | tail -1
N8N_USER_FOLDER='E:\n8n\data' ./node_modules/.bin/n8n.cmd publish:workflow --id=yogaMusicFactory01 2>&1 | tail -1
echo "riorganizzazione completata"
