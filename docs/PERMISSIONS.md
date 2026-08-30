# Permissions and Microsoft Graph scopes

M365 Calendar for Thunderbird requests only the Thunderbird permissions used by its implemented features.

## Thunderbird permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Stores the add-on configuration, OAuth state/tokens and synchronization metadata locally in the Thunderbird profile. |
| `identity` | Obtains the Thunderbird WebExtension redirect URI used by the OAuth2 Authorization Code + PKCE flow. |
| `addressBooks` | Reads Thunderbird contacts for attendee autocomplete. The add-on does not create, edit or delete address-book entries. Thunderbird exposes this as a combined address-book permission. |
| `messagesRead` | Reads meeting invitation metadata from the currently handled message so invitations can be matched to Microsoft Graph events and answered. |
| `sensitiveDataUpload` | Required by Thunderbird review policy because calendar/account/message-derived data is transmitted to hard-coded Microsoft services (`login.microsoftonline.com` and `graph.microsoft.com`). |
| `https://login.microsoftonline.com/*` | Microsoft OAuth2 authentication and token exchange. |
| `https://graph.microsoft.com/*` | Microsoft Graph calendar/account operations. |

The NATIVE edition also contains an `experiment_apis.nativeCalendar` implementation. Thunderbird Experiment APIs have privileged access to Thunderbird internals, so Thunderbird displays the broad **full, unrestricted access** warning for that edition. The Experiment is used to register and operate a native Thunderbird calendar provider because the regular MailExtension API does not expose the required `calICalendar` provider/calendar-manager/offline-cache interfaces.

## Microsoft delegated scopes

The add-on requests these Microsoft OAuth2 scopes:

- `openid`
- `profile`
- `offline_access`
- `User.Read`
- `Calendars.ReadWrite`
- `Calendars.ReadWrite.Shared`

`Calendars.ReadWrite.Shared` is requested because the add-on can enumerate and work with calendars shared with the signed-in user. The public build uses a user-supplied Microsoft Entra application registration; it contains no preconfigured tenant or Client ID.

## Network destinations

No project-operated backend is used. Runtime network traffic for Microsoft 365 functions is limited to:

- `https://login.microsoftonline.com/`
- `https://graph.microsoft.com/`

See [PRIVACY.md](../PRIVACY.md) for the full data-handling policy.
