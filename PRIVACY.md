# Privacy Policy — M365 Calendar for Thunderbird

**Applies to:** M365 Calendar for Thunderbird, public editions  
**Maintainer:** Jens Kowalsky  
**Version of this policy:** 2026-08-30

M365 Calendar for Thunderbird is an open-source Thunderbird add-on that connects a user's Thunderbird installation to the user's Microsoft 365 / Exchange Online account. The project does **not** operate a backend service and does **not** collect analytics or telemetry.

## Data processed

When the user explicitly configures Microsoft 365 and signs in, the add-on may process the following data because it is required for its calendar and meeting functions:

- Microsoft account identifiers returned by Microsoft Graph, such as display name, email address and user principal name.
- Calendar metadata and calendar identifiers.
- Calendar event data, including subject, start/end time, time zone, location, body/description, categories, recurrence information, organizer, attendees, response state, online-meeting information and Teams meeting URLs.
- Meeting invitation data read from messages when the user opens/uses the invitation workflow, including iCalendar metadata needed to map an invitation to its Microsoft Graph event.
- Thunderbird address-book contact names and email addresses used locally for attendee autocomplete. The add-on uses these address books read-only and does not create, modify or delete contacts.

## Where data is sent

The add-on communicates over HTTPS only with Microsoft services required for authentication and Microsoft 365 calendar operations:

- `https://login.microsoftonline.com/` for OAuth2 authentication.
- `https://graph.microsoft.com/` for Microsoft Graph calendar/account operations.

Calendar/event/account data is sent to or received from Microsoft only as required for the user's configured Microsoft 365 connection and actions. The project maintainer and 3-5 Power Electronics GmbH do not receive this data through the add-on.

## Local storage

The add-on stores OAuth access/refresh tokens and configuration settings in Thunderbird's local extension/profile storage. The NATIVE edition additionally stores synchronized event data in Thunderbird's own calendar/offline cache so Thunderbird can display Microsoft 365 calendars in its native Calendar UI.

This data remains in the user's Thunderbird profile until it is replaced/removed through normal add-on/account operations or the relevant Thunderbird profile/add-on storage is deleted.

## Diagnostic exports

The user can explicitly create a diagnostic ZIP. This export may contain calendar event content, account/calendar identifiers and attendee email addresses. OAuth access and refresh tokens are intentionally excluded. The ZIP is created locally and is **not uploaded automatically** by the add-on. The user decides whether and where to share it.

## Analytics, advertising and third-party tracking

The add-on contains no analytics SDK, advertising SDK, tracking service or project-operated telemetry endpoint. It does not sell user data.

## User control

No Microsoft 365 calendar data is transferred until the user configures a Microsoft Entra application/client and starts Microsoft Login. The user can disconnect the Microsoft account and can uninstall the add-on at any time. Microsoft account consent can also be managed through the user's Microsoft/organization account settings.

## Source code

The public source code is available at:

https://github.com/kowjens/M365-Calendar-for-Thunderbird
