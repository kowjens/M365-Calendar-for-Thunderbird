# M365 Calendar for Thunderbird V2.33

V2.33 is a public-release and addons.thunderbird.net readiness update. The Microsoft 365 synchronization model is unchanged from V2.32.

## Changes

- Public NATIVE add-on ID changed from the temporary `.invalid` development ID to the stable `m365-calendar-public@35pwr.com` ID.
- Public STANDARD uses the separate ID `m365-calendar-standard@35pwr.com`.
- Added `sensitiveDataUpload` to declare the required transfer of calendar/account data to Microsoft Graph.
- NATIVE declares Thunderbird compatibility `128.0` through `154.*`; future major versions will be enabled after Experiment compatibility testing.
- Fixed the GitHub public-branding regression test to expect the configured author `Jens Kowalsky, 3-5 Power Electronics GmbH`.
- GitHub Actions moved to current Node-24-based action generations and Python is pinned to 3.13.
- XPI builds are now deterministic and the repository includes an ATN-specific preflight validation.
- Expanded privacy, permission and reviewer documentation.

## Thunderbird Multiweek observation

Two overlapping V2.32 diagnostic exports showed the same affected event in Graph, the native cache and every diagnostic native range query, although Thunderbird's Multiweek UI rendered it in only one of the two overlapping view positions. No cache/sync workaround is added for that frontend-only symptom.
