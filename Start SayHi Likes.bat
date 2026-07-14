@echo off
cd /d "%~dp0"
set PATH=C:\platform-tools;%PATH%
set ANDROID_HOME=C:\platform-tools
python sayhi_gui.py
if errorlevel 1 pause
