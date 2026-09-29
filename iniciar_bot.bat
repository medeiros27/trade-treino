@echo off
title Bot Testnet - Trade Dashboard
cd /d "C:\Dev\trade-dashboard"
echo ============================================================
echo    BOT DE TESTE (TESTNET) - dinheiro FAKE, risco zero
echo ============================================================
echo.
echo Lendo chaves de %USERPROFILE%\trade_chaves.txt
echo (para parar: feche esta janela ou crie STOP.txt nesta pasta)
echo.
where python >nul 2>nul
if %errorlevel%==0 (python bot_testnet.py) else (py bot_testnet.py)
echo.
echo ============================================================
echo Bot encerrado.
pause
