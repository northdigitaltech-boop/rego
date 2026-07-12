@echo off
REM SAFARIGB one-click launcher — starts the dev server and opens the site.
cd /d "%~dp0"
echo Starting SAFARIGB...
echo.
echo Once you see "Local: http://localhost:3000", the site is ready.
echo This window must stay open while you use the site.
echo Press Ctrl + C in this window to stop the server.
echo.
REM Open the site in the default browser after a short delay.
start "" /b cmd /c "timeout /t 5 >nul & start http://localhost:3000"
call npm run dev
pause
