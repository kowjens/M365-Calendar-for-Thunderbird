# Privacy

**Author:** Jens Kowalsky

M365 Calendar for Thunderbird communicates with Microsoft identity endpoints and Microsoft Graph to perform calendar operations explicitly requested by the user.

- OAuth access/refresh tokens and add-on settings are stored in Thunderbird's local extension/profile storage.
- Calendar event data is exchanged with Microsoft Graph as required for synchronization and user actions.
- The `addressBooks` permission is used read-only for attendee autocomplete. The extension does not create, modify, or delete Thunderbird contacts.
- No analytics, advertising SDK, tracking service, or third-party telemetry is included by this project.
- The public repository contains no preconfigured tenant or Client ID.

Administrators should review Microsoft Entra consent and Graph permissions before deployment.
