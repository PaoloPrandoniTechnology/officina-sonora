#!/bin/bash
# Monitoraggio: stampa ogni 2 minuti servizi, esecuzioni e caricamenti. Si ferma dopo 3 caricamenti nuovi.
cd /e/n8n/yoga || exit 1
BASE=$(grep -c "iBroadcast: caricato" state/tick.log)
while true; do
  OK=$(node -e "const net=require('net');const p=[5678,5790,18087];let n=0;(async()=>{for(const x of p){await new Promise(r=>{const s=net.connect(x,'127.0.0.1');s.on('connect',()=>{n++;s.destroy();r()});s.on('error',()=>r())})}console.log(n)})()")
  NUOVI=$(( $(grep -c "iBroadcast: caricato" state/tick.log) - BASE ))
  ERR=$(node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('E:/n8n/data/.n8n/database.sqlite');console.log(db.prepare(\"select count(*) n from execution_entity where id>(select max(id)-5 from execution_entity) and status!='success'\").get().n)")
  echo "$(date +%H:%M) servizi=$OK/3 caricati_nuovi=$NUOVI esecuzioni_errore=$ERR"
  [ "$NUOVI" -ge 3 ] && { echo FINE; break; }
  sleep 120
done
