@echo off
setlocal
cd /d "%~dp0"

echo M365 Calendar for Thunderbird - initialize local Git repository
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git was not found. Install Git for Windows first.
  echo        winget install --id Git.Git -e
  pause
  exit /b 1
)

if not exist ".git" (
  git init -b main
  if errorlevel 1 goto :fail
) else (
  echo Existing .git repository found.
)

git config user.name "Jens Kowalsky"
set "GITEMAIL="
for /f "delims=" %%E in ('git config --get user.email 2^>nul') do set "GITEMAIL=%%E"
if not defined GITEMAIL (
  set /p "GITEMAIL=Git e-mail address for commits: "
  if not defined GITEMAIL (
    echo ERROR: An e-mail address is required by Git for the first commit.
    pause
    exit /b 1
  )
  git config user.email "%GITEMAIL%"
)

git branch -M main >nul 2>nul
git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo No staged changes. The repository may already have an initial commit.
) else (
  git commit -m "Initial public release v2.23"
  if errorlevel 1 goto :fail
)

echo.
echo Local Git repository is ready.
echo Next: GitHub Desktop - File - Add local repository - Publish repository
echo Or run PUBLISH_GITHUB_CLI.bat.
pause
exit /b 0

:fail
echo.
echo ERROR: Git command failed.
pause
exit /b 1
