#Requires -Version 5.1
<#
.SYNOPSIS
    Priprema Windows 11 produkcijskog okruzenja za WebPOS Enterprise (ASP.NET Core 8 + React + PostgreSQL 17).
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "  WebPOS Enterprise - Priprema Windows 11 Produkcije (.NET 8 + PG17 + React)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

function Refresh-EnvPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Ensure-WingetPackage {
    param(
        [string]$CommandName,
        [string]$WingetId,
        [string]$DisplayName,
        [string[]]$ExtraPaths = @()
    )

    foreach ($p in $ExtraPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$env:Path;$p"
        }
    }

    if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
        Write-Host "[OK] $DisplayName je vec instaliran." -ForegroundColor Green
        return
    }

    Write-Host "[!] $DisplayName nije pronadjen. Pokrecem instalaciju putem winget ($WingetId)..." -ForegroundColor Yellow
    if (-not (Get-Command "winget" -ErrorAction SilentlyContinue)) {
        throw "winget nije dostupan na ovom sistemu. Molimo instalirajte $DisplayName rucno."
    }

    winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
    Refresh-EnvPath

    foreach ($p in $ExtraPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$env:Path;$p"
        }
    }

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Instalacija $DisplayName nije uspjela ili zahtijeva restart terminala."
    }

    Write-Host "[OK] $DisplayName uspjesno instaliran." -ForegroundColor Green
}

# 1. Provjera i instalacija .NET 8 SDK
Ensure-WingetPackage `
    -CommandName "dotnet" `
    -WingetId "Microsoft.DotNet.SDK.8" `
    -DisplayName ".NET 8 SDK" `
    -ExtraPaths @("C:\Program Files\dotnet")

$dotnetSdks = & dotnet --list-sdks
if (-not ($dotnetSdks | Select-String "^8\.")) {
    Write-Host "[!] .NET 8 SDK nije detektovan medju instaliranim SDK-ovima. Instaliram..." -ForegroundColor Yellow
    winget install --id Microsoft.DotNet.SDK.8 --exact --accept-package-agreements --accept-source-agreements
    Refresh-EnvPath
}
Write-Host "    Verzija .NET: $(dotnet --version)" -ForegroundColor Gray

# 2. Provjera i instalacija Node.js LTS
Ensure-WingetPackage `
    -CommandName "node" `
    -WingetId "OpenJS.NodeJS.LTS" `
    -DisplayName "Node.js LTS" `
    -ExtraPaths @("C:\Program Files\nodejs")

Write-Host "    Verzija Node.js: $(node -v)" -ForegroundColor Gray

# 3. Provjera i instalacija PostgreSQL 17
$pgBinPaths = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)
Ensure-WingetPackage `
    -CommandName "psql" `
    -WingetId "PostgreSQL.PostgreSQL.17" `
    -DisplayName "PostgreSQL 17" `
    -ExtraPaths $pgBinPaths

# 4. Kreiranje PostgreSQL korisnika 'webpos' i baze 'webpos_prod'
Write-Host ""
Write-Host "[1/4] Konfiguracija PostgreSQL baze 'webpos_prod' i korisnika 'webpos'..." -ForegroundColor Cyan

$pgUser = "postgres"
if (-not $env:PGPASSWORD) {
    $securePass = Read-Host "Unesite lozinku za PostgreSQL superusera 'postgres' (Enter ako je 'postgres' ili vec podesena)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plainPass)) {
        $env:PGPASSWORD = "postgres"
    } else {
        $env:PGPASSWORD = $plainPass
    }
}

