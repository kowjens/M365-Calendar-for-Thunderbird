# V2.49 publishing and listing text

This file is the canonical copy/paste source for GitHub and addons.thunderbird.net (ATN).

## Distribution matrix

| Artifact | Add-on ID | Custom Experiment API | Intended publication |
|---|---|---:|---|
| ATN STANDARD | `m365-calendar-standard@3-5pe.com` | No | addons.thunderbird.net |
| GITHUB STANDARD | `m365-calendar-standard@3-5pe.com` | No | GitHub Releases |
| GITHUB NATIVE | `m365-calendar-for-thunderbird@3-5pe.com` | Yes (`nativeCalendar`) | GitHub Releases |

The ATN and GitHub STANDARD XPIs are intentionally byte-identical. The NATIVE edition has a distinct add-on ID so it cannot silently replace the STANDARD edition.

## GitHub repository About text

### Description

```text
Microsoft 365 / Exchange Online calendar and Teams integration for Thunderbird via Microsoft Graph and OAuth2/PKCE, with STANDARD and deeper NATIVE editions.
```

### Suggested topics

```text
thunderbird thunderbird-addon microsoft-365 exchange-online microsoft-graph calendar teams oauth2 pkce webextension
```

## GitHub Desktop commit

### Summary

```text
V2.49 - document Thunderbird Month/Multiweek NATIVE rendering limitation
```

### Description

```text
Document the Thunderbird NATIVE Month/Multiweek rendering limitation established by the V2.47 deep diagnostics.

- reproduced state: Graph 35 events / native 35 events / missingNative 0 / nativeOnly 0
- exact visible Multiweek range: cached wrapper, underlying provider and offline storage all return the same five M365 events
- corresponding calendar-month-day-box-item objects are instantiated in the Thunderbird Month/Multiweek DOM diagnostic
- keep the V2.47 provider/range/current-view diagnostics available for upstream analysis
- do not add another synchronization/cache rewrite or destructive GUI workaround
- add public Known Issues documentation and a privacy-safe Bugzilla evidence package
- keep STANDARD/ATN runtime behavior unchanged apart from the version increment
- make the GitHub updater directly accept V2.43 through V2.47 repositories
```

## GitHub Release

### Release title

```text
M365 Calendar for Thunderbird V2.49
```

### Release description

```text
V2.49 documents a reproducible limitation in Thunderbird's built-in Month/Multiweek Calendar rendering for the GITHUB NATIVE edition. V2.47 diagnostics showed that the affected events were still present in Graph results, Thunderbird native cache, cached wrapper, underlying provider and instantiated Month/Multiweek item objects. V2.49 therefore leaves synchronization/cache mapping unchanged, retains the deep diagnostics and points users to Day/Week or the add-on's Microsoft 365 Space when completeness is critical. The issue does not describe the ATN STANDARD edition's own Space UI.

V2.46 confirmed that replacing the normal goToDay() refresh workaround with refreshItems(true) does not eliminate the issue. V2.47 then added deep provider/range/current-view diagnostics. In the reproduced failure state those diagnostics found no Graph/native-cache discrepancy and found the same five visible-range events at the cached-wrapper, underlying-provider and offline-storage layers; corresponding Month/Multiweek item objects were also instantiated in the DOM diagnostic.

V2.49 therefore treats the remaining failure boundary as Thunderbird Calendar frontend layout/painting or adjacent host-UI processing. The deep V2.47 diagnostics remain available, but Graph event mapping and native-cache mapping are intentionally unchanged.

Practical recommendation for affected NATIVE users: use Day/Week or the add-on's own Microsoft 365 Space when completeness is critical, and export diagnostics before navigating away from a failing Month/Multiweek state.

Repository updater:
- direct update to V2.49 is supported from V2.43, V2.44, V2.45, V2.46, V2.47, V2.48 and V2.49
- the updater preserves .git, creates a backup, replaces managed release trees and verifies the final payload by SHA-256

Public editions:
- STANDARD: normal Thunderbird WebExtension edition, available from GitHub and prepared for ATN.
- NATIVE: deeper integration with Thunderbird's built-in Calendar through the custom nativeCalendar Experiment API; distributed through GitHub.

The ATN STANDARD artifact contains no Experiment API and no experiments/ directory. It provides the Microsoft 365 Space, Microsoft Graph calendar access, Teams meeting creation/editing, meeting invitation actions, recurring-event handling, attendee suggestions and diagnostics, but it does not register Microsoft 365 calendars inside Thunderbird's built-in Calendar view.
```

## ATN listing - English

### Short summary

```text
Microsoft 365 and Teams calendar integration for Thunderbird via Microsoft Graph and OAuth2/PKCE, with a dedicated M365 calendar space and meeting actions.
```

### Full description

