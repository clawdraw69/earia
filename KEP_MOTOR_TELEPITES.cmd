@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-images.ps1" %*
if errorlevel 1 echo Telepitesi hiba. Lasd a fenti uzenetet es a logs mappat.
pause