$checkRoleSql = "SELECT 1 FROM pg_roles WHERE rolname='webpos';"
$roleExists = & psql -U $pgUser -h localhost -p 5432 -tAc $checkRoleSql 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Nije moguce spojiti se na PostgreSQL kao '$pgUser'. Provjerite da li PostgreSQL servis radi." -ForegroundColor Yellow
} else {
    if ($roleExists -ne "1") {
        & psql -U $pgUser -h localhost -p 5432 -c "CREATE USER webpos WITH PASSWORD 'WebPos2026!';"
        Write-Host "[OK] Kreiran PostgreSQL korisnik 'webpos'." -ForegroundColor Green
    } else {
        & psql -U $pgUser -h localhost -p 5432 -c "ALTER USER webpos WITH PASSWORD 'WebPos2026!';" | Out-Null
        Write-Host "[OK] PostgreSQL korisnik 'webpos' vec postoji." -ForegroundColor Green
    }

    $checkDbSql = "SELECT 1 FROM pg_database WHERE datname='webpos_prod';"
    $dbExists = & psql -U $pgUser -h localhost -p 5432 -tAc $checkDbSql
    if ($dbExists -ne "1") {
        & psql -U $pgUser -h localhost -p 5432 -c "CREATE DATABASE webpos_prod OWNER webpos ENCODING 'UTF8';"
        Write-Host "[OK] Kreirana PostgreSQL baza 'webpos_prod'." -ForegroundColor Green
    } else {
        Write-Host "[OK] PostgreSQL baza 'webpos_prod' vec postoji." -ForegroundColor Green
    }

    & psql -U $pgUser -h localhost -p 5432 -d webpos_prod -c "GRANT ALL PRIVILEGES ON DATABASE webpos_prod TO webpos;" | Out-Null
    & psql -U $pgUser -h localhost -p 5432 -d webpos_prod -c "GRANT ALL ON SCHEMA public TO webpos;" | Out-Null
}
$env:PGPASSWORD = $null

# 5. Build React frontenda i kopiranje u WebPos.WebApi/wwwroot
Write-Host ""
Write-Host "[2/4] Build React frontenda (src\WebPos.Web)..." -ForegroundColor Cyan
$WebDir = Join-Path $RootDir "src\WebPos.Web"
$WwwRootDir = Join-Path $RootDir "src\WebPos.WebApi\wwwroot"

Push-Location $WebDir
try {
    if (Test-Path "package-lock.json") {
        & npm ci
    } else {
        & npm install
    }
    if ($LASTEXITCODE -ne 0) { throw "npm install nije uspio." }

    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build nije uspio." }
} finally {
    Pop-Location
}

Write-Host "[3/4] Kopiranje buildanog frontenda u WebPos.WebApi\wwwroot..." -ForegroundColor Cyan
if (Test-Path $WwwRootDir) {
    Remove-Item -Path $WwwRootDir -Recurse -Force
}
New-Item -ItemType Directory -Path $WwwRootDir -Force | Out-Null
Copy-Item -Path (Join-Path $WebDir "dist\*") -Destination $WwwRootDir -Recurse -Force
Write-Host "[OK] React SPA kopiran u $WwwRootDir" -ForegroundColor Green

# 6. Kompajliranje Solution-a u Release modu
Write-Host ""
Write-Host "[4/4] Kompajliranje WebPos.sln u Release modu..." -ForegroundColor Cyan
& dotnet restore (Join-Path $RootDir "WebPos.sln")
if ($LASTEXITCODE -ne 0) { throw "dotnet restore nije uspio." }

& dotnet build (Join-Path $RootDir "WebPos.sln") -c Release --no-restore
if ($LASTEXITCODE -ne 0) { throw "dotnet build nije uspio." }

$PublishDir = Join-Path $RootDir "publish"
& dotnet publish (Join-Path $RootDir "src\WebPos.WebApi\WebPos.WebApi.csproj") -c Release -o $PublishDir --no-build
if ($LASTEXITCODE -ne 0) { throw "dotnet publish nije uspio." }

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Green
Write-Host "  PRIPREMA ZAVRSENA USPJESNO!" -ForegroundColor Green
Write-Host "  Za pokretanje servera dvokliknite: Pokreni_Produkcijski_WebServer.bat" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Green
