# Test Report — V2.32

## Automated verification

- STANDARD JavaScript syntax checks: passed.
- NATIVE JavaScript syntax checks, including privileged `nativeCalendar` Experiment API: passed.
- STANDARD regression tests: **23/23 passed**.
- NATIVE regression tests: **51/51 passed**.
- Public/GitHub neutrality check: passed.
- Both V2.32 public XPI builds completed successfully and ZIP/XPI integrity was verified.

## V2.32-specific coverage

- Diagnostic export runtime route is present.
- Raw Graph `calendarView` capture and Space snapshot export are present.
- Native Experiment exposes a read-only cache export with VEVENT/ICS serialization.
- Diagnostic collection does not call native synchronization.
- Graph/native automatic comparison is present with Graph-ID matching and `iCalUId + start` fallback.
- Recurring-series comparison with missing occurrence/exception reporting is present.
- Diagnostic ZIP UI includes date-range selection and exports `comparison.csv`, `series_comparison.json`, `native_cache.json`, and `native_calendar.ics`.
- OAuth access/refresh tokens are not part of the diagnostic payload.

## Retained regression coverage

V2.30 RSVP isolation, Teams organizer-attendee behavior and non-online native visibility migration remain covered, as do prior native provider lifecycle, cache reconciliation, timezone, address-book, popup, read-after-write and Space-view tests.

## Package hashes

- `M365_Thunderbird_Calendar_V2.32_NATIVE.xpi`: `4acbeda874241fffa095fe5dc381dd93c6f9b0300541f3066da139de80aaef43`
- `M365_Thunderbird_Calendar_V2.32_STANDARD.xpi`: `8c1c9bf53c1a03535f80ce7171492b5986a3807fcf742ba4f90e090f13221307`

The automated suite validates code paths and package integrity. The diagnostic export itself is intended to capture the next real failing mailbox state so the isolated missing-series-instance issue can be analysed from real Graph and Thunderbird cache data.
