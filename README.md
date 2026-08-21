<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="180">
</p>

# M365 Calendar for Thunderbird

**Author:** Jens Kowalsky  
**Version:** 2.0.19 / V2.19  
**License:** Mozilla Public License 2.0

Open-source Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird using Microsoft Graph, OAuth2/PKCE, Microsoft Teams meeting support, invitation handling and optional native Thunderbird calendar integration.

> This repository is the **public/neutral GitHub edition**. It contains no preconfigured Microsoft Entra Client ID, tenant, or organization-specific OAuth configuration.

## Background and professional context

This project was developed and is maintained by **Jens Kowalsky** as an independent open-source project. It originated from practical Microsoft 365, Exchange Online, Microsoft Teams and Mozilla Thunderbird integration work, including workflows encountered in my professional work at [3-5 Power Electronics GmbH](https://3-5pe.com/).

The project is **not an official product of Microsoft, Mozilla Thunderbird, or 3-5 Power Electronics GmbH**. The company reference is provided only to document the real-world professional context in which parts of the workflow and requirements were developed.

## Editions

Two builds are provided. They use the same public add-on ID, so install **one** edition at a time:

- **STANDARD** — Microsoft 365 Space, Graph calendar UI, invitation workflow and Teams meeting creation; no privileged Thunderbird Experiment API.
- **NATIVE** — all STANDARD features plus Microsoft 365 calendars directly inside Thunderbird's built-in Calendar UI, native double-click editing, Teams meeting toolbar/context actions and automatic native synchronization. NATIVE uses a privileged Thunderbird Experiment API and Thunderbird may therefore show a broad/full-access warning.

## Quick start

1. Register an application in Microsoft Entra ID.
2. Install either `release/M365_Thunderbird_Calendar_V2.19_STANDARD.xpi` or `release/M365_Thunderbird_Calendar_V2.19_NATIVE.xpi`.
3. In Thunderbird open the **Microsoft 365** Space and click the **gear icon** at the top right.
4. Copy the OAuth Redirect URI shown by the add-on into the Entra app as a **Single-page application (SPA)** redirect URI.
5. Add delegated Microsoft Graph permissions `User.Read`, `Calendars.ReadWrite`, and optionally `Calendars.ReadWrite.Shared`.
6. Enter your Client ID and tenant in the add-on settings, save, and run **Microsoft Login**.

> **Important:** this public repository uses the neutral add-on ID `m365-calendar@jenskowalsky.invalid`. Its OAuth redirect URI therefore differs from any private/internal build. Always use the exact Redirect URI displayed by the installed public add-on.

Detailed instructions:

- [Administrator Guide — English](docs/ADMIN_GUIDE_EN.md)
- [Administrator Guide — German](docs/ADMIN_GUIDE_DE.md)
- [User Guide — English](docs/USER_GUIDE_EN.md)
- [User Guide — German](docs/USER_GUIDE_DE.md)

## V2.19 highlights

- Native Microsoft 365 calendars in Thunderbird.
- Automatic native synchronization on Thunderbird startup and after Microsoft login.
- Create Teams meetings from Thunderbird's native Calendar toolbar or context menu.
- Double-click native M365 events to open the Graph-aware M365 editor.
- Attendee autocomplete from Thunderbird address books.
- Stable cache reconciliation to prevent duplicates.
- View reload after calendar hide/show.
- Laptop-friendly event/meeting dialogs with fixed action footer and scrollable body.
- DE/EN user and administrator documentation.

## Discoverability / GitHub topics

Recommended GitHub repository description:

> Open-source Microsoft 365 / Exchange Online / Teams calendar integration for Mozilla Thunderbird with native calendar sync, invitations and Teams meeting support.

Recommended GitHub topics:

`thunderbird` · `thunderbird-addon` · `microsoft-365` · `microsoft-graph` · `exchange-online` · `calendar` · `teams` · `teams-meetings` · `oauth2` · `webextension`

## Repository layout

```text
.
├── .github/
├── assets/
│   ├── branding/
│   └── icons/
├── docs/
├── release/
├── source/
│   ├── NATIVE/
│   └── STANDARD/
├── tools/
├── AUTHORS.md
├── BUILD.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── GITHUB_REPOSITORY_SETTINGS.md
├── IMPORT_TO_GITHUB.md
├── LICENSE
├── PRIVACY.md
├── README.md
├── SECURITY.md
└── VERSION
```

## Build

Cross-platform build:

```bash
python tools/build_xpi.py --all
```

Windows users can alternatively run `build_xpi.ps1` inside either source tree.

## Tests

```bash
python tools/run_tests.py
python tools/neutrality_check.py
```

The GitHub Actions workflow runs the same validation automatically on pushes and pull requests.

## Privacy and security

The extension communicates with Microsoft identity endpoints and Microsoft Graph for user-requested calendar operations. OAuth tokens and settings are stored in the local Thunderbird extension/profile storage. The add-on uses `addressBooks` only for read-only attendee suggestions and does not create, modify, or delete contacts.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).

---

<p align="center"><strong>QnD by JK</strong> · Jens Kowalsky</p>
