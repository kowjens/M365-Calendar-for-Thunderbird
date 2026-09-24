# Benutzeranleitung – M365 Calendar for Thunderbird V2.43

Build: **GITHUB / NATIVE**

Client-ID und Tenant sind in diesem GITHUB-Build absichtlich leer und müssen einmalig in den Add-on-Einstellungen eingetragen werden.

## Microsoft-365-Space öffnen

Nach der Installation und einem vollständigen Thunderbird-Neustart erscheint links in der vertikalen **Spaces-Leiste** ein neuer Eintrag **Microsoft 365**.

1. Links **Microsoft 365** anklicken.
2. Der neue Microsoft-365-Tab/Space wird geöffnet.
3. Oben rechts befindet sich ein **Zahnrad-Symbol (⚙)**.
4. Dieses Zahnrad öffnet die **Add-on-Einstellungen**.

Dort befinden sich Anmeldung, Entra-Konfiguration, Synchronisation und – im NATIVE-Build – die Native-Diagnose.

## Erstanmeldung

1. **Microsoft 365 → ⚙ Einstellungen** öffnen.
2. Application (Client) ID und Tenant eintragen, die der Administrator bereitgestellt hat.
3. **Microsoft Login** anklicken.
4. Microsoft-Konto auswählen und die angeforderten Kalenderberechtigungen bestätigen.
5. Nach erfolgreicher Anmeldung lädt der Microsoft-365-Space die verfügbaren Kalender und Termine.

## Native Thunderbird-Kalenderintegration

Es muss **kein ICS-Kalender importiert** und kein Netzwerk-Kalender manuell angelegt werden.

1. **Microsoft 365 → ⚙ Einstellungen** öffnen.
2. **Microsoft-365-Kalender nativ in Thunderbird einbinden** aktivieren.
3. **Speichern**.
4. Die Synchronisation läuft danach automatisch; ebenso bei späteren Thunderbird-Neustarts.
5. Thunderbirds normalen **Kalender** öffnen. Links sollten Kalender wie `M365 · Calendar` erscheinen.

### Manueller Sync und Debug-Informationen

Der Button **Native Kalender synchronisieren** ist weiterhin vorhanden. Er ist vor allem ein manueller Fallback und für die Fehlersuche gedacht.

**Direkt oberhalb** des Buttons befindet sich der aufklappbare Abschnitt **Native Diagnose**.

Bei einem Fehler:

1. **Microsoft 365 → ⚙ Einstellungen** öffnen.
2. **Native Diagnose** aufklappen.
3. Den **gesamten Textblock** markieren und kopieren – nicht nur die letzte Fehlermeldung.
4. Den kopierten Block an Administrator/Support senden.

Der Block enthält z. B. `build`, `experiment`, `providerRuntime`, `tbCalendars`, `graphCalendars`, `syncCacheItems`, mögliche `syncError`-Zeilen und einen `trace`.

### Diagnose-ZIP für fehlende native Termine (V2.34)

Unter **Microsoft 365 → ⚙ Einstellungen → Native Thunderbird-Kalenderintegration** steht **Kalender-Diagnoseexport** zur Verfügung. Wähle einen Zeitraum, der den fehlenden Termin sowie mindestens einen Serientermin davor und danach enthält, und klicke **Diagnose-ZIP erstellen**.

Der Export startet **keine native Synchronisation**. Dadurch bleibt der fehlerhafte Thunderbird-Cache unverändert und kann mit dem aktuellen Graph-/Space-Stand verglichen werden. Das ZIP enthält unter anderem `comparison.csv`, `series_comparison.json`, `graph_calendarview_raw.json`, `space_snapshot.json`, `native_cache.json` und `native_calendar.ics`. Einzelne Serieninstanzen, die Graph liefert, aber im nativen Cache fehlen, werden als `missing-native` markiert.

Das ZIP enthält Kalenderinhalte und Teilnehmeradressen, aber keine OAuth-Zugriffs- oder Refresh-Tokens.

## Neues Teams-Meeting direkt im normalen Thunderbird-Kalender

V2.17 bietet im **normalen Thunderbird-Kalender** einen Button **Teams-Meeting** und zusätzlich per Rechtsklick auf ein Datum **Neues Teams-Meeting**.

1. Thunderbirds **Kalender** öffnen.
2. **Teams-Meeting** anklicken.
3. Es öffnet sich ein kompaktes Fenster mit demselben M365-Termin-Editor wie im Microsoft-365-Space.
4. Betreff, Beginn/Ende, Teilnehmer und weitere Optionen eingeben.
5. Die Option für Teams ist bereits aktiviert.
6. **Termin erstellen** anklicken.

Das Meeting wird direkt im Microsoft-365-/Exchange-Online-Kalender angelegt und anschließend in den nativen Thunderbird-Kalender synchronisiert.

## Funktionen im Microsoft-365-Space

Im Space können unter anderem Termine angezeigt, erstellt, bearbeitet und gelöscht werden. Außerdem stehen Teams-Meetings, Ganztagstermine, Erinnerungen, Kategorien, Frei/Beschäftigt, einfache Serien, Teilnehmerstatus, Frei/Belegt-Abfrage und Einladungsantworten zur Verfügung.

## Bei Problemen

Zuerst prüfen:

- Ist der **Microsoft Login** noch aktiv?
- Ist der richtige Kalender ausgewählt?
- Bei NATIVE: ist **Microsoft-365-Kalender nativ in Thunderbird einbinden** aktiviert?
- Bei NATIVE: **Native Diagnose** vollständig kopieren.
- Bei Bedarf einmal **Native Kalender synchronisieren** ausführen.