```text
M365 Calendar for Thunderbird connects Thunderbird to Microsoft 365 / Exchange Online calendars through Microsoft Graph and OAuth2 Authorization Code with PKCE.

The ATN edition is the STANDARD edition. It provides:
- a dedicated Microsoft 365 calendar space with Month, Week, Day and Agenda views
- Microsoft Graph calendar synchronization and event management
- creation and editing of Microsoft Teams meetings
- Accept, Tentative and Decline actions for meeting invitations
- recurring-event and exception handling
- Thunderbird address-book suggestions for meeting attendees
- configurable confirmation before outgoing meeting-related actions
- diagnostics and Microsoft Entra configuration inside Thunderbird

Limitation of the ATN STANDARD edition:
It does not register Microsoft 365 calendars inside Thunderbird's built-in Calendar view. This is intentional because the deeper integration requires a custom Thunderbird Experiment API.

A separate NATIVE edition with deeper integration into Thunderbird's built-in Calendar is available from the project's GitHub Releases. That edition uses the custom nativeCalendar Experiment API and is distributed outside ATN while Thunderbird pauses new submissions using unsupported custom Experiment APIs.

The public build contains no predefined Microsoft Entra Client ID, tenant ID or client secret. Users or administrators configure their own Microsoft Entra SPA application.

This is an independent community project and is not an official Microsoft, Mozilla/Thunderbird or 3-5 Power Electronics product.
```

### Version notes

```text
V2.49 hardens the ATN STANDARD package for automated and manual review: the settings JavaScript/CSS are now directly readable, the runtime message listener no longer uses an async event listener, STANDARD contains no browser.nativeCalendar references, and the settings/Privacy text explicitly discloses Microsoft Graph / Microsoft identity data transfer. The ATN artifact remains Experiment-free and does not register the native provider. The GitHub NATIVE edition retains the V2.47 deep diagnostics and the documented Thunderbird Month/Multiweek rendering limitation.
```

### Reviewer notes

```text
This submission is the STANDARD edition. It contains no experiment_apis manifest entry and no experiments/ directory.

The add-on source is human-readable JavaScript/HTML/CSS. In V2.49 the settings JavaScript and CSS were reformatted specifically so the shipped XPI itself is directly reviewable and is not minified. The supplied source archive uses a small Python script only to create the deterministic XPI/ZIP; it does not transpile, minify, obfuscate or rewrite the add-on source.

Runtime network access for Microsoft 365 functionality is limited by manifest permissions to:
- https://login.microsoftonline.com/*
- https://graph.microsoft.com/*

The public source has empty defaults for Microsoft Entra Client ID and tenant ID. No client secret is used. The user configures the Entra application/tenant and explicitly chooses Microsoft login. Calendar, attendee, meeting, invitation and contact data needed by requested Microsoft 365 features may then be exchanged with Microsoft Graph. The add-on has no telemetry and no developer-operated data backend. The `sensitiveDataUpload` permission is intentional and documented in PRIVACY.md.

The separate GitHub NATIVE edition is not part of this ATN submission. It uses a custom nativeCalendar Experiment API for deeper Thunderbird Calendar integration. The Month/Multiweek provider/view diagnostics and known host-UI issue apply to that NATIVE edition only; ATN STANDARD runtime behavior is otherwise unchanged from V2.47 apart from the version number.
```

## ATN listing - German

### Kurzbeschreibung

```text
Microsoft-365- und Teams-Kalenderintegration fuer Thunderbird ueber Microsoft Graph und OAuth2/PKCE mit eigenem M365-Kalenderbereich und Einladungsaktionen.
```

### Vollstaendige Beschreibung

```text
M365 Calendar for Thunderbird verbindet Thunderbird ueber Microsoft Graph und OAuth2 Authorization Code mit PKCE mit Microsoft 365 / Exchange Online.

Die ATN-Ausgabe ist die STANDARD-Edition. Sie bietet einen eigenen Microsoft-365-Kalenderbereich, Kalender- und Terminverwaltung ueber Microsoft Graph, Teams-Besprechungen, Zu-/Vorbehalt-/Absage-Aktionen fuer Einladungen, Serien-/Ausnahmebehandlung, Adressbuchvorschlaege sowie Diagnose- und Entra-Einstellungen.

Einschraenkung der ATN-STANDARD-Edition:
Microsoft-365-Kalender werden nicht direkt als Kalender in Thunderbirds eingebauter Kalenderansicht registriert. Diese tiefere Integration benoetigt eine benutzerdefinierte Thunderbird Experiment API.

Eine separate NATIVE-Edition mit tieferer Integration in Thunderbirds eingebauten Kalender steht ueber die GitHub-Releases des Projekts zur Verfuegung. Sie verwendet die custom nativeCalendar Experiment API und wird ausserhalb von ATN verteilt, solange Thunderbird neue Einreichungen mit nicht unterstuetzten eigenen Experiment APIs pausiert.

Der oeffentliche Build enthaelt keine vorbelegte Microsoft-Entra-Client-ID, Tenant-ID und kein Client Secret. Benutzer oder Administratoren konfigurieren ihre eigene Microsoft-Entra-SPA-Anwendung.
```

## Publication safety rule

Only artifacts explicitly located in a `PUBLIC` or `ATN` release area may be uploaded to GitHub/ATN. Files or archives marked `PRIVATE`, `INTERNAL` or `DO_NOT_PUBLISH` must never be attached to a public release.

## ATN V2.49 review notes

The ATN package is the STANDARD build only. It contains no Experiment API declaration, no `experiments/` directory and no `browser.nativeCalendar` references. Settings source files are shipped in readable, non-minified form.

Microsoft network access is limited to the endpoints declared in the manifest: Microsoft identity and Microsoft Graph. The user configures the Entra application/tenant and explicitly starts Microsoft login. Calendar/invitation/contact data required by requested features can be exchanged with Microsoft Graph. No telemetry or user data is sent to 3-5 Power Electronics GmbH or another developer-operated backend. See `PRIVACY.md`.
