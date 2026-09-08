# Troubleshooting and known issues

## Event is present in Month view but missing in one Multiweek position

An observed Thunderbird case can look like this:

- an event is visible in Month view;
- in a two-week Multiweek range it is missing when its week is the second row;
- after moving the view so the same week becomes the first row, the event appears.

For a reproduced V2.32 case, two diagnostic exports covering overlapping 14-day ranges showed that the affected event was:

1. returned by Microsoft Graph;
2. present in the add-on's native Thunderbird cache;
3. returned by the native `eventParents` range query;
4. returned by the native `eventOccurrences` range query; and
5. returned by the native `allOccurrences` range query

**in both date ranges**.

That means the event was available to Thunderbird in both cases and the difference occurred later in Thunderbird's Calendar view/rendering layer. A historically similar Thunderbird issue is Mozilla Bugzilla 1790869 (events missing in Month/Multiweek until view navigation). This does not prove the same internal root cause in current Thunderbird versions, but it is a useful comparison.

### What to do

- Switch Month ↔ Multiweek or move the Multiweek range by one week to force a redraw.
- Do not repeatedly delete/recreate the Microsoft 365 calendar solely for this symptom.
- If the event is missing from Graph/cache/range diagnostics as well, then it is a different synchronization problem and the diagnostic ZIP should be attached to a private support/debug report after removing sensitive data as appropriate.

## Create a diagnostic ZIP

In the NATIVE edition open Microsoft 365 → Settings → Native Thunderbird calendar integration and create a diagnostic ZIP for the affected period. OAuth access/refresh tokens are excluded, but event content and attendee addresses can be included.

## Reminder Dismiss/Snooze must not send meeting updates (V2.36)

V2.35 could interpret Thunderbird's local alarm acknowledgement change as a native calendar `modifyItem()` and, for organizer-owned meetings, offer to send a meeting update. V2.36 classifies unchanged Graph-relevant event data as **local-only**. Dismiss/Snooze is written only to Thunderbird's cache; there is no Graph PATCH and no outgoing-message confirmation. If a confirmation still appears after Dismiss on V2.36, capture a diagnostic export before confirming anything.
