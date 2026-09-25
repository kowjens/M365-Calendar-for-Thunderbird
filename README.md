<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="150">
</p>

# M365 Calendar for Thunderbird

Open-source Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird using **Microsoft Graph**, **OAuth2 Authorization Code + PKCE**, Microsoft Teams meeting support and an optional deeper integration into Thunderbird's built-in Calendar.

**Version:** 2.0.48 / V2.48  
**Author:** Jens Kowalsky, 3-5 Power Electronics GmbH  
**License:** Mozilla Public License 2.0

> Independent community project. Not an official Microsoft, Mozilla/Thunderbird or 3-5 Power Electronics product.

**Current release V2.48:** V2.47 diagnostics reproduced the Month/Multiweek omission with the affected events still present in Microsoft Graph results, Thunderbird native cache, cached calendar wrapper, underlying provider queries and instantiated `calendar-month-day-box-item` objects. V2.48 therefore treats this as a **known Thunderbird Calendar frontend/rendering limitation** for the NATIVE edition rather than applying another synchronization workaround. Runtime calendar mapping is intentionally unchanged; the deep diagnostics remain available for upstream investigation. See [Known issues](docs/KNOWN_ISSUES.md) and [V2.48 release notes](docs/releases/V2.48.md).

## Public editions

| Edition | Native Thunderbird Calendar | Custom Experiment API | Distribution |
|---|---:|---:|---|
| **ATN STANDARD** | No | No | addons.thunderbird.net |
| **GITHUB STANDARD** | No | No | GitHub releases |
| **GITHUB NATIVE** | Yes | Yes (`nativeCalendar`) | GitHub releases |

Public add-on IDs:

- STANDARD / ATN STANDARD: `m365-calendar-standard@3-5pe.com`
- GITHUB NATIVE: `m365-calendar-for-thunderbird@3-5pe.com`

The **ATN STANDARD** and **GITHUB STANDARD** editions use normal Thunderbird WebExtension APIs and provide the Microsoft 365 Space, Graph-backed calendar operations, Teams meeting support and invitation actions. They intentionally do **not** register Microsoft 365 calendars in Thunderbird's built-in Calendar view.

The **GITHUB NATIVE** edition adds that deeper Thunderbird Calendar integration through the `nativeCalendar` Experiment API. Because addons.thunderbird.net currently pauses new submissions using custom Experiment APIs, NATIVE is distributed through GitHub rather than ATN.

Thunderbird **ESR is recommended for production**, especially for the NATIVE edition because Thunderbird-internal calendar interfaces can change between major releases.

## Highlights

- Microsoft Graph calendar synchronization and event management
- Microsoft 365 Month / Week / Day / Agenda Space
- Create and edit events and Microsoft Teams meetings
- Accept / Tentative / Decline meeting requests
- Recurring events and exceptions
- Thunderbird address-book attendee suggestions
- Outgoing meeting-message confirmation
- Diagnostic export
- Optional native Thunderbird Calendar provider in GITHUB NATIVE

## Quick start

1. Install **ATN STANDARD / GITHUB STANDARD** for the normal WebExtension edition, or **GITHUB NATIVE** for deeper Thunderbird Calendar integration.
2. Open **Settings & diagnostics**.
3. Copy the displayed OAuth redirect URI.
4. Create a Microsoft Entra SPA application and add the required delegated Microsoft Graph permissions.
5. Enter the **Application (Client) ID** and **Directory (tenant) ID** in the add-on.
6. Select **Microsoft login**.

Detailed Microsoft Entra setup: [German](docs/setup/MICROSOFT_ENTRA_SETUP_DE.md) · [English](docs/setup/MICROSOFT_ENTRA_SETUP_EN.md)

## Documentation

Start with the [documentation index](docs/README.md).

| Topic | German | English |
|---|---|---|
| User guide | [DE](docs/USER_GUIDE_DE.md) | [EN](docs/USER_GUIDE_EN.md) |
| Administrator guide | [DE](docs/ADMIN_GUIDE_DE.md) | [EN](docs/ADMIN_GUIDE_EN.md) |
| Microsoft Entra app setup | [DE](docs/setup/MICROSOFT_ENTRA_SETUP_DE.md) | [EN](docs/setup/MICROSOFT_ENTRA_SETUP_EN.md) |

Also see [Permissions](docs/PERMISSIONS.md), [Compatibility](docs/COMPATIBILITY.md), [Troubleshooting](docs/TROUBLESHOOTING.md), [Changelog](CHANGELOG.md), [Publishing text](PUBLISHING.md) and [V2.48 release notes](docs/releases/V2.48.md).

## Microsoft Entra configuration

The public editions do not ship with a Microsoft Entra Client ID or tenant ID. Configure your own SPA application registration with the delegated permissions required by the add-on, including `User.Read`, `Calendars.ReadWrite` and `Calendars.ReadWrite.Shared`, plus the OIDC/OAuth scopes used for sign-in and refresh tokens.

No client secret is used or required.

## Build and test

```bash
python tools/version_check.py
python tools/run_tests.py
python tools/neutrality_check.py
python tools/atn_check.py
python tools/build_xpi.py --all
python tools/build_xpi.py --atn
python tools/package_check.py
```

See [BUILD.md](BUILD.md).

## Privacy

Calendar/meeting data is exchanged with Microsoft identity and Microsoft Graph endpoints only as required for the configured functionality. Tokens and configuration are stored locally in the Thunderbird profile. The project has no analytics, advertising or project-operated telemetry backend.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).
