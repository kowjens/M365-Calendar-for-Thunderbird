# Administratoranleitung – M365 Calendar for Thunderbird V2.19

**Autor:** Jens Kowalsky  
**Öffentliche GitHub-Ausgabe:** keine vorkonfigurierte Client-ID und kein Tenant.


Build: **GITHUB / NATIVE**

Client-ID und Tenant sind in diesem GITHUB-Build absichtlich leer und müssen einmalig in den Add-on-Einstellungen eingetragen werden.

## 1. Microsoft-Entra-App registrieren

Die folgenden Menübezeichnungen wurden am **20.08.2026** gegen die aktuelle Microsoft-Learn-Dokumentation geprüft. Je nach Portal-Sprache oder laufenden Microsoft-UI-Rollouts können einzelne Bezeichnungen geringfügig abweichen.

1. **https://entra.microsoft.com** öffnen und mit einem Konto anmelden, das App-Registrierungen anlegen darf.
2. Falls mehrere Mandanten vorhanden sind, oben über **Einstellungen → Verzeichnisse + Abonnements** den richtigen Mandanten wählen.
3. Menüfolge:
   **Entra ID → App-Registrierungen → Neue Registrierung**
4. Einen Namen vergeben, z. B. **M365 Calendar for Thunderbird**.
5. Unter **Unterstützte Kontotypen** für eine interne Firmeninstallation normalerweise wählen:
   **Nur Konten in diesem Organisationsverzeichnis (Einzelner Mandant)**.
6. **Registrieren** anklicken.
7. Auf **Übersicht** die folgenden Werte notieren:
   - **Anwendungs-ID (Client)** / Application (client) ID
   - **Verzeichnis-ID (Mandant)** / Directory (tenant) ID

Für das Add-on kann beim Tenant entweder die Tenant-ID oder die `*.onmicrosoft.com`-Mandantendomäne verwendet werden.

Microsoft-Referenz: https://learn.microsoft.com/de-de/entra/identity-platform/quickstart-register-app

## 2. Redirect URI eintragen

Die Redirect URI **nicht raten oder manuell konstruieren**. Sie wird von Thunderbird für die installierte Erweiterung erzeugt und im Add-on angezeigt.

1. Thunderbird öffnen.
2. Links in der **Spaces-Leiste** den neuen Space **Microsoft 365** öffnen.
3. Oben rechts auf das **Zahnrad-Symbol (⚙)** klicken.
4. In den Add-on-Einstellungen die angezeigte **OAuth Redirect URI** kopieren.
5. Zur Entra-App zurückkehren.
6. Menüfolge:
   **Entra ID → App-Registrierungen → <Ihre App> → Verwalten → Authentifizierung**
7. **Plattform hinzufügen** bzw. **Umleitungs-URI hinzufügen** auswählen.
8. Plattform **Einzelseitenanwendung / Single-page application (SPA)** auswählen.
9. Die aus Thunderbird kopierte Redirect URI **exakt und unverändert** einfügen.
10. **Konfigurieren** bzw. **Speichern**.

Für diese Erweiterung ist **kein Client Secret** erforderlich. Die Anmeldung verwendet Authorization Code + PKCE.

Microsoft-Referenz: https://learn.microsoft.com/de-de/entra/identity-platform/how-to-add-redirect-uri

## 3. Microsoft-Graph-API-Berechtigungen

Menüfolge in der App-Registrierung:

**Entra ID → App-Registrierungen → <Ihre App> → Verwalten → API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Delegierte Berechtigungen**

Dann über das Suchfeld hinzufügen:

| Berechtigung | Erforderlich | Zweck |
|---|---|---|
| `User.Read` | ja | angemeldetes Benutzerprofil lesen |
| `Calendars.ReadWrite` | ja | eigene Kalender und Termine lesen, erstellen, ändern und löschen |
| `Calendars.ReadWrite.Shared` | empfohlen/optional | freigegebene bzw. delegierte Kalender lesen und – soweit der Benutzer berechtigt ist – schreiben |

Anschließend **Berechtigungen hinzufügen** anklicken.

`Calendars.ReadWrite` und `Calendars.ReadWrite.Shared` sind in Microsoft Graph als **delegierte** Berechtigungen vorgesehen. Microsoft kennzeichnet für diese delegierten Berechtigungen die Administratorzustimmung grundsätzlich als **nicht zwingend erforderlich**. Die eigene Tenant-Consent-Policy kann Benutzerzustimmung aber dennoch blockieren.

Falls Benutzer in Ihrem Mandanten nicht selbst zustimmen dürfen:

**API-Berechtigungen → Administratorzustimmung für <Mandant> erteilen → Ja**

Danach sollte in der Spalte **Status** sinngemäß **Erteilt für <Mandant>** erscheinen.

Microsoft-Referenzen:
- https://learn.microsoft.com/de-de/entra/identity-platform/quickstart-configure-app-access-web-apis
- https://learn.microsoft.com/de-de/graph/permissions-reference

## 4. Add-on konfigurieren

### INTERNAL

Die vorkonfigurierte INTERNAL-Fassung kann normalerweise direkt verwendet werden. Trotzdem sollten Admins die Werte unter **Microsoft 365 → ⚙ Einstellungen** kontrollieren.

### GITHUB

Bei der neutralen GITHUB-Fassung unter **Microsoft 365 → ⚙ Einstellungen** eintragen:

- **Application (Client) ID**
- **Tenant**: Directory (tenant) ID oder `*.onmicrosoft.com`

Anschließend **Speichern** und **Microsoft Login** ausführen.

## 5. NATIVE und STANDARD

