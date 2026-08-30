@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>nul || (echo ERROR: Git not found.& pause & exit /b 1)
where gh >nul 2>nul || (echo ERROR: GitHub CLI not found. Install with: winget install --id GitHub.cli -e& pause & exit /b 1)

if not exist ".git" call "%~dp0INIT_GITHUB.bat"
git rev-parse --verify HEAD >nul 2>nul || call "%~dp0INIT_GITHUB.bat"

gh auth status >nul 2>nul
if errorlevel 1 gh auth login

git remote get-url origin >nul 2>nul
if not errorlevel 1 (
  echo An origin remote already exists:
  git remote -v
  echo Use UPDATE_GITHUB_CLI.bat for an existing published repository.
  pause
  exit /b 0
)

gh repo create M365-Calendar-for-Thunderbird --public --source=. --remote=origin --push
if errorlevel 1 (pause & exit /b 1)

echo Repository published successfully.
pause
