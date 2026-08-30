# Release Notes V2.27

V2.27 targets the remaining native-calendar issue confirmed in the live installation: plain Microsoft 365 appointments are visible in the Microsoft 365 Space but not in Thunderbird's native calendar, while Teams/online meetings are visible.

Changes:
- Keep Graph/Space fetching unchanged.
- Mirror plain appointments in Thunderbird storage with a synthetic accepted self-attendee and organizer, marked `X-M365-SYNTHETIC-SELF`.
- Strip the synthetic attendee again before native edits are converted to Graph payloads.
- Add type-specific Graph/cache diagnostics for appointments, online meetings and other meetings.
- Preserve V2.25/V2.26 address-book and synchronization fixes.
