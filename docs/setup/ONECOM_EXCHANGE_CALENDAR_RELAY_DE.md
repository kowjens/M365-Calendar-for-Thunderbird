# one.com + Exchange Online: nur Kalender/Teams über Microsoft 365

## Zielbild

Diese Konfiguration ist für Organisationen gedacht, die **normale E-Mail weiter bei one.com** per IMAP/SMTP betreiben möchten, aber **Teams-/Kalender-Einladungen bidirektional über Exchange Online** verarbeiten wollen.

Der öffentliche MX bleibt bei **one.com**. Microsoft beschreibt für Drittanbieter-Mailssysteme genau dieses Grundmuster: bestehendes Mail-System beibehalten, Nachrichten zusätzlich an Exchange Online liefern und dort alles außer dem Nachrichtentyp `Calendaring` verwerfen. Kalendernachrichten werden dadurch von Exchange/Teams verarbeitet, normale E-Mails bleiben beim bisherigen Provider.

## Datenfluss

```text
Internet
   |
   | MX für 3-5pe.com
   v
one.com  ----------------------> Thunderbird IMAP  (normale E-Mail bleibt hier)
   |
   | zweite Zustellung / Forward an <user>@<tenant>.onmicrosoft.com
   v
Exchange Online
   |
   +-- Calendaring ----------------> Exchange-Kalender / Teams / Graph
   |
   +-- andere externe Mail --------> per Transport Rule löschen
```

Für ausgehende normale E-Mail verwendet Thunderbird weiterhin den one.com-SMTP-Account. Teams-Meetings und Graph-Kalenderaktionen laufen über Microsoft 365.

## 1. Voraussetzungen

- Die eigene Domain ist in Microsoft 365 bereits **verifiziert**.
- Der MX der Domain bleibt auf one.com.
- Für jeden Kalender-/Teams-Benutzer existiert ein Exchange-Online-Postfach bzw. eine Lizenz, die einen Exchange-Kalender bereitstellt.
- Die SMTP-Adresse des Benutzers (`user@domain.tld`) ist auch dem Microsoft-365-Benutzer zugeordnet.
- Der technische `onmicrosoft.com`-Alias des Benutzers ist bekannt. Dieser ist das sichere Forward-Ziel, weil dadurch keine Schleife über den öffentlichen MX entsteht.

## 2. Domain in Exchange Online als Internal Relay

Microsoft empfiehlt bei einem parallel weiter betriebenen Drittanbieter-Mailssystem die Domain als **Internal Relay** zu konfigurieren.

Exchange Admin Center:

1. **Mail flow** → **Accepted domains**.
2. Die bestehende Domain öffnen.
3. **Internal relay** auswählen.
4. Speichern.

PowerShell-Kontrolle bzw. Änderung:

```powershell
Connect-ExchangeOnline
Get-AcceptedDomain | Format-Table Name,DomainName,DomainType,Default
Set-AcceptedDomain -Identity "3-5pe.com" -DomainType InternalRelay
```

> Vor dem Ändern zuerst `Get-AcceptedDomain` prüfen und den tatsächlichen Identity/Domain-Namen verwenden.

## 3. one.com: zweite Zustellung an Exchange Online

Für jeden Benutzer wird bei one.com eine automatische Weiterleitung auf den technischen Microsoft-365-Alias eingerichtet, beispielsweise:

```text
gerhard@3-5pe.com
    -> gerhard@<tenant>.onmicrosoft.com
```

one.com: **E-Mail und Microsoft 365 → Mail Administration → Konto → Einstellungen → Weiterleitungen**. Die Zieladresse muss über die von one.com versandte Bestätigungsmail verifiziert werden.

**Wichtig:** Das Ziel ist ausdrücklich der `onmicrosoft.com`-Alias und nicht erneut `gerhard@3-5pe.com`; sonst kann eine Routing-Schleife entstehen.

### Muss die one.com-Kopie erhalten bleiben?

Ja. Dieses Design benötigt **Dual Delivery**: die normale Nachricht muss im one.com-Postfach verbleiben und zusätzlich an Exchange Online gelangen. Die öffentlich zugängliche one.com-Anleitung beschreibt die Weiterleitung, legt aber nicht eindeutig fest, ob das jeweilige Produkt/Account-Setup die lokale Kopie immer behält. Deshalb zuerst mit einem Testkonto prüfen.

Falls one.com die Originalzustellung beim Forward nicht beibehält, gibt es zwei saubere Alternativen:

1. one.com-Support nach **copy/dual delivery** für das konkrete Paket fragen; oder
2. einen kleinen SMTP-Relay/Proxy als vorgeschalteten MX verwenden, der jede Nachricht an one.com zustellt und nur Kalendernachrichten zusätzlich an Exchange Online spiegelt. Die eigentlichen Postfächer bleiben dabei weiterhin bei one.com.

## 4. Exchange: Kalendernachrichten automatisch verarbeiten

Microsoft veröffentlicht für genau dieses Drittanbieter-Mail-Szenario folgende Regeln. Sie sorgen dafür, dass externe Meeting Requests im Exchange-Kalender als `Tentative` erscheinen, die weitergeleitete Exchange-Mailkopie nicht den Posteingang füllt und normale weitergeleitete E-Mail in Exchange gelöscht wird.

