@echo off
chcp 65001 >nul
title WebPOS Enterprise - Produkcijski Web Server (ASP.NET Core 8)

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo ============================================================================
echo   WebPOS Enterprise - Produkcijski Web Server (.NET 8 + PostgreSQL 17)
echo ============================================================================
echo.

set "ASPNETCORE_ENVIRONMENT=Production"
set "ASPNETCORE_URLS=http://0.0.0.0:5000"

if exist "%ROOT_DIR%publish\WebPos.WebApi.exe" (
    echo [i] Pokrecem objavljeni WebPos.WebApi.exe na portu 5000...
    start "" "http://localhost:5000"
    cd /d "%ROOT_DIR%publish"
    "%ROOT_DIR%publish\WebPos.WebApi.exe"
    goto :end
)

if exist "%ROOT_DIR%src\WebPos.WebApi\bin\Release\net8.0\WebPos.WebApi.exe" (
    echo [i] Pokrecem Release WebPos.WebApi.exe na portu 5000...
    start "" "http://localhost:5000"
    cd /d "%ROOT_DIR%src\WebPos.WebApi"
    "%ROOT_DIR%src\WebPos.WebApi\bin\Release\net8.0\WebPos.WebApi.exe"
    goto :end
)

where dotnet >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\dotnet\dotnet.exe" (
        set "PATH=%PATH%;C:\Program Files\dotnet"
    ) else (
        echo [GRESKA] .NET 8 SDK/Runtime nije pronadjen. Pokrenite prvo Pripremi_Windows11_Produkciju.ps1.
        pause
        exit /b 1
    )
)

echo [i] Pokrecem ASP.NET Core Web API putem dotnet run (Release) na portu 5000...
start "" "http://localhost:5000"
dotnet run --project "%ROOT_DIR%src\WebPos.WebApi\WebPos.WebApi.csproj" -c Release

:end
echo.
echo [i] Server je zaustavljen.
pause
