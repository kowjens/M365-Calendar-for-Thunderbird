# Changelog

## V2.33

- ATN/publication readiness release; synchronization behavior remains based on V2.32.

- Stable public NATIVE/STANDARD add-on IDs replace the temporary `.invalid` ID.

- Added `sensitiveDataUpload`, NATIVE `strict_max_version: 154.*`, deterministic builds and ATN preflight validation.

- Updated GitHub Actions and corrected the public author/branding regression test.

- Documented the Thunderbird Multiweek rendering symptom confirmed by V2.32 native range diagnostics.


## V2.32

- Added a read-only **calendar diagnostic ZIP export** for NATIVE builds with a selectable date range.
- Export captures the raw Graph `calendarView`, the hydrated M365 Space snapshot, matching Space cache windows, the actual Thunderbird native provider cache, a native ICS representation, provider diagnostics and auth state without OAuth tokens.
- Added automatic Graph-vs-native comparison (`comparison.csv/json`) plus recurring-series grouping (`series_comparison.json`) to identify isolated missing occurrences/exceptions.
- Diagnostic collection deliberately does **not** trigger native synchronization, preserving the failing cache state.
- Increment technical version to `2.0.32` / visible version `V2.32`.

## V2.30

- Force a one-time native delete/re-adopt migration for every non-online event, including ordinary meetings with attendees.
- Add `syncCacheOtherMeetings` diagnostics and propagate direct-push repair counters.
- Add the signed-in organizer as a required attendee when creating Teams events in the M365 Space.
- Isolate native RSVP actions from generic event updates so Accept/Tentative/Decline only sends the Graph response to the organizer.
- Increment technical version to `2.0.30` / visible version `V2.30`.

## V2.29

- Added **Month / Week / Day / Agenda** views to the Microsoft 365 Space and persisted the chosen view.
- Changed non-online native mapping migration from `modifyItem()` to a one-time **delete + adopt** lifecycle so Thunderbird's active native calendar view receives complete per-item observer notifications.
- Removed storage batching around provider-replay reconciliation for mapping repairs.
- Added `syncCacheVisibilityRepairs` diagnostics.
- Standardized visible version labels to **V2.29** while retaining technical manifest version `2.0.29`.
- Updated author metadata to **Jens Kowalsky, 3-5 Power Electronics GmbH**.

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
