# GitHub CLI setup, update and release guide

Commands below are intended for Windows PowerShell / Terminal with Git and GitHub CLI installed.

## Install Git and GitHub CLI (Windows)

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
```

Restart the terminal afterwards.

## Authenticate GitHub CLI

```powershell
gh auth login
```

Choose GitHub.com, HTTPS, and browser authentication.

## A. Publish this repository for the first time

Open a terminal in the repository folder.

If the archive has **no** `.git` directory:

```powershell
git init -b main
git config user.name "Jens Kowalsky"
git config user.email "YOUR_GIT_EMAIL"
git add .
git commit -m "Initial public release v2.28"
```

If the Desktop-ready archive already contains `.git`, run `INIT_GITHUB.bat` or configure your e-mail and commit:

```powershell
git config user.name "Jens Kowalsky"
git config user.email "YOUR_GIT_EMAIL"
git add -A
git commit -m "Initial public release v2.28"
```

Create the public GitHub repository and push it:

```powershell
gh repo create M365-Calendar-for-Thunderbird --public --source=. --remote=origin --push
```

## B. Update an existing repository

Run these commands in the existing local clone **before** copying in a new version:

```powershell
git pull --ff-only
```

Copy/overwrite the new version files, but keep the existing `.git` folder. Then:

```powershell
git status
git add -A
git commit -m "Release v2.28"
git push
```

`UPDATE_GITHUB_CLI.bat` automates the status/add/commit/push part and asks for the commit message.

## Create a version tag

```powershell
git tag -a v2.0.32 -m "M365 Calendar for Thunderbird v2.32"
git push origin v2.0.32
```

## Create a GitHub Release and attach the XPIs

```powershell
gh release create v2.0.32 `
  release/M365_Thunderbird_Calendar_V2.32_NATIVE.xpi `
  release/M365_Thunderbird_Calendar_V2.32_STANDARD.xpi `
  --title "M365 Calendar for Thunderbird v2.28" `
  --notes-file RELEASE_NOTES_V2.32.md
```

## Check configured remote

```powershell
git remote -v
```

A normal published repository should show `origin` for fetch and push.
