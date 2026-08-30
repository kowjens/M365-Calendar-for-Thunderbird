# Administratoranleitung – M365 Calendar for Thunderbird V2.33

Build: **GITHUB / STANDARD**

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

Die öffentlichen NATIVE- und STANDARD-Editionen verwenden getrennte stabile Add-on-IDs. Die für addons.thunderbird.net vorgesehene NATIVE-Edition nutzt `m365-calendar-public@35pwr.com`; STANDARD nutzt `m365-calendar-standard@35pwr.com`.

## 6. Hinweis zum STANDARD-Build

Der STANDARD-Build besitzt absichtlich **keine native Thunderbird-Kalenderintegration**. Es gibt daher weder `M365 · …`-Kalender in Thunderbirds normaler Kalenderliste noch den zusätzlichen Teams-Meeting-Button in der nativen Kalenderansicht. Diese Funktionen gehören ausschließlich zum NATIVE-Build.

## 8. Sicherheits-/OAuth-Hinweise

- Kein Client Secret im Add-on hinterlegen.
- OAuth verwendet PKCE.
- Access-/Refresh-Tokens werden im lokalen Thunderbird-Erweiterungsspeicher des Profils gehalten.
- Berechtigungen nach dem Least-Privilege-Prinzip vergeben.
- Nach nachträglichem Hinzufügen von `Calendars.ReadWrite.Shared` einmal einen neuen interaktiven **Microsoft Login** ausführen, damit der Scope im Token enthalten ist.


## Datenübertragung zu Microsoft Graph

Das öffentliche Manifest deklariert `sensitiveDataUpload`, weil Kalender-/Kontodaten für die konfigurierte Microsoft-365-Verbindung an die fest definierten Microsoft-Identity- und Graph-Endpunkte übertragen werden. Es existiert kein Projekt-Backend, das diese Daten empfängt. Details stehen in `PRIVACY.md` bzw. im vollständigen Datenschutztext auf addons.thunderbird.net.

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

## V2.21: Adressbuch, Kalender-Einstellungen und Anmeldung

- **Teilnehmer-Autovervollständigung (NATIVE):** Zusätzlich zur WebExtension-Adressbuch-API durchsucht der NATIVE-Build jetzt direkt Thunderbirds eigene Adressbuchverwaltung. Damit werden lokale, CardDAV- und – soweit Thunderbird sie bereitstellt – Betriebssystem-/weitere Adressbücher über denselben Datenbestand gesucht, den Thunderbird selbst verwendet.
- **Kalender-Einstellungen bleiben erhalten:** Farbe, aktiviert/deaktiviert, Sichtbarkeit, Alarm-Unterdrückung und die zugeordnete E-Mail-Identität werden als Benutzer-Einstellungen gespeichert und nach einem Thunderbird-Neustart wiederhergestellt. Eine Graph-Synchronisation überschreibt die vom Benutzer gewählte Farbe nicht mehr.
- **Microsoft-Anmeldung robuster:** Temporäre Token-/Netzwerkfehler löschen die gespeicherte Anmeldung nicht mehr. Wenn nötig versucht das Add-on zunächst eine stille Wiederanmeldung über die bereits vorhandene Microsoft-Sitzung und verlangt nur dann eine interaktive Anmeldung, wenn Microsoft sie wirklich fordert.
- **E-Mail-Identität im nativen Kalender (NATIVE):** Der Provider löst jetzt Thunderbirds `imip.identity` korrekt auf. Wenn ein Thunderbird-Mailkonto dieselbe E-Mail-Adresse wie das angemeldete M365-Konto verwendet, wird diese Identität beim ersten Anlegen automatisch vorausgewählt. Die Auswahl kann in den Kalender-Eigenschaften geändert werden und bleibt gespeichert.

## 9. V2.23 – Native-Zeitkonvertierung und Reload-Härtung

V2.23 korrigiert zwei native Thunderbird-Pfade:

1. Zeitstempel werden zunächst als absoluter JavaScript-Zeitpunkt erhalten und anschließend in Thunderbird-UTC umgerechnet. Dadurch wird der lokale UTC-Offset nicht doppelt angewendet.
2. Thunderbirds Provider-Replay und der direkte Graph-Cache-Push werden pro Graph-Kalender serialisiert. `resetLog()` löst keinen zusätzlichen `onLoad`/Replay mehr aus und der Cache-Abgleich arbeitet mit gespeicherten Parent-Events.

Nach dem Update einmal **Native Kalender synchronisieren**, damit Cache-Einträge aus V2.22 mit der neuen Zeitumwandlung neu geschrieben werden.


## 10. V2.24 – Read-after-write und schnelle Adresssuche

V2.24 hält direkte Graph-Schreibergebnisse für 120 Sekunden als Schutzobjekte vor. Ein unmittelbar folgender `calendarView`-Abruf darf einen frisch angelegten/geänderten Termin nicht durch einen älteren Snapshot löschen; Löschungen werden analog als Tombstone geschützt. Sobald `calendarView` denselben `changeKey` bzw. das Verschwinden bestätigt, wird der Schutz entfernt.

Die Live-Teilnehmersuche beendet sich bereits nach einem Treffer aus `contacts.quickSearch()`. Die vollständige Enumeration bleibt für Diagnose/Fallback verfügbar.


## V2.27: Adressbücher für Teilnehmer-Vorschläge

In **Microsoft 365 → Zahnrad → Einstellungen** können unter **Adressbücher für Teilnehmer-Vorschläge** ein oder mehrere Thunderbird-Adressbücher ausgewählt werden. Die Auswahl begrenzt die Live-Vorschläge im Teilnehmerfeld und kann große alte/gesammelte Adressbücher von der Suche ausschließen.
