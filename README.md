<p align="center">
  <img src="assets/branding/qnd-by-jk-512.png" alt="QnD by JK" width="160">
</p>

# M365 Calendar for Thunderbird

Open-source **Microsoft 365 / Exchange Online calendar integration for Mozilla Thunderbird** using Microsoft Graph and OAuth2/PKCE, with Teams meeting support, invitation handling and optional integration into Thunderbird's native Calendar UI.

**Version:** 2.0.33 / V2.33  
**Author:** Jens Kowalsky, 3-5 Power Electronics GmbH  
**License:** Mozilla Public License 2.0

> Independent community project. It is not an official product of Microsoft, Mozilla/Thunderbird, or 3-5 Power Electronics GmbH.

## Editions

- **NATIVE — recommended/public ATN edition.** Adds Microsoft 365 calendars to Thunderbird's built-in Calendar UI and keeps the M365 Space, Teams meeting creation, invitation handling, attendee autocomplete and Graph synchronization. It uses a Thunderbird Experiment API; Thunderbird therefore displays the broad **“full, unrestricted access”** permission warning.
- **STANDARD — GitHub fallback edition.** Provides the M365 Space, Graph calendar UI, Teams meeting creation and invitation workflow without the privileged native-calendar Experiment.

The public editions intentionally use different stable add-on IDs:

- NATIVE: `m365-calendar-public@35pwr.com`
- STANDARD: `m365-calendar-standard@35pwr.com`

## Quick start

The public build uses **bring-your-own Microsoft Entra application registration**. No tenant or Client ID is embedded in the public package.

1. Install the NATIVE XPI from `release/` (or from addons.thunderbird.net after publication).
2. Open the **Microsoft 365** Space in Thunderbird and open **Settings**.
3. Copy the OAuth redirect URI shown by the add-on.
4. Register/configure a Microsoft Entra SPA application with delegated Graph permissions `User.Read`, `Calendars.ReadWrite` and `Calendars.ReadWrite.Shared`.
5. Enter the Client ID and tenant in the add-on settings and select **Microsoft Login**.

Detailed setup:

- [User guide — English](docs/USER_GUIDE_EN.md)
- [User guide — German](docs/USER_GUIDE_DE.md)
- [Administrator guide — English](docs/ADMIN_GUIDE_EN.md)
- [Administrator guide — German](docs/ADMIN_GUIDE_DE.md)
- [Troubleshooting / known Thunderbird view issue](docs/TROUBLESHOOTING.md)
- [Permissions and Microsoft Graph scopes](docs/PERMISSIONS.md)

## Main features

- Microsoft Graph OAuth2 Authorization Code + PKCE
- Microsoft 365 Space with Month, Week, Day and Agenda views
- Native Thunderbird calendar integration in the NATIVE edition
- Create and edit Microsoft 365 events
- Create Microsoft Teams meetings
- Accept / tentative / decline meeting invitations through Graph
- Thunderbird address-book suggestions for attendees
- Recurring event and exception synchronization
- Read-only diagnostic export comparing Graph, M365 Space and Thunderbird native cache/range queries
- No analytics, advertising or project-operated telemetry service

## V2.33

V2.33 is primarily a **public-release / addons.thunderbird.net readiness release**. Calendar synchronization behavior remains based on V2.32.

- Stable public add-on IDs on the `35pwr.com` domain
- ATN-required `sensitiveDataUpload` declaration for Microsoft Graph communication
- NATIVE compatibility capped at Thunderbird `154.*` because the native integration uses an Experiment API
- GitHub Actions updated to current Node-24-based action generations
- Fixed the public branding regression test that caused the previous GitHub `Validate` run to fail
- Deterministic XPI packaging and an additional ATN preflight check
- Privacy and review documentation expanded for manual ATN review

## Known Thunderbird Multiweek display issue

A V2.32 diagnostic comparison reproduced a case where the **same event was returned by Graph, stored in the native cache and returned by all native range-query variants in two overlapping 14-day ranges, but Thunderbird rendered it only when its week was the first row of Multiweek view**. This strongly localizes that specific symptom to Thunderbird's calendar view/rendering layer rather than Graph synchronization.

See [Troubleshooting](docs/TROUBLESHOOTING.md). No destructive sync workaround is applied for this frontend-only symptom.

## Related projects and alternatives

Different projects solve Exchange/Microsoft 365 integration in different ways:

- [TbSync + Provider for Exchange ActiveSync](https://addons.thunderbird.net/thunderbird/addon/eas-4-tbsync/) — EAS-based calendar/contact synchronization
- [Exchange Calendar Sync for Thunderbird](https://github.com/michafn/exchange-cal-sync-thunderbird) — open-source EWS-based calendar synchronization
- [Owl for Exchange](https://addons.thunderbird.net/thunderbird/addon/owl-for-exchange/) — commercial Exchange/Microsoft 365 integration
- [ExQuilla for Exchange](https://addons.thunderbird.net/thunderbird/addon/exquilla-exchange-web-services/) — commercial EWS integration

M365 Calendar for Thunderbird differs by focusing on **Microsoft Graph calendar/Teams workflows and native Thunderbird calendar integration**.

## Build and test

```bash
python tools/run_tests.py
python tools/neutrality_check.py
python tools/atn_check.py
python tools/build_xpi.py --all
```

See [BUILD.md](BUILD.md) for details.

## Privacy and security

Calendar/meeting data is exchanged only with Microsoft identity/Graph endpoints as required for the requested Microsoft 365 functionality. OAuth tokens, settings and native calendar cache data are stored locally in the Thunderbird profile. The project has no analytics or telemetry backend.

- [Privacy policy](PRIVACY.md)
- [Security policy](SECURITY.md)

## License

Mozilla Public License 2.0 — see [LICENSE](LICENSE).