## Teilnehmer aus Thunderbird-Adressbüchern

Beim Eingeben eines Teilnehmers durchsucht der Termin-Editor ab **zwei Zeichen** die in Thunderbird vorhandenen Adressbücher. Passende Namen und E-Mail-Adressen erscheinen direkt unter dem Eingabefeld; mit Pfeiltasten und **Enter** oder per Mausklick kann eine Adresse übernommen werden. Lokale und eingebundene/remote Adressbücher werden berücksichtigt, soweit Thunderbird sie über seine Adressbuch-API bereitstellt.

Dafür benötigt V2.17 die Thunderbird-Berechtigung **Adressbücher lesen und ändern (`addressBooks`)**. Das Add-on verwendet diese Berechtigung ausschließlich zum **Lesen/Suchen von Kontakten für die Autovervollständigung**; es erstellt, verändert oder löscht keine Kontakte. Erst die vom Benutzer tatsächlich in den Termin übernommenen E-Mail-Adressen werden beim Erstellen des Meetings als Teilnehmer an Microsoft Graph übertragen.

## Teams-Meeting per Rechtsklick auf Datum/Uhrzeit (NATIVE)

Im NATIVE-Build kann in der normalen Thunderbird-Kalenderansicht auf eine freie Stelle bzw. ein Datum/eine Uhrzeit rechtsgeklickt werden. Im Kontextmenü steht **Neues Teams-Meeting**. Der M365-Editor übernimmt nach Möglichkeit das angeklickte Datum bzw. die ausgewählte Uhrzeit als Beginn und öffnet den Teams-Modus bereits aktiviert.

## Größe des Teams-Meeting-Fensters

Das separate Teams-Meeting-Fenster passt seine Breite und Höhe nun automatisch an die **verfügbare Monitorfläche** an. Auf kleinen Laptop-Displays bleibt der Kopf-/Fußbereich sichtbar und der Formularinhalt wird intern scrollbar, statt das Fenster größer als den Monitor zu öffnen.


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

## V2.23: Uhrzeit, Thunderbird-Reload und Settings-Fenster

- **Native Uhrzeiten:** V2.23 korrigiert die Thunderbird-interne Umwandlung so, dass ein absoluter Zeitpunkt nicht nochmals als lokale Uhrzeit in UTC interpretiert wird. Nach dem Update bitte einmal **Native Kalender synchronisieren**, damit bereits falsch gespeicherte Cache-Einträge neu geschrieben werden.
- **Reload Calendars and Changes:** Provider-Replay und direkter Cache-Abgleich werden je M365-Kalender nacheinander ausgeführt; wiederkehrende Termine werden beim Cache-Abgleich nicht mehr als zusätzliche Parent-Einträge behandelt.
- **Settings auf kleinen Displays:** die Einstellungsfelder dürfen nicht mehr über die Dialogbreite hinauswachsen. Unter 720 px Fensterbreite wird das Formular einspaltig.
- Die in V2.22 reparierte CardDAV-/Adressbuchsuche bleibt unverändert.


## V2.24: neue Termine und Teilnehmer-Vorschläge

- Ein gerade im Add-on oder im nativen M365-Kalender angelegter/geänderter Termin wird gegen einen kurzfristig veralteten Graph-`calendarView`-Snapshot geschützt. Dadurch soll er nach dem Synchronisieren nicht mehr kurz erscheinen und wieder verschwinden.
- Teilnehmer-Vorschläge verwenden im normalen Tippbetrieb zuerst Thunderbirds schnelle `contacts.quickSearch()`-Suche. Die vollständige Adressbuch-Enumeration ist nur noch Fallback bzw. Bestandteil des Tests in den Einstellungen.
- Die Vorschlagsliste bleibt auch bei vollständig eingegebenen E-Mail-Adressen aktiv.


## V2.27: Adressbücher für Teilnehmer-Vorschläge

In **Microsoft 365 → Zahnrad → Einstellungen** können unter **Adressbücher für Teilnehmer-Vorschläge** ein oder mehrere Thunderbird-Adressbücher ausgewählt werden. Die Auswahl begrenzt die Live-Vorschläge im Teilnehmerfeld und kann große alte/gesammelte Adressbücher von der Suche ausschließen.


## Kalenderansichten im Microsoft-365-Space

Oberhalb des Kalenders kann zwischen **Monat**, **Woche**, **Tag** und **Agenda** gewechselt werden. Die gewählte Ansicht wird gespeichert; die Navigation ‹ / Heute / › arbeitet passend zur jeweiligen Ansicht.

## V2.36: Erinnerung „Verwerfen“ und „Schlummern“ bleiben lokal

Thunderbird ändert beim Verwerfen oder Schlummern einer Erinnerung nur lokale Alarmdaten. V2.36 erkennt diese Änderungen vor jedem Microsoft-Graph-Schreibzugriff. **Verwerfen** und **Schlummern** zeigen daher keine Versandbestätigung und können kein Meeting-Update versenden. Eine echte Änderung des Erinnerungsvorlaufs (z. B. 15 auf 30 Minuten) bleibt dagegen eine Kalenderänderung und wird synchronisiert.


## V2.43 – Split-Mail / externe Einladungen

Wenn normale E-Mail bei one.com verbleibt, Teams-/Kalendernachrichten aber über Exchange Online verarbeitet werden sollen, siehe [one.com + Exchange Online Calendar Relay](setup/ONECOM_EXCHANGE_CALENDAR_RELAY_DE.md). Die Microsoft-Entra-App-Registrierung ist separat unter [Microsoft Entra Setup](setup/MICROSOFT_ENTRA_SETUP_DE.md) dokumentiert.
