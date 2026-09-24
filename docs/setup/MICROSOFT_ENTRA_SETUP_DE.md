# Microsoft Entra App für M365 Calendar for Thunderbird einrichten

Diese Anleitung beschreibt die **Bring-your-own-app**-Einrichtung für die öffentliche GitHub-/ATN-Version. Die INTERNAL-Builds können Client-ID und Tenant bereits vorbelegen.

## Benötigte Werte

Am Ende werden zwei Werte im Add-on eingetragen:

- **Application (Client) ID** — GUID der App-Registrierung.
- **Tenant** — entweder die **Directory (tenant) ID** (GUID, empfohlen) oder die bestätigte Tenant-Domain wie `contoso.onmicrosoft.com`.

Zusätzlich muss der **exakte OAuth redirect URI** aus den Add-on-Einstellungen in Microsoft Entra registriert werden.

## 1. App registrieren

1. Microsoft Entra Admin Center öffnen: https://entra.microsoft.com/
2. **Identity → Applications → App registrations → New registration**.
3. Name, z. B. `M365 Calendar for Thunderbird`.
4. Für eine nur intern genutzte Firmen-App: **Accounts in this organizational directory only** wählen.
5. **Register**.
6. Auf **Overview** notieren:
   - **Application (client) ID**
   - **Directory (tenant) ID**

Die Client-ID ist keine geheime Information. Es wird für dieses Add-on **kein Client Secret** benötigt.

## 2. Redirect URI als SPA eintragen

1. In Thunderbird: Add-ons → M365 Calendar for Thunderbird → **Settings & diagnostics**.
2. Den dort angezeigten **OAuth redirect URI** kopieren. Er sieht Thunderbird-/WebExtension-typisch etwa wie `https://<extension-id>.extensions.allizom.org/oauth2` aus; **nicht abschreiben oder raten**, sondern immer exakt kopieren.
3. Entra App Registration → **Authentication**.
4. **Add a platform → Single-page application (SPA)**.
5. Den kopierten Redirect URI einfügen.
6. Speichern.
7. Unter **Implicit grant and hybrid flows** keine Access-/ID-Token für den alten implicit flow aktivieren. Das Add-on nutzt Authorization Code + PKCE.

Microsoft empfiehlt für Browser-/SPA-Clients den Authorization Code Flow mit PKCE; SPA Redirect URIs werden hierfür als Plattformtyp `spa` registriert.

## 3. Microsoft Graph Delegated Permissions

Unter **API permissions → Add a permission → Microsoft Graph → Delegated permissions** hinzufügen:

- `User.Read`
- `Calendars.ReadWrite`
- `Calendars.ReadWrite.Shared`
- `openid`
- `profile`
- `offline_access`

`openid`, `profile` und `offline_access` sind OAuth/OIDC-Scopes; je nach Portalansicht erscheinen sie nicht immer identisch in derselben Graph-Liste. Das Add-on fordert diese Scopes beim Login an.

Für eine verwaltete Firmenumgebung kann ein Administrator anschließend **Grant admin consent** für den Tenant ausführen, damit Benutzer nicht einzeln zustimmen müssen. Ob Admin Consent erforderlich ist, hängt von Tenant-Richtlinien und Berechtigungsrichtlinien ab.

## 4. Werte ins Add-on eintragen

In **Settings & diagnostics**:

```text
Application (Client) ID = <Application (client) ID>
Tenant                  = <Directory (tenant) ID>
```

Die GUID der Directory/Tenant-ID ist gegenüber dem Tenant-Domainnamen vorzuziehen, weil sie eindeutig und unabhängig von Domainänderungen ist.

Danach:

1. **Save settings**
2. **Microsoft login**
3. Mit dem Microsoft-365-Benutzer anmelden
4. Berechtigungen bestätigen bzw. Administrator-Consent verwenden

## 5. Funktion prüfen

Nach erfolgreichem Login sollte die Diagnose u. a. zeigen:

```text
Background          responsive
Native Experiment   loaded / ping OK        # NATIVE edition
Native provider     loaded / active          # NATIVE edition
loggedIn            true
```

Anschließend:

- Kalender synchronisieren,
- einen normalen Termin erstellen,
- ein Teams-Meeting erstellen,
- eine Einladung an einen Testempfänger senden,
- Accept/Tentative/Decline testen.

## 6. Häufige Fehler

### AADSTS50011 — Redirect URI mismatch

Der URI im Entra-Portal stimmt nicht **zeichengetreu** mit dem vom Add-on verwendeten URI überein. Den Wert erneut aus **Settings & diagnostics** kopieren und als **SPA** Redirect URI eintragen.

### Login funktioniert, aber Kalenderzugriff nicht

Graph Delegated Permissions kontrollieren und ggf. Admin Consent erneut erteilen.

### Tenant

Kein frei erfundener Organisationsname. Verwenden Sie die **Directory (tenant) ID** aus App Registration → Overview oder eine bestätigte `*.onmicrosoft.com`-Tenant-Domain.

## Referenzen

- Microsoft Learn: App registration / Microsoft Graph — https://learn.microsoft.com/en-us/graph/toolkit/get-started/add-aad-app-registration
- Microsoft Learn: OAuth 2.0 Authorization Code + PKCE — https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Microsoft Entra Admin Center — https://entra.microsoft.com/
