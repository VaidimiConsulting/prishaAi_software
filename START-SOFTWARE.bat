@echo off
title Prisha Interiors
cd /d "%~dp0"
echo ============================================
echo   Prisha Interiors - Calculator + AI Studio
echo ============================================
echo.
if not exist node_modules (
  echo Pehli baar setup ho raha hai, thoda wait karein...
  call npm install
)
if not exist backend\node_modules call npm --prefix backend install
if not exist frontend\node_modules call npm --prefix frontend install
if not exist backend\public\index.html (
  echo Frontend build ho raha hai...
  call npm run build
)
echo.
echo Server start ho raha hai... browser apne aap khulega.
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3001"
echo.
echo   Calculator : http://localhost:3001/
echo   AI Studio  : http://localhost:3001/studio/
echo   Admin      : http://localhost:3001/admin
echo.
echo Ye window band mat karna (band karte hi software band ho jayega).
echo.
call npm start
pause
