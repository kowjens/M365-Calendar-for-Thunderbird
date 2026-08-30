@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>nul || (echo ERROR: Git not found.& pause & exit /b 1)
if not exist ".git" (echo ERROR: No .git directory. Use INIT_GITHUB.bat first.& pause & exit /b 1)

git remote get-url origin >nul 2>nul
if errorlevel 1 (echo ERROR: No origin remote. Publish the repository first.& pause & exit /b 1)

git pull --ff-only
if errorlevel 1 (echo ERROR: Pull failed. Resolve the Git state manually.& pause & exit /b 1)

git status --short
git add -A
git diff --cached --quiet
if not errorlevel 1 (echo No changes to commit.& pause & exit /b 0)

set "MSG="
set /p "MSG=Commit message [Release v2.23]: "
if not defined MSG set "MSG=Release v2.23"
git commit -m "%MSG%"
if errorlevel 1 (pause & exit /b 1)
git push
if errorlevel 1 (pause & exit /b 1)

echo Update pushed successfully.
pause
