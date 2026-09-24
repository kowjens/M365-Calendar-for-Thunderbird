# V2.44 publishing text

This file contains copy/paste text for GitHub and addons.thunderbird.net (ATN).

## GitHub Desktop commit

### Summary

```text
V2.44 - ATN Standard edition and public distribution cleanup
```

### Description

```text
Prepare V2.44 with a clean public distribution model.

- publish an Experiment-free ATN STANDARD edition
- keep the deeper GITHUB NATIVE Thunderbird Calendar integration on GitHub
- keep GITHUB STANDARD as the normal WebExtension edition
- prevent cross-edition updates by keeping distinct STANDARD and NATIVE add-on IDs
- add ATN publication/reviewer text and explicit edition limitations
- add an official Thunderbird webext-linter CI check for the ATN artifact
- harden version, package and public-repository hygiene validation
- remove private-build wording and duplicated stale variant documentation
- retain the Microsoft Entra setup guide required by all public editions
```

## GitHub Release

### Release title

```text
M365 Calendar for Thunderbird V2.44
```

### Release description

```text
V2.44 introduces a clean separation between the store and deeper native editions.

The addons.thunderbird.net build is now ATN STANDARD and contains no custom Thunderbird Experiment API. It provides the Microsoft 365 Space, Microsoft Graph calendar access, Teams meeting functions and invitation actions, but it does not register Microsoft 365 calendars in Thunderbird's built-in Calendar view.

Users who want deeper integration with Thunderbird's native Calendar can install GITHUB NATIVE from the GitHub release. That edition continues to use the custom nativeCalendar Experiment API and is therefore distributed outside ATN while new custom Experiment submissions are paused.

This release also adds stricter version/package/hygiene validation and an official Thunderbird webext-linter CI check for the ATN artifact. Microsoft Graph runtime behavior is otherwise unchanged from V2.43.
```

## ATN listing — English

### Short summary

```text
Microsoft 365 and Teams calendar integration for Thunderbird using Microsoft Graph and OAuth2/PKCE, with a dedicated M365 calendar space and meeting actions.
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
It intentionally does not register Microsoft 365 calendars inside Thunderbird's built-in Calendar view. That deeper integration requires a privileged custom Thunderbird Experiment API. New custom Experiment API submissions are currently not accepted by addons.thunderbird.net.

A GITHUB NATIVE edition with deeper integration into Thunderbird's built-in Calendar is available from the project's GitHub releases. The GitHub NATIVE edition is optional and is not the edition distributed by ATN.

The public add-on contains no preconfigured Microsoft tenant or Client ID. Users or administrators register their own Microsoft Entra application. No client secret is required.

This is an independent open-source project and is not an official Microsoft or Mozilla/Thunderbird product.
```

### Version notes

```text
V2.44 changes the ATN distribution to the Experiment-free STANDARD edition.

- removes the custom nativeCalendar Experiment API from the ATN package
- retains Microsoft Graph calendar access, the M365 Space, Teams meeting functions and invitation actions
- keeps deeper native Thunderbird Calendar integration available in the separate GitHub NATIVE edition
- adds stricter public-build, version and packaging validation
- adds the official Thunderbird webext-linter to the GitHub CI workflow for the ATN artifact
- updates Microsoft Entra setup and compatibility documentation

The ATN STANDARD edition does not display Microsoft 365 calendars directly in Thunderbird's built-in Calendar view.
```

### Notes for reviewers

```text
This V2.44 submission is the STANDARD edition and replaces the previously attempted NATIVE/Experiment submission.

The submitted XPI contains no `experiment_apis` manifest entry, no `experiments/` directory and no custom Thunderbird Experiment API.

Add-on ID:
m365-calendar-standard@3-5pe.com

The JavaScript, HTML and CSS in the XPI are human-readable first-party source files. There is no minification, obfuscation, transpilation, template compilation or JavaScript bundling. The build helper only creates a deterministic ZIP/XPI and does not rewrite the source or manifest.

Build command:
python tools/build_xpi.py --atn

Expected output:
release/M365_Thunderbird_Calendar_V2.44_ATN_STANDARD.xpi

The ATN_STANDARD payload is byte-identical to the normal STANDARD payload; only the output filename differs.

The deeper GITHUB NATIVE edition is intentionally not submitted to ATN because it uses the custom `nativeCalendar` Experiment API.

Microsoft authentication uses OAuth2 Authorization Code with PKCE. The public build has no preconfigured Microsoft tenant or Client ID and contains no client secret.
```

## ATN listing — Deutsch

### Kurzbeschreibung

```text
Microsoft-365- und Teams-Kalenderintegration für Thunderbird über Microsoft Graph und OAuth2/PKCE mit eigenem M365-Kalenderbereich und Meeting-Funktionen.
```

### Beschreibung

```text
M365 Calendar for Thunderbird bindet Microsoft-365-/Exchange-Online-Kalender über Microsoft Graph und OAuth2 Authorization Code mit PKCE in Thunderbird ein.

Die ATN-Version ist die STANDARD-Edition. Sie bietet unter anderem einen eigenen Microsoft-365-Kalenderbereich mit Monats-, Wochen-, Tages- und Agendaansicht, Microsoft-Graph-Kalenderzugriff, Teams-Meeting-Erstellung und -Bearbeitung sowie Accept/Tentative/Decline für Meeting-Einladungen.

Einschränkung der ATN STANDARD-Edition:
Sie trägt Microsoft-365-Kalender absichtlich nicht direkt in Thunderbirds eingebaute Kalenderansicht ein. Diese tiefere Integration benötigt eine privilegierte benutzerdefinierte Thunderbird-Experiment-API. Neue Einreichungen mit eigenen Experiment APIs werden derzeit von addons.thunderbird.net nicht angenommen.

Eine GITHUB NATIVE-Edition mit tieferer Integration in Thunderbirds eingebauten Kalender steht zusätzlich über die GitHub-Releases des Projekts zur Verfügung. Diese NATIVE-Edition ist optional und nicht die über ATN vertriebene Version.

Die öffentliche Version enthält keine vorkonfigurierte Microsoft-Tenant-ID oder Client-ID. Benutzer bzw. Administratoren registrieren ihre eigene Microsoft-Entra-Anwendung; ein Client Secret ist nicht erforderlich.
```

## ATN source-code question

For V2.44 ATN STANDARD, answer **No** to the questions about minification/obfuscation, JavaScript bundlers, template engines or other source-generation/transformation tools. The XPI contains the authored human-readable files directly; the Python helper only packages them into the XPI archive.

If ATN nevertheless explicitly requests a source archive, use the dedicated `M365_Calendar_for_Thunderbird_V2.44_ATN_SOURCE.zip` included in the release package.
