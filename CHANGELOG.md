# Changelog

## 2.0.49 - 2026-09-25

### ATN review hardening

- Reformatted the settings JavaScript and CSS so the shipped ATN package is directly human-reviewable and no longer flagged as minified.
- Reworked `runtime.onMessage` handling so the registered listener is synchronous and only keeps the response channel open for messages it handles.
- Removed all `browser.nativeCalendar` references and native-only controls from the STANDARD/ATN code path. NATIVE remains available only in the GitHub/internal NATIVE packages.
- Added explicit Microsoft Graph / Microsoft identity data-transfer disclosure to the settings UI and ATN publishing notes.
- Kept the `sensitiveDataUpload` permission intentionally: the add-on exchanges user-requested calendar/invitation data with Microsoft Graph; no telemetry or developer-operated data endpoint is used.
- Preserved V2.47/V2.48 native diagnostics and the documented Thunderbird Month/Multiweek rendering limitation.

## V2.49 (2026-09-25)

- Document the confirmed NATIVE Month/Multiweek host-UI limitation: in the reproduced Thunderbird 153.3.1 state, Graph, native cache, cached wrapper, underlying provider and DOM item instantiation all contain the affected events while Month/Multiweek can still omit them visually.
- Keep the V2.47 deep provider/range/current-view diagnostics available for further upstream investigation.
- Do **not** add another destructive or layout-manipulating workaround; Graph synchronization and native-cache mapping remain unchanged.
- Add a public `docs/KNOWN_ISSUES.md` with precise scope, evidence, workarounds and related Thunderbird Bugzilla references.
- Add a public-safe Bugzilla report package to the private complete release master; the raw private diagnostic is not published.
- Extend the GitHub repository updater so direct upgrades remain supported from V2.43, V2.44, V2.45, V2.46 and V2.47 to V2.49.
- STANDARD/ATN runtime behavior remains unchanged apart from the version increment.

## V2.47 (2026-09-25)

- NATIVE: add bounded logging of real Thunderbird provider `getItems()` range/filter requests, including a non-destructive mirror result list for bounded queries.
- NATIVE: add current-view diagnostics for Month/Multiweek/Week/Day, including visible range and exact wrapper/storage occurrence queries.
- NATIVE: add a best-effort rendered-item DOM scan to distinguish provider/range failures from Calendar frontend rendering failures.
- Diagnostic ZIP now includes `native_current_view.json` and `native_provider_queries.json`.
- GitHub updater explicitly accepts V2.43 through V2.46 as source repositories and still preserves `.git`, creates a backup and verifies all managed files.
- STANDARD/ATN runtime behavior remains unchanged apart from the version increment.

## V2.46 (2026-09-25)

- NATIVE: replace the unconditional `currentView().goToDay()` refresh workaround with Thunderbird's item-level `refreshItems(true)` path when available, preserving the current Month/Multiweek date range and selection while forcing an item re-query.
- NATIVE: retain a guarded `goToDay()` fallback for older Thunderbird versions that do not expose `refreshItems`.
- NATIVE: add view-refresh diagnostics (view identity/type, visible date range, selected day, strategy and result) to make Month/Multiweek rendering failures distinguishable from Graph/cache synchronization failures.
- Add V2.46 regression coverage for the safe-view-refresh contract.
- STANDARD/ATN Graph and calendar runtime behavior is unchanged apart from the version increment.

## V2.45

- Keep V2.44 runtime behavior unchanged while hardening release engineering.
- Generalize version/package checks and expand public/private leak detection.
- Add deterministic public archive generation, one-command release audit and canonical publishing text.
- Add robust repository update/recovery packaging and independent final-auditor workflow.

## V2.44 (2026-09-24)

- Changed the addons.thunderbird.net submission from the custom-Experiment NATIVE edition to the Experiment-free STANDARD edition.
- Kept the deeper NATIVE Thunderbird Calendar integration available through GitHub releases.
- Separated public add-on IDs so STANDARD/ATN STANDARD and GITHUB NATIVE cannot replace each other through cross-edition updates.
- Added ATN publication text and reviewer notes that clearly describe the STANDARD limitation and the GitHub NATIVE alternative.
- Added an ATN package contract check and an official Thunderbird `webext-linter` GitHub Actions step.
- Removed private-build wording from the public runtime UI and consolidated duplicated variant documentation into the repository-level `docs/` tree.
- Hardened public-repository hygiene checks for organization-specific configuration, provider-specific deployment material and non-public recipient addresses.
- No intentional Microsoft Graph/calendar runtime change relative to V2.43; the release primarily changes distribution, publication and repository hygiene.

## V2.43 (2026-09-24)

- Added a cumulative V2.40/V2.41/V2.42 recovery path and synchronized all current release metadata to V2.43.
- Fixed stale V2.41 build-output names and current documentation headers left in the V2.42 GitHub archive.
- Hardened repository version validation to catch stale current-release metadata before CI/build publication.
- Retained the V2.41 Thunderbird 154+/156 startup fix and V2.42 external-iMIP runtime behavior without intentional Graph semantic changes.

## V2.42 (2026-09-24)

