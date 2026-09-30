@echo off
title CCTV Health Monitoring - Installer Builder
echo ========================================================
echo   Building CCTV Health Monitoring Setup Installer
echo ========================================================
echo.

echo [1/3] Building React Frontend SPA...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/3] Compiling Python + Uvicorn + OpenCV with PyInstaller...
pyinstaller --noconfirm cctv_monitor.spec
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller compilation failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [*] Copying database template to dist folder...
copy /Y cctv_monitor.db dist\CCTV-Health-Monitor\

echo.
echo [3/3] Compiling Windows Setup Wizard with Inno Setup...
set ISCC_PATH="%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist %ISCC_PATH% (
    set ISCC_PATH="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
if not exist %ISCC_PATH% (
    set ISCC_PATH="C:\Program Files\Inno Setup 6\ISCC.exe"
)

%ISCC_PATH% installer.iss
if %errorlevel% neq 0 (
    echo [ERROR] Inno Setup compilation failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   SUCCESS! Installer ready in: installer_output\
echo ========================================================
pause
