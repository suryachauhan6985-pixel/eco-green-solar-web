Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\ERF SOFTWARE - RENDER\eco_green_solar_web"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""D:\ERF SOFTWARE - RENDER\eco_green_solar_web\scripts\nas_sync_daemon.js""", 0, False
