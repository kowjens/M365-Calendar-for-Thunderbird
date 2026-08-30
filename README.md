<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="180">
</p>

# M365 Calendar for Thunderbird

**Author:** Jens Kowalsky, 3-5 Power Electronics GmbH
**Version:** 2.0.32 / V2.32
**License:** Mozilla Public License 2.0

Open-source Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird using Microsoft Graph, OAuth2/PKCE, Microsoft Teams meeting support, invitation handling and optional native Thunderbird calendar integration.

> This repository is the **public/neutral GitHub edition**. It contains no preconfigured Microsoft Entra Client ID, tenant, or organization-specific OAuth configuration.

## Background and professional context

This project was developed and is maintained by **Jens Kowalsky** as an independent open-source project. It originated from practical Microsoft 365, Exchange Online, Microsoft Teams and Mozilla Thunderbird integration work, including workflows encountered in my professional work at [3-5 Power Electronics GmbH](https://3-5pe.com/).

The project is **not an official product of Microsoft, Mozilla Thunderbird, or 3-5 Power Electronics GmbH**. The company reference documents the real-world professional context in which parts of the workflow and requirements were developed.

### What “QnD” means

**QnD stands for “Quick 'n Dirty”.** It is a deliberately self-deprecating label for the way many of my tools start: I am not a professional software developer; I build pragmatic, functional solutions quickly to solve concrete engineering and workflow problems. Over time, useful tools such as this one are cleaned up, documented and tested for public use. “QnD” describes the origin and development style, not an intention to skip security, testing or maintainability.

## Editions

Two builds are provided. They use the same public add-on ID, so install **one** edition at a time:

- **STANDARD** — Microsoft 365 Space, Graph calendar UI, invitation workflow and Teams meeting creation; no privileged Thunderbird Experiment API.
- **NATIVE** — all STANDARD features plus Microsoft 365 calendars directly inside Thunderbird's built-in Calendar UI, native double-click editing, Teams meeting toolbar/context actions, Thunderbird address-book integration, mail-identity integration and automatic native synchronization. NATIVE uses a privileged Thunderbird Experiment API and Thunderbird may therefore show a broad/full-access warning.

## Quick start

1. Register an application in Microsoft Entra ID.
2. Install either `release/M365_Thunderbird_Calendar_V2.32_STANDARD.xpi` or `release/M365_Thunderbird_Calendar_V2.32_NATIVE.xpi`.
3. In Thunderbird open the **Microsoft 365** Space and click the **gear icon** at the top right.
4. Copy the OAuth Redirect URI shown by the add-on into the Entra app as a **Single-page application (SPA)** redirect URI.
5. Add delegated Microsoft Graph permissions `User.Read`, `Calendars.ReadWrite`, and optionally `Calendars.ReadWrite.Shared`.
6. Enter your Client ID and tenant in the add-on settings, save, and run **Microsoft Login**.

> **Important:** this public repository uses the neutral add-on ID `m365-calendar@jenskowalsky.invalid`. Its OAuth redirect URI therefore differs from private/internal builds. Always use the exact Redirect URI displayed by the installed public add-on.

Detailed instructions:

- [Administrator Guide — English](docs/ADMIN_GUIDE_EN.md)
- [Administrator Guide — German](docs/ADMIN_GUIDE_DE.md)
- [User Guide — English](docs/USER_GUIDE_EN.md)
- [User Guide — German](docs/USER_GUIDE_DE.md)

## V2.32 highlights

- **Diagnostic ZIP:** read-only Graph/Space vs. Thunderbird-native export with selectable range, ICS, cache state, automatic event comparison and recurring-series analysis.
- **Space view switcher:** Month, Week, Day and Agenda views with view-aware navigation.
- **Native plain-event visibility migration:** non-online cached events are recreated once when the native mapping version changes, using Thunderbird's full delete/add observer lifecycle instead of a mapping-only modify.
- **Native completeness:** all non-online cache rows are migrated once to the V2.30 native mapping.
- **Teams creator copy:** Teams creation adds the signed-in organizer as a required attendee.
- **RSVP safety:** Accept/Tentative/Decline use only the dedicated Graph response action and never fall through to a meeting PATCH.
- **Version presentation:** technical add-on version is `2.0.32`; visible UI labels use `V2.32`.
- **Author metadata:** Jens Kowalsky, 3-5 Power Electronics GmbH.
- Existing address-book multi-selection/autocomplete, timezone handling, native double-click editor and Teams meeting integration remain in place.

## GitHub setup and updates

This archive can be published directly from a local folder; **no temporary Git server, webspace or Nextcloud repository is required**.

- [GitHub Desktop: first setup + updates](GITHUB_SETUP_AND_UPDATE.md)
- [GitHub CLI: first setup + releases](GITHUB_CLI.md)

The Desktop-ready archive also contains an initialized local `.git` repository on branch `main` (without a remote and without a fake author e-mail). `INIT_GITHUB.bat` can create the first commit after asking for your Git e-mail address.

## Discoverability / GitHub topics

Recommended repository description:

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
├── GITHUB_SETUP_AND_UPDATE.md
├── GITHUB_CLI.md
├── INIT_GITHUB.bat
├── LICENSE
├── PRIVACY.md
├── README.md
├── SECURITY.md
└── VERSION
```

## Build and tests

```bash
python tools/build_xpi.py --all
python tools/run_tests.py
python tools/neutrality_check.py
```

The GitHub Actions workflow runs the validation automatically on pushes and pull requests.

## Privacy and security

The extension communicates with Microsoft identity endpoints and Microsoft Graph for user-requested calendar operations. OAuth tokens and settings are stored in the local Thunderbird extension/profile storage. The add-on uses Thunderbird address books only for read-only attendee suggestions and does not create, modify, or delete contacts.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).

---

<p align="center"><strong>QnD by JK — Quick 'n Dirty</strong> · Jens Kowalsky</p>
