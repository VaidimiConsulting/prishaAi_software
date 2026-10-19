#!/bin/bash
cd "$(dirname "$0")"
echo "== Prisha Interiors - Calculator + AI Studio =="
[ -d node_modules ] || npm install
[ -d backend/node_modules ] || npm --prefix backend install
[ -d frontend/node_modules ] || npm --prefix frontend install
[ -f backend/public/index.html ] || npm run build
(sleep 4; open http://localhost:3001 2>/dev/null || xdg-open http://localhost:3001 2>/dev/null) &
echo "Calculator: http://localhost:3001/   AI Studio: http://localhost:3001/studio/   Admin: http://localhost:3001/admin"
npm start
