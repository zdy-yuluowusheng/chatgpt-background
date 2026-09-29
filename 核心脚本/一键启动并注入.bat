@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动并注入主题.ps1"
if %ERRORLEVEL% NEQ 0 (
    pause
)
