# Changelog

## V2.36

- Fixed Thunderbird reminder **Dismiss/Snooze** being misclassified as an organizer meeting edit.
- Native provider now detects local-only alarm bookkeeping before calling the extension write handler, preserves the exact Thunderbird item (including alarm acknowledgement/snooze state) and skips Microsoft Graph entirely.
- Added a second background-level Graph-relevant-field guard before any outgoing-message confirmation or event PATCH.
- Real event edits, actual reminder-setting changes and RSVP state changes still use the normal guarded Graph paths.
- The V2.35 default-enabled outgoing-message confirmation remains unchanged for operations that can actually send meeting mail.

## V2.35

- Added a settings switch to confirm every outgoing meeting-related message before Microsoft 365 / Exchange sends it.
- Confirmation covers invitations, organizer updates, organizer cancellations and RSVP responses across Space, invitation-popup and native-calendar paths.
- The safety option is enabled by default. Cancelling or closing the confirmation window aborts the Graph action; if the confirmation UI cannot be displayed, nothing is sent.
- Ordinary Thunderbird composer mail is intentionally outside this add-on-level confirmation gate.

## V2.34

- Recover Teams join links from event body/location when external invitations omit Graph `onlineMeeting.joinUrl`.
- NATIVE: handle Thunderbird/EWS email iTIP RSVP through Graph response actions and never create a new event for an invitation response.
- NATIVE: add mail-identity-aware invited-attendee metadata and one-time cache re-adoption.
- Final public IDs use the `3-5pe.com` domain.

## V2.32
- Full one-time native cache re-adoption for all M365 event kinds.
- Diagnostic export captures storage range-query results and filter masks.


## V2.28

- Fixed migration of existing plain Microsoft 365 appointments in Thunderbird's native cache. V2.27 introduced the correct appointment mirror, but unchanged Graph `changeKey` values could leave older cached rows untouched.
- Native reconciliation now validates local mapping markers independently of Graph content signatures and forces `modifyItem()` when appointment/online/synthetic-self semantics do not match.
- Added `syncCacheMappingRepairs` diagnostics so one-time native mapping migrations are visible.
- Existing Graph/Space rendering and address-book autocomplete are unchanged.

## V2.27

- Fixed the remaining native-mirror gap where plain Microsoft 365 appointments were visible in the add-on Space but not in Thunderbird's native calendar view.
- Plain appointments are mirrored with a synthetic accepted self-attendee only inside Thunderbird storage so they follow the same proven rendering path as visible meeting items. The synthetic attendee is stripped before Graph writes.
- Added native diagnostics separating Graph appointments/online meetings/other meetings from cached appointments/online meetings and synthetic-self rows.
- Existing address-book multi-selection and autocomplete behavior remains unchanged.


This file summarizes the released development milestones of **M365 Calendar for Thunderbird**.

## V2.26

- Fixed native display of plain Microsoft 365 appointments without attendees/Teams by mapping them as normal Thunderbird VEVENTs without meeting scheduling metadata.
- Non-Teams meetings with attendees continue to retain organizer/attendee scheduling data.
- Removed batch mode from direct single-event cache writes and added immediate cache read-back verification plus detailed diagnostics.

## V2.25

- Add immediate **single-event native cache push** after Graph create/update and direct cache removal after Graph delete. A newly created event no longer depends on a subsequent `calendarView` snapshot before it can appear in Thunderbird's native calendar.
- Keep the V2.24 read-after-write guard and schedule a delayed full reconciliation after direct cache updates.
- Add selectable Thunderbird address books for attendee suggestions. Multiple address books can be selected in Settings; selecting all stores an `all` scope, while an explicit empty selection disables live contact suggestions.
- Search selected books directly via `contacts.quickSearch(parentId, queryInfo)` and filter the native fallback to the same selected Thunderbird directories.
- Render attendee suggestions as a viewport-anchored overlay so the list cannot be clipped by the scrollable meeting-dialog body.
- Add the cleaned, ordered project changelog to the GitHub repository.

## V2.24

- Added short-lived read-after-write guards so stale Graph `calendarView` snapshots cannot remove newly created/updated native events or resurrect deleted events.
- Live attendee search returns from `contacts.quickSearch()` before expensive full address-book enumeration.
- Complete e-mail addresses remain searchable and repeated queries use a short cache.

## V2.23

- Fixed native CEST/UTC conversion that could add a second +2 h offset.
- Serialized direct-cache push and provider replay per Graph calendar.
- Reconciled stored parent events instead of expanded recurrence occurrences.
- Prevented nested provider replay during Thunderbird reload.
- Made Settings viewport-safe and responsive.

## V2.22

- Added Exchange/Graph time-zone selector and UTC native transport.
- Added CardDAV/asynchronous Thunderbird address-book search and diagnostics.
- Improved provider activation after Thunderbird restart.

## V2.21

- Preserved Thunderbird calendar registry/UI preferences across normal shutdown.
- Activated the native provider independently from authentication.
- Added Thunderbird native address-book autocomplete backend and explicit address-book diagnostics.
- Improved Microsoft session recovery and calendar mail-identity handling.

## V2.19

- Reworked M365 dialogs to fixed header/footer with one scrollable body.
- Added monitor-aware popup sizing and better handling of long meeting URLs.

## V2.18

- Fixed Thunderbird MV2 contact quick-search invocation and added visible search status.
- Double-clicking an M365 native event opens the M365/Graph-aware editor.

## V2.17

- Added adaptive Teams popup sizing.
- Added **New Teams meeting** to the native calendar context menu.
- Added attendee autocomplete from Thunderbird address books.

## V2.16

- Expanded DE/EN user/admin documentation including Entra app-registration steps.
- Added a native Thunderbird Calendar **Teams meeting** button.
- Added GitHub-ready neutral repository packaging.

## V2.15

- Added automatic native synchronization on Thunderbird start, successful login and native-integration activation.

## V2.14

- Added automatic native calendar-view reload after M365 Hide/Show and after sync.

## V2.13

- Replaced cache clear/re-add with Graph-ID based Add/Modify/Delete/Unchanged reconciliation.
- Preserved Thunderbird calendar visibility/enabled state.

## V2.12

- Updated native object construction to current Thunderbird `CalEvent`, `CalAttendee` and `CalAlarm` classes.

## V2.11

- Moved native synchronization to direct Thunderbird offline-cache push and added detailed cache diagnostics.

## V2.09

- Corrected lazy native-provider loading/registration on current Thunderbird builds.

## V2.01

- Split distribution into **STANDARD** (no privileged native calendar Experiment) and **NATIVE** (full Thunderbird calendar integration).
- Added comfort functions such as event editing, reminders, availability and shared-calendar support.

## V2.00

- First native Thunderbird calendar-provider prototype backed by Microsoft Graph.

## V1.20

- Added Graph delta synchronization, local/offline cache and automatic refresh.

## V1.10

- Added mail-to-calendar invitation matching and Exchange Online meeting responses from Thunderbird.

## V1.01

- Added DE/EN localization, INTERNAL/GITHUB build variants and configurable/preconfigured Entra settings.

## V1.00

- Initial Microsoft Graph calendar Space with OAuth2/PKCE, event display, meeting responses and Teams-meeting creation.
