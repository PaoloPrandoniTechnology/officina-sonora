' Lancia il supervisore in background, senza finestra (chiamato ogni 5 minuti dall'attivita' pianificata).
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""E:\n8n\officina-sonora\supervisore.ps1""", 0, False
