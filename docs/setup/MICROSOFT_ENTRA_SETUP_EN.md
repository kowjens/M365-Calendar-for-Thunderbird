# Microsoft Entra application setup

The public GITHUB NATIVE, GITHUB STANDARD and ATN STANDARD editions use a bring-your-own Microsoft Entra app registration. No client secret is required.

## Register the application

1. Open https://entra.microsoft.com/.
2. Go to **Identity → Applications → App registrations → New registration**.
3. Name: `M365 Calendar for Thunderbird`.
4. For an organization-only deployment select **Accounts in this organizational directory only**.
5. Register the app and note **Application (client) ID** and **Directory (tenant) ID**.

## Configure the redirect URI

1. Open the add-on's **Settings & diagnostics** page in Thunderbird.
2. Copy the exact **OAuth redirect URI** shown there.
3. In the Entra app go to **Authentication → Add a platform → Single-page application (SPA)**.
4. Paste the exact redirect URI and save.
5. Do not enable legacy implicit access-token/ID-token grants. The add-on uses OAuth 2.0 Authorization Code + PKCE.

## Delegated Microsoft Graph permissions

Add delegated permissions/scopes required by the add-on:

- `User.Read`
- `Calendars.ReadWrite`
- `Calendars.ReadWrite.Shared`
- `openid`
- `profile`
- `offline_access`

For managed deployments, an administrator may grant tenant-wide admin consent according to the organization's consent policy.

## Configure Thunderbird

Enter:

```text
Application (Client) ID = <Application (client) ID>
Tenant                  = <Directory (tenant) ID>
```

The tenant GUID is recommended, although a verified `tenant.onmicrosoft.com` domain can also identify the tenant.

Save, select **Microsoft login**, authenticate, then verify calendar sync and meeting RSVP.

## AADSTS50011

This means the redirect URI used by Thunderbird does not exactly match a registered URI. Copy it again from the add-on and register it under the **SPA** platform.

## References

- https://learn.microsoft.com/en-us/graph/toolkit/get-started/add-aad-app-registration
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
