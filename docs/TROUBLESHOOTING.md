# Troubleshooting and known issues

## Event is visible in Day/Week but missing in Month or Multiweek (NATIVE, known host issue)

V2.47 deep diagnostics reproduced this with complete Graph/native data. For the exact affected Multiweek range, Thunderbird's cached wrapper, underlying provider and offline storage returned the same events, and corresponding `calendar-month-day-box-item` objects were found in the Month/Multiweek DOM scan.

V2.48 therefore treats the remaining failure as a Thunderbird Calendar frontend/rendering limitation instead of applying another synchronization rewrite. A forced `refreshItems(true)` did not resolve the symptom in V2.46.

**Recommended:** use Day/Week or the add-on's Microsoft 365 Space when event completeness is critical. If reporting the problem, create a diagnostic ZIP before navigating away. See [Known issues](KNOWN_ISSUES.md).

## Create a diagnostic ZIP

In the NATIVE edition open Microsoft 365 → Settings → Native Thunderbird calendar integration and create a diagnostic ZIP for the affected period. OAuth access/refresh tokens are excluded, but event content and attendee addresses can be included.

## Reminder Dismiss/Snooze must not send meeting updates (V2.36)

V2.35 could interpret Thunderbird's local alarm acknowledgement change as a native calendar `modifyItem()` and, for organizer-owned meetings, offer to send a meeting update. V2.36 classifies unchanged Graph-relevant event data as **local-only**. Dismiss/Snooze is written only to Thunderbird's cache; there is no Graph PATCH and no outgoing-message confirmation. If a confirmation still appears after Dismiss on V2.36, capture a diagnostic export before confirming anything.

## Accepting an email invitation shows `Processing message failed. Status: 80004005` (fixed in V2.37)

Thunderbird can process an iTIP invitation before the associated Exchange event is visible through the provider's normal synchronization path. V2.37 reconciles the email invitation against the native cache first, retries the Graph lookup for a short bounded interval, and does not report a post-response readback/cache error as a failed RSVP after Microsoft Graph already accepted the response. The invitation path remains fail-closed and never creates a replacement meeting.


## Thunderbird Monthly update: settings/buttons or native calendar appear unresponsive

V2.38 introduced a standalone diagnostics/options page after a Thunderbird 156 system showed a state where the Experiment namespace appeared loaded while settings, native buttons and calendar integration were unresponsive. A manifest maximum alone does **not** prove the runtime root cause if the add-on is actually loaded. V2.39 therefore avoids an artificial maximum in GitHub builds and treats such cases as real runtime compatibility issues that need diagnostics.

Open **Add-ons and Themes → M365 Calendar for Thunderbird → Preferences/Options** and capture:

- Thunderbird and add-on version;
- background responsiveness;
- Native Experiment ping;
- provider/module registration state;
- registered calendar count; and
- any provider load error.

ESR is recommended for production because Experiment APIs are less exposed to frequent major-version changes, but Monthly releases remain a supported/testable target.
