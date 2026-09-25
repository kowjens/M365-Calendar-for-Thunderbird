# Known issues

## Thunderbird Month/Multiweek can omit NATIVE calendar events

**Scope:** GITHUB NATIVE edition / Thunderbird built-in Calendar. The add-on's own Microsoft 365 Space (STANDARD and NATIVE) is not this view.

### Symptom

Events that are present in Day/Week can be visually missing in Month or in one row of a two-week Multiweek view. Navigating or changing view position can change which events appear.

### Evidence collected with V2.47

A reproduced Thunderbird 153.3.1 diagnostic showed:

- Graph diagnostic range: 35 events
- Native cache diagnostic range: 35 events
- missing from native cache: 0
- native-only: 0
- series with missing native instances: 0
- exact visible Multiweek range: cached wrapper 5 / underlying provider 5 / offline storage 5
- the same five events were found as `calendar-month-day-box-item` objects by the read-only DOM diagnostic

The DOM scan records very small element bounding rectangles in the reproduced state. It therefore demonstrates item instantiation/data attachment, but does not claim that Thunderbird successfully laid out and painted those items.

### Project position

The evidence does not support another Graph-sync or native-cache rewrite. V2.46 already tested a forced `refreshItems(true)` refresh without resolving the symptom. V2.48 therefore avoids another destructive GUI workaround and keeps the deep diagnostics for upstream analysis.

### Practical workarounds

Until the Thunderbird Calendar frontend behavior is resolved:

- use **Day or Week** view when completeness is critical;
- use the add-on's own Microsoft 365 Space as a cross-check;
- after seeing a suspicious Month/Multiweek gap, do not assume the event was deleted from Microsoft 365;
- a diagnostic ZIP can be created from Settings & diagnostics for comparison.

### Related upstream reports

- Mozilla Bugzilla 1790869 — historical Month/Multiweek missing-event symptom, resolved as a duplicate in the Thunderbird 102 era.
- Mozilla Bugzilla 1789437 — historical invisible-event/recurrence issue fixed years ago.
- Mozilla Bugzilla 725276 — recurring appointments not displayed under certain conditions; recent comments include Exchange/365 reproduction.
- Mozilla Bugzilla 1862611 / 1713625 — separate offline-cache deletion issue fixed in Thunderbird 155; our reproduced case differs because offline storage still contains the affected events.

A new public-safe Bugzilla report package is prepared with V2.48. After an upstream bug ID is assigned, add its link here.
