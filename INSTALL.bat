@echo off
REM SAFARIGB one-click installer — runs npm install and saves full output to a log file.
cd /d "%~dp0"
echo Installing SAFARIGB dependencies...
echo This can take a few minutes. Please wait.
echo. > install-output.txt
echo ===== npm version ===== >> install-output.txt
call npm -v >> install-output.txt 2>&1
echo. >> install-output.txt
echo ===== node version ===== >> install-output.txt
call node -v >> install-output.txt 2>&1
echo. >> install-output.txt
echo ===== npm install ===== >> install-output.txt
call npm install --legacy-peer-deps >> install-output.txt 2>&1
echo. >> install-output.txt
echo ===== DONE (exit code %ERRORLEVEL%) ===== >> install-output.txt
echo.
echo Finished. You can close this window.
pause
