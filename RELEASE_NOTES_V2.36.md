# M365 Calendar for Thunderbird V2.36

V2.36 is a safety and native-calendar correctness release.

## Fixed: reminder Dismiss/Snooze must stay local

Thunderbird updates local alarm bookkeeping when a reminder is dismissed or snoozed. In V2.35 this arrived through the native provider as `modifyItem()` and could be mistaken for a real organizer-owned meeting edit. With outgoing-message confirmation enabled this produced a misleading **Meeting update** confirmation dialog; confirming it could then allow a Microsoft Graph event PATCH.

V2.36 adds two independent guards:

1. **Native-provider local-only fast path.** If the remote representation of the event is unchanged, the exact Thunderbird `newItem` is written back to the cache and no extension/background write event is emitted. This preserves Thunderbird's alarm acknowledgement and snooze state.
2. **Background Graph-relevant comparison.** Before an organizer update can display a confirmation or call Graph, the add-on compares the fields it can actually write to Graph. If they are unchanged, the operation is marked `local-only` and no network write occurs.

This means reminder **Dismiss** and **Snooze** do not trigger an outgoing-message confirmation, Graph PATCH, invitation or meeting-update email.

## Still treated as real remote changes

- changing the configured reminder offset (for example 15 to 30 minutes)
- changing subject, start/end, location, body, categories, privacy/free-busy or attendees
- RSVP state changes (Accept/Tentative/Decline)

The V2.34 invitation/Teams fixes and V2.35 outgoing-message confirmation remain included.
