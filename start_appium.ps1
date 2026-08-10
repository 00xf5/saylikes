# Start Appium server (leave this window open), then in another terminal run:
#   python sayhi_bot.py

$env:PATH = "C:\platform-tools;" + $env:PATH
$env:ANDROID_HOME = "C:\platform-tools"

Write-Host "Checking phone..."
& "C:\platform-tools\adb.exe" devices -l

Write-Host ""
Write-Host "Starting Appium on http://127.0.0.1:4723 ..."
Write-Host "After it says 'Appium REST http interface listener started', open another terminal and run:"
Write-Host "  cd C:\Users\shiver\Desktop\cjj"
Write-Host "  python sayhi_bot.py"
Write-Host ""

appium --address 127.0.0.1 --port 4723
