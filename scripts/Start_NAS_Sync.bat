@echo off
title Eco Green Solar ERP - NAS Serial Excel Sync Daemon
cd /d "D:\ERF SOFTWARE - RENDER\eco_green_solar_web"
:loop
node scripts\nas_sync_daemon.js
timeout /t 5
goto loop
