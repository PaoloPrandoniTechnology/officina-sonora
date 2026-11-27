#!/bin/bash
# Ricarica in ordine di numerazione, poi cestina le copie vecchie (con pause per il limite di richieste).
set -u
cd /e/n8n/officina-sonora || exit 1
node tools/ricarica-ordinata.js > state/ricarica-copertine.log 2>&1
tail -n 2 state/ricarica-copertine.log
for t in 1 2 3 4 5 6 7 8 9 10; do
  R=$(node tools/cestina.js tools/da-cestinare-copertine.json)
  echo "$R"
  case "$R" in OK*) break ;; esac
  sleep 60
done
