# User Guide – M365 Calendar for Thunderbird V2.39

Build: **GITHUB / STANDARD**

Client ID and tenant are intentionally blank in this GITHUB build and must be entered once in the add-on settings.

## Open the Microsoft 365 Space

After installation and a full Thunderbird restart, a new **Microsoft 365** entry appears in the vertical **Spaces toolbar** on the left.

1. Click **Microsoft 365** on the left.
2. The new Microsoft 365 tab/Space opens.
3. In the upper-right corner there is a **gear icon (⚙)**.
4. Click that gear to open the **add-on settings**.

This is where login, Entra configuration, synchronization and – in the NATIVE build – native diagnostics are located.

## First sign-in

1. Open **Microsoft 365 → ⚙ Settings**.
2. Enter the Application (Client) ID and Tenant supplied by your administrator.
3. Select **Microsoft Login**.
4. Choose your Microsoft account and approve the requested calendar permissions.
5. After successful sign-in, the Microsoft 365 Space loads the available calendars and events.

## STANDARD build

The STANDARD build has **no native Thunderbird calendar provider**. Calendars are used in the **Microsoft 365 Space**. The additional Teams-meeting button inside Thunderbird's built-in Calendar is NATIVE-only.

## Functions in the Microsoft 365 Space

The Space can display, create, edit and delete events and also supports Teams meetings, all-day events, reminders, categories, free/busy state, basic recurrence, attendee status, availability checks and invitation responses.

## Troubleshooting

Check the following first:

- Is **Microsoft Login** still active?
- Is the correct calendar selected?
- NATIVE only: is **Integrate Microsoft 365 calendars natively in Thunderbird** enabled?
- NATIVE only: copy the complete **Native diagnostics** block.
- If needed, run **Sync native calendars** once manually.


## Attendees from Thunderbird address books

After **two characters** are typed into the attendee field, the event editor searches the address books available in Thunderbird. Matching names and email addresses are shown directly below the field and can be selected with the arrow keys plus **Enter** or with the mouse. Local and connected/remote address books are included when Thunderbird exposes them through its address book API.

V2.17 therefore requests Thunderbird's **Read and modify your address books and contacts (`addressBooks`)** permission. The add-on uses that permission only to **read/search contacts for autocomplete**; it does not create, modify, or delete contacts. Only email addresses that the user actually selects/enters as meeting attendees are sent to Microsoft Graph when the meeting is created.

## New Teams meeting from a date/time context menu (NATIVE)

In the NATIVE build, right-click a free area/date/time in Thunderbird's normal Calendar view and choose **New Teams meeting**. The M365 editor attempts to use the clicked/selected date or time as its start time and opens with Teams mode already enabled.

## Teams meeting window size

The separate Teams meeting window now adapts to the **available monitor work area**. On smaller laptop screens, the form becomes internally scrollable instead of opening a window taller than the display.


## V2.18 additions: contacts and native Calendar double-click

### Attendee suggestions

The **Attendees** field starts searching after two characters. V2.18 calls Thunderbird's MV2 `contacts.quickSearch([parentId], queryInfo)` signature explicitly and adds a fallback over locally available address books. A status line below the field now shows **Searching address books**, **No matching contacts**, or the number of results so API/permission problems are no longer silent.

### Double-click M365 events (NATIVE)

In the NATIVE build, **double-clicking an event that belongs to an M365 calendar** opens the add-on's M365/Graph event window. Organizer-owned/editable events open directly in the editor. Events organized by somebody else open in the M365 detail view with available response actions. Events from non-M365 calendars continue to use Thunderbird's normal event dialog.

## V2.19: dialogs on smaller displays

M365 event windows now use a fixed header and action footer with one scrollable content area in between. Buttons such as **Join Teams**, **Edit**, **Decline**, **Tentative**, and **Accept** therefore remain reachable with long meeting information and on smaller laptop displays. Long Teams/meeting URLs wrap instead of creating their own horizontal scroll area.

## V2.21: Address books, calendar preferences and sign-in stability

- **Attendee autocomplete (NATIVE):** In addition to the WebExtension address-book API, the NATIVE build now searches Thunderbird's own privileged address-book manager. This uses the same local/CardDAV/OS-backed address-book data Thunderbird itself uses where available.
- **Calendar preferences survive restarts:** colour, enabled/disabled state, visibility, alarm suppression and the selected mail identity are stored as user preferences and restored after Thunderbird restarts. Graph synchronization no longer overwrites a user-selected calendar colour.
- **More resilient Microsoft sign-in:** transient token/network errors no longer erase the stored authentication state. The add-on first attempts silent recovery using the existing Microsoft browser session and requests interactive sign-in only when Microsoft actually requires it.
- **Native calendar mail identity (NATIVE):** the provider now resolves Thunderbird's `imip.identity` correctly. If a Thunderbird mail identity uses the same address as the signed-in M365 user, it is selected automatically when the calendar is first created. The selection remains editable in calendar properties and is persisted.

## V2.23: event time, Thunderbird reload and Settings window

- **Native event times:** V2.23 fixes Thunderbird's internal conversion so an absolute instant is not reinterpreted as a local wall-clock time in UTC. After upgrading, run **Sync native calendars** once so already shifted cache entries are rewritten.
- **Reload Calendars and Changes:** provider replay and direct cache reconciliation are serialized per M365 calendar; recurrence occurrences are no longer treated as additional stored parent rows during reconciliation.
- **Settings on smaller displays:** controls can no longer widen the dialog beyond its viewport. Below 720 px the settings form switches to one column.
- The CardDAV/address-book search fixed in V2.22 is retained unchanged.


## V2.24: newly created events and attendee suggestions

- Events just created/changed in the add-on or native M365 calendar are protected against a briefly stale Graph `calendarView` snapshot, so they should no longer flash and disappear after synchronization.
- Live attendee suggestions use Thunderbird's fast `contacts.quickSearch()` first. Full address-book enumeration is now only a fallback or part of the Settings diagnostic test.
- Suggestions remain active for complete email addresses as well.


## V2.27: Address books for attendee suggestions

Under **Microsoft 365 → gear → Settings**, one or more Thunderbird address books can be selected under **Address books for attendee suggestions**. The selection limits live attendee lookup and can exclude large legacy/collected address books.


## Calendar views in the Microsoft 365 Space

The Microsoft 365 Space supports **Month**, **Week**, **Day**, and **Agenda** views. The selected view is remembered.
## V2.35: outgoing-message confirmation

Under **Microsoft 365 → Settings**, **Confirm every outgoing meeting message before Microsoft 365 sends it** is enabled by default. The add-on asks before Graph can send meeting invitations, organizer updates/cancellations or RSVP responses. Cancelling aborts the Graph operation. This does not intercept ordinary Thunderbird composer email.

## V2.36: reminder Dismiss and Snooze stay local

Thunderbird changes local alarm bookkeeping when a reminder is dismissed or snoozed. V2.36 detects these local-only changes before any Microsoft Graph write. **Dismiss** and **Snooze** therefore do not show the outgoing-message confirmation and cannot send a meeting update. Changing the actual reminder offset (for example 15 to 30 minutes) remains a real calendar change and is synchronized.
