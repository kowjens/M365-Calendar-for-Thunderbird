# Release Notes – V2.32

## Read-only calendar diagnostic export

V2.32 adds a **Calendar diagnostic export** to the NATIVE build under **Microsoft 365 → Settings → Native Thunderbird calendar integration**. A start and end date can be selected; the default window is four weeks in the past through eight weeks in the future.

The export deliberately does **not** start a native synchronization. This is important when investigating events that are visible in the Microsoft 365 Space but missing from Thunderbird's native calendar: the failing native cache is captured before anything can rewrite it.

The generated ZIP contains:

- `summary.txt` – compact counts and missing/native-only rows.
- `graph_calendarview_raw.json` – raw Microsoft Graph `calendarView` rows.
- `space_snapshot.json` – hydrated event snapshot used by the Microsoft 365 Space for the selected range.
- `space_cache.json` – matching add-on cache windows.
- `native_cache.json` – actual Thunderbird provider-cache objects including Graph type, `seriesMasterId`, `iCalUId`, mapping version and recurrence metadata.
- `native_calendar.ics` – VEVENT representation read from the native cache.
- `native_diagnostics.json` – provider/cache diagnostics and non-secret authentication state.
- `comparison.json` and `comparison.csv` – Graph-to-native matching by Graph ID with an `iCalUId + start` fallback.
- `series_comparison.json` – recurring-series groups with missing occurrences/exceptions highlighted.

No OAuth access token or refresh token is exported. The archive does contain calendar subjects/content and attendee addresses and should therefore be treated as confidential diagnostic data.

## Version

- Technical manifest version: `2.0.32`
- Visible product version: `V2.32`
- Author: Jens Kowalsky, 3-5 Power Electronics GmbH
