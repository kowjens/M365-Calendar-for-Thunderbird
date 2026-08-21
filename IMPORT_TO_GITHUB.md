# Import / publish this repository on GitHub

**Author:** Jens Kowalsky

This archive already has a normal GitHub repository layout. Extract it before publishing.

## Recommended: Git command line

1. Create an empty repository on GitHub (do not add a README or license there).
2. Extract this archive.
3. Open a terminal in the extracted directory.
4. Run:

```bash
git init
git branch -M main
git config user.name "Jens Kowalsky"
# Set your own GitHub-associated email if Git does not already have one:
# git config user.email "your-email@example.com"
git add .
git commit -m "Initial public release V2.19"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

## Before the first push

Run:

```bash
python tools/run_tests.py
python tools/neutrality_check.py
python tools/build_xpi.py --all
```

Do not replace the empty Client ID/tenant defaults with private organization values in the public repository.

## Recommended GitHub repository metadata

After the first push, open the repository **Settings** / **About** area and use metadata similar to the following:

**Repository description**

```text
Open-source Microsoft 365 / Exchange Online / Teams calendar integration for Mozilla Thunderbird with native calendar sync, invitations and Teams meeting support.
```

**Recommended topics**

```text
thunderbird
thunderbird-addon
microsoft-365
microsoft-graph
exchange-online
calendar
teams
teams-meetings
oauth2
webextension
```

The README contains one contextual link to [3-5 Power Electronics GmbH](https://3-5pe.com/) because the project originated partly from real-world Microsoft 365 / Thunderbird integration requirements encountered in Jens Kowalsky's professional work there. Keep this wording factual and do not present the project as an official company product.

For that reason, it is usually better **not** to set `https://3-5pe.com/` as the GitHub repository homepage unless 3-5 Power Electronics explicitly hosts or officially supports the project. The contextual README link is sufficient to document the relationship without implying official ownership.