- Added safe NATIVE handling for external iMIP invitations that arrive through a non-Microsoft IMAP mailbox and have no Exchange/Graph event yet.
- Added optional personal-copy fallback plus Thunderbird iMIP RSVP transport, without recreating attendees in Graph.
- Added explicit diagnostics and actionable unmatched-invitation errors instead of generic `0x80004005`.
- Added external invitation handling documentation for external-mail + Exchange Online based on Microsoft's third-party-mail/Teams calendar pattern.
- Added detailed Microsoft Entra SPA registration instructions and reorganized GitHub documentation.
- Retained Thunderbird 154+/156 native startup compatibility from V2.41.

## V2.41 (2026-09-24)

- Fixed native calendar activation on Thunderbird 154+ / 156 after removal of the legacy CalStartupService startup path.
- Added current-Thunderbird lazy Calendar Manager initialization while retaining the older startup-service path.
- Added bounded native-provider/diagnostics timeouts to prevent indefinite `checking...` / `Loading...` states.
- Added Thunderbird 154+ startup compatibility regression coverage.

## V2.40 (2026-09-23)

- Fixed malformed literal `\n` tokens in both calendar stylesheets, eliminating the validator's CSS selector-nesting warning source.
- Added a V2.40 regression test for escaped-newline CSS corruption.
- Fixed the GitHub Actions XPI build step so general-use and ATN builds run as separate shell commands.
- Kept GitHub NATIVE builds uncapped while retaining `strict_max_version: 156.*` only in the ATN NATIVE package, matching Thunderbird's Experiment-specific linter requirement.
- Clarified documentation that a generic Firefox-oriented `strict_max_version not required` warning does not override the Thunderbird Experiment requirement.
- No intentional change to Graph synchronization, RSVP, Teams, reminder or native-calendar runtime semantics.

## V2.39 (2026-09-23)

- Adopted an ESR-first compatibility policy while continuing to support Thunderbird Monthly releases.
- Removed `strict_max_version` from GitHub NATIVE manifests so new Monthly majors are not blocked solely by the manifest.
- Kept STANDARD builds uncapped.
- Added a separate deterministic ATN NATIVE build that injects `strict_max_version: 156.*`, satisfying the current Experiment-submission requirement without imposing that ceiling on GitHub packages.
- Added `docs/COMPATIBILITY.md`, README guidance and a GitHub bug-report field for Thunderbird channel (ESR / Monthly / Beta).
- Generalized the standalone Options compatibility warning so it reports any packaged maximum that is lower than the running Thunderbird version.
- Retained all V2.34–V2.38 calendar safety, Teams, RSVP and diagnostics behavior unchanged.

## V2.38 (2026-09-23)

- Added explicit Thunderbird 156 compatibility for the NATIVE build (`strict_max_version: 156.*`).
- Added a standalone **Settings & diagnostics** page accessible from Thunderbird Add-ons Manager, independent of the M365 Space UI.
- The fallback page reports Thunderbird/add-on versions, background responsiveness, Experiment ping and native-provider status, and provides native activation/sync controls.
- Added direct storage fallback for basic configuration when the background page is unavailable, so diagnostics and recovery remain reachable.
- Included the standalone options page in all XPI builds and ATN/source packages.
- Added V2.38 regression coverage for TB 156 manifest compatibility and fallback options.

## V2.37

- Fixed Thunderbird email-iTIP Accept/Tentative/Decline operations that could end in generic `0x80004005 / NS_ERROR_FAILURE` while reconciling the associated Exchange calendar event.
- Native provider now captures the selected invited-attendee PARTSTAT directly from Thunderbird and passes it to the RSVP handler.
- Added cache-assisted invitation reconciliation using the authoritative Graph event ID when the Exchange event is already present in Thunderbird's native cache.
- Added a bounded retry window for Graph event lookup to tolerate the short delay between receipt of a meeting request and visibility of the automatically created calendar event.
- Once Graph accepts the RSVP action, cache invalidation/readback failures are non-fatal so Thunderbird does not report a failed operation after a successful response.
- Invitation handling remains fail-closed: unresolved invitations never fall through to generic `POST /events` creation.

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

- Fixed missing **Join meeting** actions for external Teams invitations where Exchange/Graph keeps the Teams URL only in the event body/location instead of `onlineMeeting.joinUrl`.
- Added a fail-closed native email-iTIP RSVP path: Accept/Tentative/Decline through Thunderbird/EWS is matched to the existing Graph event and uses the dedicated Graph response action instead of creating a new meeting.
- Added native mail-identity awareness and `X-MOZ-INVITED-ATTENDEE` metadata for Thunderbird scheduling.
- Bumped the native mapping schema to `2.34-itip-teams-links` for a one-time re-adoption of cached items.
- Finalized the public NATIVE ID as `m365-calendar-for-thunderbird@3-5pe.com`; public STANDARD uses `m365-calendar-standard@3-5pe.com`.
- Retained the diagnosed Thunderbird Multiweek rendering issue as a host-UI known issue rather than applying a destructive synchronization workaround.

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

- Added DE/EN localization, NATIVE/STANDARD public build variants and configurable Entra settings.

## V1.00

- Initial Microsoft Graph calendar Space with OAuth2/PKCE, event display, meeting responses and Teams-meeting creation.
