@echo off
rem Daily Live Project Chat Summary job (see scripts/space-daily.ts). Started by Windows Task Scheduler; works from wherever the repo is.
cd /d "%~dp0.."
if not exist "%USERPROFILE%\space-scan" mkdir "%USERPROFILE%\space-scan"
call npx tsx --env-file=.env.production.local scripts/space-daily.ts >> "%USERPROFILE%\space-scan\task.log" 2>&1
