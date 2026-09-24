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
| **NATIVE** | Yes | Yes | Recommended full integration |
| **STANDARD** | No | No | Graph/M365 Space fallback |
| **INTERNAL NATIVE** | Yes | Yes | Preconfigured internal deployment |
| **INTERNAL STANDARD** | No | No | Preconfigured internal fallback |

Public IDs:

- NATIVE: `m365-calendar-for-thunderbird@3-5pe.com`
- STANDARD: `m365-calendar-standard@3-5pe.com`

Thunderbird **ESR is recommended for production**. GitHub/INTERNAL NATIVE builds are uncapped; the ATN Experiment package carries the validated ATN maximum (`156.*`).

## Highlights

- Microsoft Graph calendar synchronization
- Native Thunderbird calendar provider (NATIVE)
- Create/edit events and Teams meetings
- Accept / Tentative / Decline meeting requests
- Recurring events and exceptions
- Thunderbird address-book attendee suggestions
- Microsoft 365 Month / Week / Day / Agenda Space
- Outgoing meeting-message confirmation
- Diagnostic export and native-provider diagnostics
- **Split-mail support (introduced in V2.42):** safe handling of external iMIP invitations received through a non-Microsoft IMAP mailbox

## one.com + Exchange Online split mail

The split-mail support introduced in V2.42 is designed for deployments where normal mail remains at a third-party provider such as **one.com**, while Teams/calendar processing runs through Exchange Online.

The preferred production architecture follows Microsoft's documented third-party-mail model: keep the existing MX, dual-deliver/forward inbound mail to Exchange Online, process `Calendaring` messages there and discard the forwarded non-calendar copy. This allows ordinary IMAP/SMTP mail to remain at one.com while meeting requests and responses populate the Microsoft 365 calendar.

The NATIVE edition also contains an optional safety fallback for an unmatched external iMIP request: it creates a **personal M365 copy without attendees** and lets Thunderbird send the RSVP through the receiving mail identity. It never recreates the invitation as a new Graph meeting with the original attendee list.

**Setup guide:** [one.com + Exchange Online calendar relay](docs/setup/ONECOM_EXCHANGE_CALENDAR_RELAY_DE.md)

## Quick start

1. Install NATIVE (or STANDARD if Experiment APIs are not desired).
2. Open **Settings & diagnostics**.
3. Copy the displayed OAuth redirect URI.
4. Create a Microsoft Entra SPA app and add the delegated Graph permissions.
5. Enter **Application (Client) ID** and **Directory (tenant) ID**.
6. Select **Microsoft login**.

Detailed Entra setup: [German](docs/setup/MICROSOFT_ENTRA_SETUP_DE.md) · [English](docs/setup/MICROSOFT_ENTRA_SETUP_EN.md)

## Documentation

Start with the [documentation index](docs/README.md).

| Topic | German | English |
|---|---|---|
| User guide | [DE](docs/USER_GUIDE_DE.md) | [EN](docs/USER_GUIDE_EN.md) |
| Administrator guide | [DE](docs/ADMIN_GUIDE_DE.md) | [EN](docs/ADMIN_GUIDE_EN.md) |
| Entra app setup | [DE](docs/setup/MICROSOFT_ENTRA_SETUP_DE.md) | [EN](docs/setup/MICROSOFT_ENTRA_SETUP_EN.md) |
| one.com / Exchange calendar relay | [DE](docs/setup/ONECOM_EXCHANGE_CALENDAR_RELAY_DE.md) | [EN](docs/setup/ONECOM_EXCHANGE_CALENDAR_RELAY_EN.md) |

Also see [Permissions](docs/PERMISSIONS.md), [Compatibility](docs/COMPATIBILITY.md), [Troubleshooting](docs/TROUBLESHOOTING.md), [Changelog](CHANGELOG.md) and [V2.43 release notes](docs/releases/V2.43.md).

## Microsoft Entra permissions

The public build contains no tenant-specific Client ID. Configure your own Entra SPA registration with delegated access required by the add-on, including `User.Read`, `Calendars.ReadWrite` and `Calendars.ReadWrite.Shared`, plus the OIDC/OAuth scopes used for login and refresh tokens.

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
