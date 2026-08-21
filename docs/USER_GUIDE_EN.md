# User Guide – M365 Calendar for Thunderbird V2.19

**Author:** Jens Kowalsky  
**Public GitHub edition:** no preconfigured Client ID or tenant.


Build: **GITHUB / NATIVE**

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

## Native Thunderbird calendar integration

Do **not** import an ICS file and do not manually add a network calendar.

1. Open **Microsoft 365 → ⚙ Settings**.
2. Enable **Integrate Microsoft 365 calendars natively in Thunderbird**.
3. Select **Save**.
4. Sync runs automatically, including on later Thunderbird restarts.
5. Open Thunderbird's built-in **Calendar**. Calendars such as `M365 · Calendar` should appear in the list.

### Manual sync and debug information

The **Sync native calendars** button remains available as a manual fallback and troubleshooting action.

Immediately **above** that button is the expandable **Native diagnostics** section.

If an error occurs:

1. Open **Microsoft 365 → ⚙ Settings**.
2. Expand **Native diagnostics**.
3. Select and copy the **entire text block**, not only the final error line.
4. Send the copied block to your administrator/support contact.

The block includes fields such as `build`, `experiment`, `providerRuntime`, `tbCalendars`, `graphCalendars`, `syncCacheItems`, possible `syncError` lines, and a `trace`.

## Create a Teams meeting from Thunderbird's built-in Calendar

V2.17 provides a **Teams meeting** button in Thunderbird's normal **Calendar** view and also **New Teams meeting** when right-clicking a date/time.

1. Open Thunderbird's **Calendar**.
2. Click **Teams meeting**.
3. A compact window opens with the same M365 event editor used in the Microsoft 365 Space.
4. Enter subject, start/end, attendees and any other options.
5. The Teams option is already enabled.
6. Select **Create event**.

The meeting is created directly in Microsoft 365 / Exchange Online and then synchronized into the native Thunderbird calendar.

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
