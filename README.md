<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="150">
</p>

# M365 Calendar for Thunderbird

Open-source Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird using **Microsoft Graph**, **OAuth2 Authorization Code + PKCE**, Microsoft Teams meeting support and optional native Thunderbird Calendar integration.

**Version:** 2.0.43 / V2.43  
**Author:** Jens Kowalsky, 3-5 Power Electronics GmbH  
**License:** Mozilla Public License 2.0

> Independent community project. Not an official Microsoft, Mozilla/Thunderbird or 3-5 Power Electronics product.

## Editions

| Edition | Native Thunderbird Calendar | Experiment API | Intended use |
|---|---:|---:|---|
| **NATIVE** | Yes | Yes | Full integration with Thunderbird's built-in Calendar |
| **STANDARD** | No | No | Microsoft 365 Space / Graph integration without a privileged Experiment API |
| **ATN NATIVE** | Yes | Yes | NATIVE package prepared for addons.thunderbird.net review/distribution |

Public add-on IDs:

- NATIVE / ATN NATIVE: `m365-calendar-for-thunderbird@3-5pe.com`
- STANDARD: `m365-calendar-standard@3-5pe.com`

Thunderbird **ESR is recommended for production**. The GitHub NATIVE package is not artificially capped with `strict_max_version`; the ATN Experiment package carries the validated ATN maximum (`156.*`).

## Highlights

- Microsoft Graph calendar synchronization
- Native Thunderbird calendar provider (NATIVE / ATN NATIVE)
- Create and edit events and Microsoft Teams meetings
- Accept / Tentative / Decline meeting requests
- Recurring events and exceptions
- Thunderbird address-book attendee suggestions
- Microsoft 365 Month / Week / Day / Agenda Space
- Outgoing meeting-message confirmation
- Diagnostic export and native-provider diagnostics
- Optional safe fallback for external iMIP invitations that are received by Thunderbird before a corresponding Exchange event is available

## Quick start

1. Install **NATIVE** for full Thunderbird Calendar integration, or **STANDARD** if you do not want to use the Experiment API.
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

Also see [Permissions](docs/PERMISSIONS.md), [Compatibility](docs/COMPATIBILITY.md), [Troubleshooting](docs/TROUBLESHOOTING.md), [Changelog](CHANGELOG.md) and [V2.43 release notes](docs/releases/V2.43.md).

## Microsoft Entra configuration

The public distributions do not ship with a Microsoft Entra Client ID or tenant ID. Configure your own SPA application registration with delegated access required by the add-on, including `User.Read`, `Calendars.ReadWrite` and `Calendars.ReadWrite.Shared`, plus the OIDC/OAuth scopes used for sign-in and refresh tokens.

No client secret is used or required.

## Build and test

```bash
python tools/version_check.py
python tools/run_tests.py
python tools/neutrality_check.py
python tools/atn_check.py
python tools/build_xpi.py --all
python tools/build_xpi.py --atn
```

See [BUILD.md](BUILD.md).

## Privacy

Calendar/meeting data is exchanged with Microsoft identity and Microsoft Graph endpoints only as required for the configured functionality. Tokens and configuration are stored locally in the Thunderbird profile. The project has no analytics, advertising or project-operated telemetry backend.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).
