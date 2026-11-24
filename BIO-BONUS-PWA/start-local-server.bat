@echo off
setlocal
cd /d "%~dp0"
start "BIO-BONUS server" /min cmd /c "python -m http.server 8080"
timeout /t 2 /nobreak >nul
start "" http://localhost:8080
endlocal
