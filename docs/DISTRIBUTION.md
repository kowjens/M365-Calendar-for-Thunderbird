# Distribution model

M365 Calendar for Thunderbird deliberately separates store-compatible and deeper native integration.

| Edition | ID | Built-in Thunderbird Calendar provider | Experiment API | Channel |
|---|---|---:|---:|---|
| ATN STANDARD | `m365-calendar-standard@3-5pe.com` | No | No | ATN |
| GITHUB STANDARD | `m365-calendar-standard@3-5pe.com` | No | No | GitHub |
| GITHUB NATIVE | `m365-calendar-for-thunderbird@3-5pe.com` | Yes | `nativeCalendar` | GitHub |

STANDARD and ATN STANDARD are built from the same source and are byte-identical. NATIVE has a distinct add-on ID so changing edition is an explicit installation decision.

The public repository must contain only neutral public defaults. Private deployment defaults, internal add-on IDs, tenant/application identifiers and provider-specific routing material belong only in the private internal package.
