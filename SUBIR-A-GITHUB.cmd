@echo off
title Subir Ceibos Club a GitHub
setlocal
set "REPO=C:\Users\Usuario\Documents\Codex\2026-07-20\e\outputs"
if not exist "%REPO%\.git" (
  echo No encontre la carpeta oficial de la web.
  echo Ruta esperada: %REPO%
  pause
  exit /b 1
)
cd /d "%REPO%"
git config --global --add safe.directory "C:/Users/Usuario/Documents/Codex/2026-07-20/e/outputs"
git config --global credential.helper manager
echo.
echo Se abrira el inicio de sesion de GitHub si hace falta.
echo Cuando termines de iniciar sesion, esta ventana subira la web automaticamente.
echo.
git add -A
git diff --cached --quiet || git commit -m "Actualizar web y datos del club"
git pull --rebase origin main
git push -u origin main
echo.
if errorlevel 1 (
  echo No se pudo subir todavia. Leé el mensaje de arriba y probá de nuevo.
) else (
  echo Listo: la web y la automatizacion ya estan en GitHub.
)
pause
