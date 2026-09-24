# Administrator Guide – M365 Calendar for Thunderbird V2.43

Build: **GITHUB / STANDARD**

Client ID and tenant are intentionally blank in this GITHUB build and must be entered once in the add-on settings.

## 1. Register the Microsoft Entra application

The menu labels below were checked against current Microsoft Learn documentation on **2026-08-20**. Microsoft may occasionally roll out slightly different portal wording.

1. Open **https://entra.microsoft.com** and sign in with an account allowed to create app registrations.
2. If you have access to multiple tenants, use **Settings → Directories + subscriptions** at the top to select the correct tenant.
3. Menu path:
   **Entra ID → App registrations → New registration**
4. Enter a name, for example **M365 Calendar for Thunderbird**.
5. Under **Supported account types**, an internal company deployment normally uses:
   **Accounts in this organizational directory only (Single tenant)**.
6. Select **Register**.
7. On **Overview**, record:
   - **Application (client) ID**
   - **Directory (tenant) ID**

The add-on accepts either the tenant ID or the tenant's `*.onmicrosoft.com` domain as the Tenant value.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app

## 2. Configure the redirect URI

Do **not** guess or manually construct the redirect URI. Thunderbird generates it for the installed extension and the add-on displays the exact value.

1. Open Thunderbird.
2. In the left **Spaces toolbar**, open the new **Microsoft 365** Space.
3. Click the **gear icon (⚙)** in the upper-right corner.
4. Copy the displayed **OAuth Redirect URI** from the add-on settings.
5. Return to the Entra app registration.
6. Menu path:
   **Entra ID → App registrations → <your app> → Manage → Authentication**
7. Select **Add a platform** / **Add Redirect URI**.
8. Choose **Single-page application (SPA)**.
9. Paste the redirect URI copied from Thunderbird **exactly as shown**.
10. Select **Configure** / **Save**.

No client secret is required. The extension uses Authorization Code + PKCE.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri

## 3. Microsoft Graph API permissions

Menu path inside the app registration:

**Entra ID → App registrations → <your app> → Manage → API permissions → Add a permission → Microsoft Graph → Delegated permissions**

Add the following permissions using the search field:

| Permission | Required | Purpose |
|---|---|---|
| `User.Read` | yes | read the signed-in user's basic profile |
| `Calendars.ReadWrite` | yes | read/create/update/delete the user's calendar events |
| `Calendars.ReadWrite.Shared` | recommended/optional | read/write shared or delegated calendars where the signed-in user already has access |

Then select **Add permissions**.

Microsoft lists `Calendars.ReadWrite` and `Calendars.ReadWrite.Shared` as **delegated** permissions that do not inherently require admin consent. Your tenant's consent policy can still block user consent.

If users are not allowed to grant consent themselves, use:

**API permissions → Grant admin consent for <tenant> → Yes**

The **Status** column should then show **Granted for <tenant>** (or equivalent wording).

Microsoft references:
- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis
- https://learn.microsoft.com/en-us/graph/permissions-reference

## 4. Configure the add-on

### INTERNAL

The INTERNAL build is preconfigured. Administrators should still verify the values under **Microsoft 365 → ⚙ Settings**.

### GITHUB

For the neutral GITHUB build, enter under **Microsoft 365 → ⚙ Settings**:

- **Application (Client) ID**
- **Tenant**: Directory (tenant) ID or `*.onmicrosoft.com`

Select **Save**, then run **Microsoft Login**.

## 5. NATIVE versus STANDARD

- **STANDARD**: Microsoft 365 Space, Graph calendar, Teams events and invitation functions; **no** native Thunderbird calendar provider and no privileged Experiment API.
- **NATIVE**: additionally exposes M365 calendars in Thunderbird's built-in Calendar view and therefore uses a privileged Thunderbird Experiment API.

The public NATIVE and STANDARD editions use separate stable add-on IDs. The NATIVE edition intended for addons.thunderbird.net uses `m365-calendar-for-thunderbird@3-5pe.com`; STANDARD uses `m365-calendar-standard@3-5pe.com`.

## 6. STANDARD-build limitation

The STANDARD build intentionally has **no native Thunderbird calendar provider**. Therefore it does not add `M365 · …` calendars to Thunderbird's built-in calendar list and it does not add the Teams-meeting button to the native Calendar view. Those functions are NATIVE-only.

## 8. Security / OAuth notes

- Do not create or embed a client secret for this extension.
- OAuth uses PKCE.
- Access/refresh tokens are kept in the local Thunderbird extension storage within the profile.
- Grant permissions according to least privilege.
- If `Calendars.ReadWrite.Shared` is added later, perform a fresh interactive **Microsoft Login** so the new scope is included in the token.


## Microsoft Graph data-transfer permission

The public manifest declares `sensitiveDataUpload` because calendar/account information is transmitted to the hardcoded Microsoft identity and Graph endpoints as an essential part of the configured Microsoft 365 connection. No project-operated server receives this data. See `PRIVACY.md` in the repository / the full privacy text on addons.thunderbird.net.

## New Thunderbird permission in V2.17: `addressBooks`

Attendee autocomplete requires the Thunderbird WebExtension `addressBooks` permission. Thunderbird describes this permission broadly as reading and modifying address books and contacts. **M365 Calendar uses it read-only**, specifically for `contacts.quickSearch()`. The code does not create, modify, or delete contacts.

Thunderbird may request approval of the additional permission when upgrading from an older version. Keep this purpose documented in the README, privacy information and release notes for publication.


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

## 9. V2.23 – native time conversion and reload hardening

V2.23 corrects two native Thunderbird paths:

1. Timestamps preserve their absolute JavaScript instant before conversion to Thunderbird UTC, so the local UTC offset is not applied twice.
2. Thunderbird provider replay and the direct Graph cache push are serialized per Graph calendar. `resetLog()` no longer triggers another `onLoad`/replay and reconciliation works with stored parent events.

After upgrading, run **Sync native calendars** once so V2.22 cache rows are rewritten with the corrected time conversion.


## 10. V2.24 – read-after-write and fast address search

V2.24 keeps direct Graph write results as 120-second guard objects. An immediately following `calendarView` read cannot remove a freshly created/updated event with an older snapshot; deletions are protected by a tombstone in the same way. The guard is dropped once `calendarView` confirms the same `changeKey` or confirms that the deleted row is gone.

Live attendee search returns as soon as `contacts.quickSearch()` yields a match. Full enumeration remains available for diagnostics/fallback.


## V2.27: Address books for attendee suggestions

Under **Microsoft 365 → gear → Settings**, one or more Thunderbird address books can be selected under **Address books for attendee suggestions**. The selection limits live attendee lookup and can exclude large legacy/collected address books.
