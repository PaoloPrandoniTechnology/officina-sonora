#!/bin/bash
# Ricarica tutti i brani con il nuovo album, poi cestina le copie precedenti (una sola volta per id).
set -u
cd /e/n8n/officina-sonora || exit 1

node -e "
const fs=require('fs'),path=require('path');const ids=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(f==='_scartati')continue;if(fs.statSync(p).isDirectory())walk(p);else if(f.endsWith('.json')&&f!=='feedback.json'){const m=JSON.parse(fs.readFileSync(p,'utf8'));if(m.ibroadcast&&m.ibroadcast.track_id)ids.push(String(m.ibroadcast.track_id));}}})('E:/libreria-storica');
fs.writeFileSync('tools/da-cestinare-3.json',JSON.stringify([...new Set(ids)]));
console.log('ids attuali da sostituire', new Set(ids).size);
"

node build-workflow.mjs > /dev/null
cd /e/n8n
N8N_USER_FOLDER='E:\n8n\data' NODE_FUNCTION_ALLOW_BUILTIN='fs,path,http,https' N8N_BLOCK_ENV_ACCESS_IN_NODE='false' ./node_modules/.bin/n8n.cmd import:workflow --input=E:/n8n/officina-sonora/officina-sonora-workflow.json 2>&1 | tail -1
N8N_USER_FOLDER='E:\n8n\data' ./node_modules/.bin/n8n.cmd publish:workflow --id=yogaMusicFactory01 2>&1 | tail -1

cd /e/n8n/officina-sonora
node tools/ricarica.js > state/ricarica3.log 2>&1
tail -n 1 state/ricarica3.log

for t in 1 2 3 4 5 6 7 8; do
  R=$(node tools/cestina.js tools/da-cestinare-3.json)
  echo "$R"
  case "$R" in OK*) break ;; esac
  sleep 60
done
