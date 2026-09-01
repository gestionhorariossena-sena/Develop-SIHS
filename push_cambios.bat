@echo off
cd /d "C:\Users\Wilfer\OneDrive\Desktop\SIHS\PROYECTO-SIHS-"

echo ===== ESTADO ACTUAL =====
git status

echo.
echo ===== RAMA ACTUAL =====
git branch --show-current

echo.
echo ===== AGREGANDO CAMBIOS =====
git add -A

echo.
echo ===== HACIENDO COMMIT =====
git commit -m "Mejora visual del selector de rol - Cambio de 'Rol en el centro' a 'Selecciona tu rol'"

echo.
echo ===== SUBIENDO A RAMA EDITH =====
git push origin edith

echo.
echo ===== COMPLETADO =====
git log -1 --oneline
