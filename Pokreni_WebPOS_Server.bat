@echo off
chcp 65001 >nul
title WebPOS Enterprise - Multi-Tenant Server (SQLite WAL)

echo ============================================================================
echo   WebPOS Enterprise - Inicijalizacija Baze i Pokretanje Web Servera
echo ============================================================================
echo.

:: 1. Provjeri da li je node u PATH-u ili u C:\Program Files\nodejs
set "NODE_EXE=node"
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=%PATH%;C:\Program Files\nodejs"
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    ) else (
        echo [!] Node.js nije pronadjen na Vasem racunaru.
        echo [i] Pokusavam automatsku instalaciju Node.js LTS preko Windows Winget-a...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        if exist "C:\Program Files\nodejs\node.exe" (
            set "PATH=%PATH%;C:\Program Files\nodejs"
            set "NODE_EXE=C:\Program Files\nodejs\node.exe"
        ) else (
            echo.
            echo [GRESKA] Molimo preuzmite i instalirajte Node.js ^(v22 LTS ili noviji^) sa:
            echo          https://nodejs.org/
            echo Nakon instalacije ponovo pokrenite ovu skriptu.
            pause
            exit /b 1
        )
    )
)

echo [1/3] Provjera Node.js verzije...
"%NODE_EXE%" -v
echo.

echo [2/3] Kreiranje i inicijalizacija SQLite ^(WAL^) Multi-Tenant baze podataka...
"%NODE_EXE%" database/db.js --init
if %ERRORLEVEL% NEQ 0 (
    echo [GRESKA] Inicijalizacija baze nije uspjela. Provjerite da li je Node.js verzija 22.5 ili novija.
    pause
    exit /b 1
)
echo.

echo [3/3] Pokretanje WebPOS Web Servera na portu 4100...
start "" "http://localhost:4100"
"%NODE_EXE%" src/server.js
pause
