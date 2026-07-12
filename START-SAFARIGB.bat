@echo off
title SAFARIGB Dev Server
cd /d "%~dp0"
if not exist E:\tmp md E:\tmp
if not exist E:\npmcache md E:\npmcache
set TEMP=E:\tmp
set TMP=E:\tmp
echo ============================================================
echo   Starting SAFARIGB...
echo   When you see "Ready", open your browser to:
echo.
echo        http://localhost:3000
echo.
echo   Keep this window open while you use the site.
echo   Close it (or press Ctrl+C) to stop the server.
echo ============================================================
echo.
npm --cache=E:\npmcache run dev
pause