- **STANDARD**: Microsoft-365-Space, Graph-Kalender, Teams-Termine und Einladungsfunktionen; **keine** native Thunderbird-Kalenderintegration und keine privilegierte Experiment-API.
- **NATIVE**: zusätzlich echte M365-Kalender in Thunderbirds normaler Kalenderansicht. Dafür verwendet die Erweiterung eine privilegierte Thunderbird Experiment API.

Die vier Builds haben dieselbe Extension-ID und sind **Alternativen**, nicht parallel zu installieren.

## 6. Native Kalenderintegration und Diagnose

Nach erfolgreichem Login wird die native Synchronisation automatisch angestoßen: beim Thunderbird-Start, nach Login und beim Aktivieren/Speichern der nativen Integration.

Der Button **Native Kalender synchronisieren** bleibt als manueller Fallback erhalten.

Direkt **oberhalb** dieses Buttons befindet sich der aufklappbare Bereich **Native Diagnose**. Bei Problemen bitte diesen Bereich aufklappen und den **vollständigen Text** kopieren. Besonders relevant sind unter anderem:

```text
build=
experiment=
providerRuntime=
tbCalendars=
graphCalendars=
syncGraphEvents=
syncCacheWrites=
syncCacheItems=
syncError=
lastError=
trace:
```

Diesen Block möglichst unverändert an Support/Administrator senden.

## 7. Teams-Meeting-Button im nativen Thunderbird-Kalender

V2.17 stellt in der normalen Thunderbird-Kalenderansicht einen **Teams-Meeting**-Button und einen Rechtsklick-Eintrag **Neues Teams-Meeting** bereit. Der Button öffnet in einem kompakten Fenster denselben M365-Termin-Editor, der auch im Microsoft-365-Space verwendet wird. Dadurch existiert nur eine gemeinsame Graph-Erstellungslogik.

Ein Teams-Termin wird über Microsoft Graph als Kalenderereignis mit `isOnlineMeeting=true` und `onlineMeetingProvider=teamsForBusiness` erzeugt.

Microsoft-Referenz: https://learn.microsoft.com/de-de/graph/api/calendar-post-events?view=graph-rest-1.0

## 8. Sicherheits-/OAuth-Hinweise

- Kein Client Secret im Add-on hinterlegen.
- OAuth verwendet PKCE.
- Access-/Refresh-Tokens werden im lokalen Thunderbird-Erweiterungsspeicher des Profils gehalten.
- Berechtigungen nach dem Least-Privilege-Prinzip vergeben.
- Nach nachträglichem Hinzufügen von `Calendars.ReadWrite.Shared` einmal einen neuen interaktiven **Microsoft Login** ausführen, damit der Scope im Token enthalten ist.


## Neue Thunderbird-Berechtigung in V2.17: `addressBooks`

Für die Teilnehmer-Autovervollständigung benötigt die Erweiterung die Thunderbird-WebExtension-Berechtigung `addressBooks`. Thunderbird beschreibt diese Berechtigung allgemein als Lesen und Ändern von Adressbüchern/Kontakten. **M365 Calendar verwendet sie jedoch nur lesend**, konkret für `contacts.quickSearch()`. Der Code legt keine Kontakte an und verändert/löscht keine Kontakte.

Bei einem Update von einer älteren Version kann Thunderbird wegen der zusätzlichen Berechtigung erneut eine Berechtigungsbestätigung anzeigen. Für eine Veröffentlichung sollte dieser Zweck in README/Privacy/Release Notes transparent dokumentiert bleiben.


## Neuerungen in V2.18: Kontakte und Doppelklick im nativen Kalender

### Teilnehmer-Vorschläge

Beim Tippen im Feld **Teilnehmer** beginnt die Suche ab zwei Zeichen. V2.18 verwendet die Thunderbird-MV2-Signatur `contacts.quickSearch([parentId], queryInfo)` explizit und besitzt zusätzlich einen Fallback über die lokal verfügbaren Adressbücher. Direkt unter dem Eingabefeld erscheint nun ein Status wie **Adressbücher werden durchsucht**, **Keine passenden Kontakte** oder die Anzahl der Treffer. Dadurch sind Berechtigungs-/API-Probleme nicht mehr unsichtbar.

### Doppelklick auf M365-Termine (NATIVE)

Im NATIVE-Build öffnet ein **Doppelklick auf einen Termin eines M365-Kalenders** nun das M365-/Graph-Terminfenster des Add-ons. Für eigene/bearbeitbare Termine öffnet sich direkt der Editor. Bei Terminen anderer Organisatoren öffnet sich die M365-Detailansicht mit den verfügbaren Antwortaktionen. Termine anderer Kalender (lokal, CalDAV usw.) verwenden weiterhin Thunderbirds normales Terminfenster.

## V2.19: Dialoge auf kleinen Bildschirmen

Die M365-Terminfenster verwenden jetzt einen festen Kopf- und Fußbereich. Nur der mittlere Inhalt scrollt. Dadurch bleiben Schaltflächen wie **Teams beitreten**, **Bearbeiten**, **Ablehnen**, **Vorbehalt** und **Annehmen** auch bei langen Meeting-Informationen oder auf kleineren Laptop-Displays erreichbar. Lange Teams-/Meeting-URLs werden umgebrochen und erzeugen keinen eigenen horizontalen Scrollbereich mehr.

> **Hinweis zur öffentlichen GitHub-Version:** Sie verwendet die Add-on-ID `m365-calendar@jenskowalsky.invalid`. Deshalb unterscheidet sich ihre OAuth Redirect URI von privaten/internen Builds. In Entra immer exakt die URI eintragen, die das installierte Add-on anzeigt.
