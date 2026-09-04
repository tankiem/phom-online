@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Hay cai Node.js 20 LTS tro len.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dang cai thu vien...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo =============================================
echo PHOM ONLINE dang chay tai http://localhost:3000
echo Nhan Ctrl+C de dung server.
echo =============================================
echo.
call npm start
pause