```powershell
Connect-ExchangeOnline

New-TransportRule -Name "Direct to Calendar" `
  -MessageTypeMatches Calendaring `
  -SetHeaderName "X-MS-Exchange-Organization-CalendarBooking-Response" `
  -SetHeaderValue Tentative

New-TransportRule -Name "Direct to Calendar triage action" `
  -MessageTypeMatches Calendaring `
  -SetHeaderName "X-MS-Exchange-Organization-CalendarBooking-TriageAction" `
  -SetHeaderValue MoveToDeletedItems

New-TransportRule -Name "Delete all except Calendaring" `
  -ExceptIfMessageTypeMatches Calendaring `
  -FromScope NotInOrganization `
  -DeleteMessage:$true
```

Nach Änderungen an Transportregeln kann die Aktivierung verzögert erfolgen. Regeln und Prioritäten anschließend im Exchange Admin Center unter **Mail flow → Rules** kontrollieren.

### Was passiert danach?

- **Normale externe E-Mail:** landet bei one.com; die zweite Kopie wird von Exchange verworfen.
- **Externe Meeting-Einladung:** bleibt als E-Mail bei one.com, wird zusätzlich von Exchange als Kalendernachricht verarbeitet und erzeugt dort das Calendar Event.
- **Accept/Tentative/Decline in M365 Calendar for Thunderbird:** findet das Exchange/Graph-Event und verwendet den normalen Graph-RSVP-Pfad.
- **Antworten externer Teilnehmer auf ein von Exchange erzeugtes Teams-Meeting:** gehen wegen des MX zunächst zu one.com, werden wieder an Exchange weitergereicht und dort als `Calendaring` verarbeitet.
- **Interne M365-Einladungen:** bleiben direkt in Exchange und funktionieren wie bisher.

Damit laufen die **Kalendersemantik und Teams-RSVPs bidirektional über Exchange**, während die normale IMAP-Mailbox bei one.com bleibt.

## 5. SPF, DKIM und DMARC

Wenn sowohl one.com als auch Microsoft 365 mit Absendern Ihrer Domain senden, muss SPF beide Systeme autorisieren. one.com nennt für diese Kombination beispielsweise:

```text
v=spf1 include:_custspf.one.com include:spf.protection.outlook.com ~all
```

Es darf nur **einen** SPF-TXT-Record für die Domain geben. Vorhandene weitere Includes müssen in denselben Record integriert werden. Zusätzlich DKIM für beide aktiven Versandplattformen prüfen und DMARC erst verschärfen, wenn SPF/DKIM in beiden Pfaden sauber funktionieren.

## 6. Empfohlener Testablauf

1. Nur einen Benutzer konfigurieren.
2. Externe normale E-Mail senden: sie muss bei one.com ankommen und darf nicht als normale Mail im Exchange-Postfach verbleiben.
3. Externe ICS-/Teams-Einladung senden: sie muss bei one.com ankommen **und** in Exchange/Graph als Termin erscheinen.
4. Einladung in Thunderbird aus der one.com-Mail akzeptieren: der vorhandene Graph-Termin muss auf `accepted` wechseln.
5. Von Microsoft 365 ein Teams-Meeting an einen externen Testaccount senden.
6. Vom externen Account akzeptieren: die Rückmeldung muss über one.com → Exchange zurücklaufen und in Graph/Teams sichtbar werden.
7. Interne Einladung zwischen zwei M365-Benutzern testen.

## 7. V2.42 Add-on-Fallback

V2.42 besitzt zusätzlich einen optionalen NATIVE-Fallback für den Fall, dass Thunderbird eine externe iMIP-Einladung aus one.com verarbeitet, **bevor** Exchange ein passendes Event besitzt. Dann wird nur eine persönliche Kalenderkopie ohne Teilnehmer in Microsoft 365 angelegt; die RSVP-Mail wird über Thunderbirds normales iMIP-Mail-Transport des empfangenden Mailaccounts gesendet.

Der Fallback verhindert insbesondere, dass eine fremde Einladung versehentlich als neues, von Ihnen organisiertes Graph-Meeting mit allen Teilnehmern erzeugt wird. Sobald der oben beschriebene serverseitige Relay funktioniert, ist der normale Graph-RSVP-Pfad weiterhin die bevorzugte Variante.

## Referenzen

- Microsoft Learn: *Connect Microsoft Teams Essentials (Microsoft Entra ID) to an existing email system with calendar* — https://learn.microsoft.com/en-us/microsoftteams/connect-teams-essentials-to-email
- Microsoft Learn: *Mail flow rule conditions and exceptions* — https://learn.microsoft.com/en-us/exchange/security-and-compliance/mail-flow-rules/conditions-and-exceptions
- one.com: *Wie leite ich E-Mails automatisch an ein anderes Konto weiter?* — https://help.one.com/hc/de/articles/360000934598
- one.com: *SPF-Records für die Aktivierung von Exchange anpassen* — https://help.one.com/hc/de/articles/10311693187985
