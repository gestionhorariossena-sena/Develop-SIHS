# Selector local SIHS (Windows PowerShell 5.1+).
param(
    [ValidateSet("demo", "institucional")][string]$Mode = "demo",
    [ValidateSet("start", "check")][string]$Action = "start",
    [ValidateSet("launcher", "backend", "frontend")][string]$Role = "launcher"
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$beFile = Join-Path $root "backend/.env.$Mode"
$feFile = Join-Path $root "frontend/.env.$Mode.local"

function Read-Env([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Falta $path. Copia el archivo .env.example y completa las variables."
    }
    $values = @{}
    foreach ($line in (Get-Content -LiteralPath $path -Encoding UTF8)) {
        if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}
function Get-ProjectRef([string]$url) {
    if ($url -notmatch '^https://([a-z0-9-]+)\.supabase\.co/?$') {
        throw "URL de Supabase incorrecta o sin configurar."
    }
    return $Matches[1]
}
function Get-DbProjectRef([string]$url) {
    if ($url -notmatch '^postgresql(?:\+psycopg)?://postgres\.([a-z0-9-]+):.+@[^/]+\.pooler\.supabase\.com:(?:5432|6543)/postgres(?:\?.*)?$') {
        throw "La URL de PostgreSQL debe contener postgres.<project-ref> y el pooler Supabase."
    }
    return $Matches[1]
}
$be = Read-Env $beFile
$fe = Read-Env $feFile
if ($be["APP_ENV"] -ne $Mode -or $fe["VITE_APP_ENV"] -ne $Mode) {
    throw "APP_ENV y VITE_APP_ENV deben coincidir con $Mode."
}
$ref = Get-ProjectRef $be["SUPABASE_URL"]
$demoRef = $be["SIHS_DEMO_PROJECT_REF"]
$institutionalRef = $be["SIHS_INSTITUTIONAL_PROJECT_REF"]
if (-not $demoRef -or -not $institutionalRef -or $demoRef -eq $institutionalRef) {
    throw "Se requieren dos project-ref distintos en la allow-list (SIHS_DEMO_PROJECT_REF y SIHS_INSTITUTIONAL_PROJECT_REF)."
}
$expected = if ($Mode -eq "demo") { $demoRef } else { $institutionalRef }
if ($ref -ne $expected) { throw "SUPABASE_URL no coincide con la allow-list del entorno $Mode." }

if ((Get-ProjectRef $fe["VITE_SUPABASE_URL"]) -ne $ref) { throw "Frontend y backend usan Supabase distintos." }
if ((Get-DbProjectRef $be["DATABASE_URL"]) -ne $ref) { throw "DATABASE_URL apunta a otro Supabase." }
if ((Get-DbProjectRef $be["ALEMBIC_DATABASE_URL"]) -ne $ref) { throw "ALEMBIC_DATABASE_URL apunta a otro Supabase." }
if (-not $be["SUPABASE_ANON_KEY"] -or -not $fe["VITE_SUPABASE_ANON_KEY"]) {
    throw "Faltan claves publicas de Supabase."
}
if ($be["SUPABASE_ANON_KEY"] -ne $fe["VITE_SUPABASE_ANON_KEY"]) {
    throw "Las claves publicas de Supabase en frontend y backend son distintas."
}
if ($fe["VITE_API_URL"] -notmatch '^http://(localhost|127\.0\.0\.1):8000/api/v1/?$') {
    throw "VITE_API_URL debe apuntar al backend local :8000/api/v1."
}
if ($Mode -eq "demo" -and $be["EMBEDDED_PUBLICATION_WORKER"] -match "^(?i:true|1|yes)$") {
    throw "El worker embebido debe estar apagado en DEMO local."
}
Write-Host "Configuracion valida: $Mode; Supabase ref: $ref. Sin exponer secretos."
if ($Action -eq "check") { return }

if ($Mode -eq "institucional" -and $Role -eq "launcher") {
    $response = Read-Host "ATENCION: vas a usar la base INSTITUCIONAL. Escribe INSTITUCIONAL para continuar"
    if ($response -cne "INSTITUCIONAL") { throw "Inicio cancelado." }
    $env:SIHS_ALLOW_INSTITUTIONAL = "1"
}
if ($Mode -eq "institucional" -and $env:SIHS_ALLOW_INSTITUTIONAL -ne "1") {
    throw "Usa el lanzador principal para confirmar el modo institucional."
}
if ($Mode -eq "demo") { Remove-Item Env:SIHS_ALLOW_INSTITUTIONAL -ErrorAction SilentlyContinue }
# Evitar que valores exportados accidentalmente invaliden los archivos elegidos.
foreach ($name in @("APP_ENV", "DATABASE_URL", "ALEMBIC_DATABASE_URL", "SUPABASE_URL",
        "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "FRONTEND_URL",
        "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_URL", "VITE_APP_ENV",
        "SIHS_DEMO_PROJECT_REF", "SIHS_INSTITUTIONAL_PROJECT_REF")) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
}
if ($Role -eq "backend") {
    $env:SIHS_ENV_FILE = ".env.$Mode"
    $python = Join-Path $root "backend/.venv/Scripts/python.exe"
    if (-not (Test-Path $python)) { throw "Primero crea backend/.venv e instala requirements.txt." }
    Set-Location (Join-Path $root "backend")
    & $python -m uvicorn app.main:app --reload
    return
}
if ($Role -eq "frontend") {
    Set-Location (Join-Path $root "frontend")
    & pnpm "dev:$Mode"
    if ($LASTEXITCODE -ne 0) { throw "Falló pnpm. Comprueba instalación y dependencias." }
    return
}
$script = $PSCommandPath
Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-File", ('"' + $script + '"'), "-Mode", $Mode, "-Role", "backend")
Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-File", ('"' + $script + '"'), "-Mode", $Mode, "-Role", "frontend")
Write-Host "Se abrieron dos terminales: backend y frontend ($Mode)."
