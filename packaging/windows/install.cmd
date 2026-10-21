@echo off
rem Double-click to install. Runs install.ps1 from this folder. (Copied as "Install <app>.cmd" by packaging/publish.sh.)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
