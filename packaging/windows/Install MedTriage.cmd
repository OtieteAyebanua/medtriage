@echo off
rem Double-click this file to install MedTriage. It runs install.ps1 from this folder.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
