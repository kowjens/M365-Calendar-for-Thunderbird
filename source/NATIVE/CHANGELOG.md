# Changelog

All public releases are authored and maintained by **Jens Kowalsky**.

## V2.19

- Viewport-safe M365 dialogs with fixed header/footer and one scrollable body.
- Compact monitor-aware native Teams/event popup.
- Long Teams/meeting URLs wrap instead of forcing horizontal scrolling.
- Responsive layout for small and low-height laptop displays.

## V2.18

- Fixed Thunderbird address-book attendee autocomplete with MV2 `contacts.quickSearch([parentId], queryInfo)`.
- Added local address-book fallback and visible search status/errors.
- Double-clicking a native M365 event opens the Graph-aware M365 editor.

## V2.17

- Adaptive Teams meeting popup.
- Native Calendar context-menu action **New Teams meeting**.
- Thunderbird address-book autocomplete for attendees.
- Added `addressBooks` permission, used read-only for contact suggestions.

## V2.16

- Expanded DE/EN Entra administrator guides and user guides.
- Added a **Teams meeting** button directly to Thunderbird's native Calendar.
- Added neutral GitHub distribution packaging.

## V2.15

- Automatic native synchronization on Thunderbird startup, after login, and when native integration is enabled.

## V2.14

- Reload current Thunderbird calendar view after M365 calendar hide/show without changing the selected day/week.

## V2.13

- Native cache reconciliation by stable Graph event ID using add/modify/delete instead of clear/re-add.
- Preserve Thunderbird calendar visibility/enabled state across syncs.

## V2.12

- Current Thunderbird event construction with `CalEvent`, `CalAttendee`, and `CalAlarm`.

## V2.11

- Direct native cache population and detailed synchronization diagnostics.

## V2.09–V2.10

- Native provider startup/registration fixes for current Thunderbird internals.
