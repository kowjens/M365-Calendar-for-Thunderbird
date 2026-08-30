<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="180">
</p>

# M365 Calendar for Thunderbird

**Author:** Jens Kowalsky, 3-5 Power Electronics GmbH  
**Version:** 2.0.32 / V2.32  
**License:** Mozilla Public License 2.0

Open-source Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird using Microsoft Graph, OAuth2/PKCE, Microsoft Teams meeting support, invitation handling and optional native Thunderbird calendar integration.

> This repository is the **public/neutral edition**. It contains no preconfigured Microsoft Entra Client ID, tenant, OAuth token or organization-specific configuration.

## Editions

Two builds are provided. They use the same public add-on ID, so install **one** edition at a time:

- **STANDARD** — Microsoft 365 Space, Graph calendar UI, invitation workflow and Teams meeting creation; no privileged Thunderbird Experiment API.
- **NATIVE** — all STANDARD features plus Microsoft 365 calendars in Thunderbird's built-in Calendar UI, native editing, Teams actions, Thunderbird address-book integration and automatic native synchronization. NATIVE uses a privileged Thunderbird Experiment API, so Thunderbird may show a broad/full-access warning.

## Installation

1. Register an application in Microsoft Entra ID.
2. Install either `release/M365_Thunderbird_Calendar_V2.32_STANDARD.xpi` or `release/M365_Thunderbird_Calendar_V2.32_NATIVE.xpi`.
3. In Thunderbird open the **Microsoft 365** Space and click the **gear icon**.
4. Copy the OAuth Redirect URI shown by the add-on into the Entra app as a **Single-page application (SPA)** redirect URI.
5. Add delegated Microsoft Graph permissions `User.Read`, `Calendars.ReadWrite`, and optionally `Calendars.ReadWrite.Shared`.
6. Enter the Client ID and tenant in the add-on settings, save, and run **Microsoft Login**.

> **Important:** the public build uses the neutral add-on ID `m365-calendar@jenskowalsky.invalid`. Always use the exact OAuth Redirect URI displayed by the installed add-on.

### Documentation

- [User Guide — English](docs/USER_GUIDE_EN.md)
- [User Guide — German](docs/USER_GUIDE_DE.md)
- [Administrator Guide — English](docs/ADMIN_GUIDE_EN.md)
- [Administrator Guide — German](docs/ADMIN_GUIDE_DE.md)

## V2.32 highlights

- **Native calendar visibility repair:** one-time full re-adoption of cached Microsoft 365 events, including Teams meetings and recurring instances, using mapping marker `2.32-full-cache-readopt`.
- **Extended diagnostics:** the diagnostic ZIP compares Graph/Space data with Thunderbird native cache data and includes native range-query diagnostics.
- **Space views:** Month, Week, Day and Agenda views with view-aware navigation.
- **Teams creator copy:** Teams creation adds the signed-in organizer as a required attendee.
- **RSVP safety:** Accept/Tentative/Decline use the dedicated Microsoft Graph response action and do not fall through to a meeting update.
- Existing address-book autocomplete, timezone handling, native editing and Teams integration remain available.

See [RELEASE_NOTES_V2.32.md](RELEASE_NOTES_V2.32.md) for release details and [CHANGELOG.md](CHANGELOG.md) for version history.

## Build and tests

Requirements and build commands are documented in [BUILD.md](BUILD.md). In short:

```bash
python tools/build_xpi.py --all
python tools/run_tests.py
python tools/neutrality_check.py
```

GitHub Actions also validates pushes and pull requests.

## Contributing

Contributions and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

Please do not commit tenant-specific Client IDs, tenant names, OAuth tokens, secrets, Thunderbird profile data or exported calendar diagnostics containing personal data.

## Privacy and security

The extension communicates with Microsoft identity endpoints and Microsoft Graph for calendar operations requested by the user. OAuth tokens and settings are stored locally in the Thunderbird extension/profile storage.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Project status and authorship

The project is maintained by **Jens Kowalsky** and originated from practical Microsoft 365 / Thunderbird integration work. It is not an official product of Microsoft, Mozilla Thunderbird, or 3-5 Power Electronics GmbH.

See [AUTHORS.md](AUTHORS.md) for authorship information.

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).

---

<p align="center"><strong>QnD by JK — Quick 'n Dirty</strong> · Jens Kowalsky</p>
