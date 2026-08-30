# Release Notes – V2.30

## Native calendar completeness

V2.30 extends the V2.29 visibility migration to **all non-online Graph events**, including ordinary meetings with attendees. V2.29 only required the new mapping version for personal appointments, so a non-Teams meeting with unchanged Graph content could retain an older Thunderbird cache row indefinitely. V2.30 bumps the native mapping schema to `2.30-native-nononline-visibility`; every outdated non-online row is deleted and re-adopted once so Thunderbird receives a fresh delete/add observer lifecycle. Native diagnostics now also expose `syncCacheOtherMeetings`.

## Teams organizer invitation

When a Teams event is created in the Microsoft 365 Space, V2.30 explicitly adds the signed-in organizer to the Graph Event `attendees` collection (unless already present). This keeps the creator in the same invitation-processing path as the other required attendees. The meeting remains organized by the signed-in Microsoft 365 account.

## Correct RSVP handling

Accept/Tentative/Decline from Thunderbird's native calendar is now treated as an exclusive Graph response action. The add-on detects the response change before organizer classification, calls `/me/events/{id}/accept`, `/tentativelyAccept`, or `/decline` with `sendResponse=true`, refreshes the event, and returns immediately. The RSVP operation can no longer fall through into a general event PATCH that could resend the original meeting to attendees. Organizer detection also prefers the old server-derived item snapshot.

## Version

- Technical manifest version: `2.0.30`
- Visible product version: `V2.30`
- Author: Jens Kowalsky, 3-5 Power Electronics GmbH
