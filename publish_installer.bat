@echo off
title VRCNext - Installer Build
cd /d "%~dp0"

echo.
echo  =========================================
echo   VRCNext - Release Build + Installer
echo  =========================================
echo.

:: ── 1. Find Inno Setup (check PATH + common dirs + registry) ─────────────────
set "ISCC="

:: Check PATH first
for /f "delims=" %%i in ('where ISCC.exe 2^>nul') do set "ISCC=%%i"

:: Check common install dirs
if "%ISCC%"=="" if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"        set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if "%ISCC%"=="" if exist "C:\Program Files\Inno Setup 6\ISCC.exe"              set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
if "%ISCC%"=="" if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"       set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"

:: Check registry for install location
if "%ISCC%"=="" (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1" /v "InstallLocation" 2^>nul') do set "ISCC=%%bISCC.exe"
)
if "%ISCC%"=="" (
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1" /v "InstallLocation" 2^>nul') do set "ISCC=%%bISCC.exe"
)

:: Use PowerShell as last resort search
if "%ISCC%"=="" (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-ChildItem 'C:\Program Files*' -Recurse -Filter ISCC.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName" 2^>nul') do set "ISCC=%%i"
)

:: Not found — install via winget
if "%ISCC%"=="" (
    echo  [!] Inno Setup not found. Installing via winget...
    echo.
    winget install JRSoftware.InnoSetup -e --silent --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  [ERROR] Could not install Inno Setup automatically.
        echo  Please download it manually: https://jrsoftware.org/isdl.php
        echo.
        pause
        exit /b 1
    )
    echo.
    :: Search again after install
    for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1" /v "InstallLocation" 2^>nul') do set "ISCC=%%bISCC.exe"
    if "%ISCC%"=="" for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1" /v "InstallLocation" 2^>nul') do set "ISCC=%%bISCC.exe"
    if "%ISCC%"=="" if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"  set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    if "%ISCC%"=="" if exist "C:\Program Files\Inno Setup 6\ISCC.exe"        set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
    if "%ISCC%"=="" if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
    if "%ISCC%"=="" (
        echo  [ERROR] Inno Setup installed but ISCC.exe not found.
        echo  Please reboot and try again, or run the bat as Administrator.
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Inno Setup installed.
    echo.
)

echo  Inno Setup: %ISCC%
echo.

:: ── 2. dotnet publish ─────────────────────────────────────────────────────────
echo  [1/2] Building Release...
echo.

dotnet publish -c Release -r win-x64 --self-contained false

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] dotnet publish failed! See output above.
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Build successful.
echo.

:: ── 3. Create installer output folder ────────────────────────────────────────
if not exist "installer" mkdir installer

:: ── 4. Compile installer ──────────────────────────────────────────────────────
echo  [2/2] Compiling installer...
echo.

"%ISCC%" installer.iss

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Inno Setup compilation failed! See output above.
    echo.
    pause
    exit /b 1
)

echo.
echo  =========================================
echo   [OK] Installer ready!
echo  =========================================
echo.
echo  Output: %~dp0installer\
echo.

explorer "%~dp0installer"
pause
