# GitHub setup and update guide (GitHub Desktop)

This repository does **not** need to be hosted temporarily on a web server, Nextcloud, or another Git server. The simplest workflow is to keep one local clone/repository and publish/push it directly to GitHub.

## A. First publication with GitHub Desktop

### Option 1 — Desktop-ready archive (recommended)

1. Extract the **Desktop-ready** ZIP to a permanent folder, e.g. `D:\GitHub\M365-Calendar-for-Thunderbird`.
2. The archive already contains a local `.git` directory on branch `main`, but intentionally contains **no fake remote and no fake e-mail identity**.
3. Run `INIT_GITHUB.bat` once. It asks for the e-mail address Git should write into your commits and creates the initial commit.
4. Open **GitHub Desktop**.
5. Choose **File → Add local repository…** and select the extracted folder.
6. Click **Publish repository**.
7. Repository name: `M365-Calendar-for-Thunderbird`.
8. Description: `Open-source Microsoft 365 / Exchange Online / Teams calendar integration for Mozilla Thunderbird with native calendar sync, invitations and Teams meeting support.`
9. Disable **Keep this code private** if the repository should be public.
10. Publish.

No GitHub Importer is needed.

### Option 2 — normal ZIP without `.git`

Extract the ZIP and either let GitHub Desktop create a repository from the folder or run:

```bash
git init -b main
git add .
git commit -m "Initial public release v2.27"
```

Then add the folder to GitHub Desktop and choose **Publish repository**.

## GitHub repository settings after publication

Under the repository **About** section set the description above and add these topics:

`thunderbird`, `thunderbird-addon`, `microsoft-365`, `microsoft-graph`, `exchange-online`, `calendar`, `teams`, `teams-meetings`, `oauth2`, `webextension`

For the first release, create tag/release `v2.0.32` and attach both files from `release/`.

## B. Updating an existing GitHub repository with GitHub Desktop

**Do not create a new repository for each version.** Keep the existing local GitHub clone with its `.git` folder.

1. In GitHub Desktop choose **Fetch origin** / **Pull origin** first.
2. Make a safety copy of the local repository folder if desired.
3. Extract the new Source/Repository archive to a temporary folder.
4. Copy the new repository contents into your existing local clone and overwrite changed files.
5. **Never delete or overwrite the existing `.git` directory.** If the update ZIP contains `.git`, do not copy that directory into an already published clone.
6. GitHub Desktop now shows all changed/added/deleted files under **Changes**.
7. Review the changes.
8. Commit with a message such as `Release v2.27`.
9. Click **Push origin**.
10. If this is a release, create a GitHub Release and attach the current NATIVE/STANDARD XPIs from `release/`.

## Recommended long-term workflow

Use one permanent local folder:

```text
D:\GitHub\M365-Calendar-for-Thunderbird\
```

For every new version: pull → replace/update files → review → commit → push → create release/tag. This keeps the complete Git history and avoids GitHub Importer entirely.

For command-line publication and updating, see [GITHUB_CLI.md](GITHUB_CLI.md).
