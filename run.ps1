<#
.SYNOPSIS
    Inicia la aplicacion Ultimate Platzi Subtitle Extractor en modo desarrollo.
.DESCRIPTION
    Verifica los requisitos del sistema (Node.js y dependencias) y levanta el servidor
    Vite con el proxy anti-CORS abriendo el navegador automaticamente.
.PARAMETER NoOpen
    Si se especifica, no abre automaticamente el navegador web.
#>
[CmdletBinding()]
param (
    [switch]$NoOpen
)

# Configurar codificacion UTF-8 en consola
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new()
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

# Asegurar que el directorio activo sea la carpeta del script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = Get-Location
}
Set-Location -LiteralPath $scriptDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "      Ultimate Platzi Subtitle Extractor (UPSE)     " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Comprobar si Node.js esta instalado
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no esta instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "Por favor, descargalo e instalalo desde: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# Comprobar si npm esta instalado
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm no esta disponible en el PATH." -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir..."
    exit 1
}

$nodeVer = (node -v).Trim()
Write-Host "[OK] Node.js detectado: $nodeVer" -ForegroundColor Green

# 2. Comprobar dependencias (node_modules)
$nodeModulesPath = Join-Path $scriptDir "node_modules"
if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
    Write-Host "[!] No se encontro la carpeta 'node_modules'." -ForegroundColor Yellow
    Write-Host "    Instalando dependencias necesarias (npm install)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Fallo la instalacion de dependencias." -ForegroundColor Red
        Read-Host "Presiona Enter para salir..."
        exit $LASTEXITCODE
    }
    Write-Host "[OK] Dependencias instaladas correctamente." -ForegroundColor Green
    Write-Host ""
}

# 3. Lanzar la aplicacion
Write-Host "[*] Iniciando servidor de desarrollo con proxy anti-CORS..." -ForegroundColor Cyan
Write-Host "    Presiona Ctrl + C para detener el servidor." -ForegroundColor DarkGray
Write-Host ""

$npmArgs = @("run", "dev")
if (-not $NoOpen) {
    $npmArgs += @("--", "--open")
}

try {
    & npm @npmArgs
}
catch {
    Write-Host "[ERROR] Ocurrio un error al ejecutar la aplicacion: $_" -ForegroundColor Red
    Read-Host "Presiona Enter para salir..."
}
