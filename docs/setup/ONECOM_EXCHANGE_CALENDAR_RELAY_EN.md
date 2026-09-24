# one.com + Exchange Online split-mail calendar relay

## Goal

Keep ordinary email mailboxes and SMTP/IMAP at **one.com**, while Microsoft 365 / Exchange Online remains authoritative for **Teams meetings, meeting requests, responses and the Microsoft calendar**.

Microsoft documents this architecture for third-party email systems: keep the existing MX, dual-deliver/forward inbound mail to Exchange Online, retain `Calendaring` messages in Exchange and delete the forwarded non-calendar mail copy.

## Recommended flow

```text
Internet -> MX one.com -> normal mailbox/Thunderbird
                  \-> copy/forward -> user@tenant.onmicrosoft.com -> Exchange Online
                                                        |-> Calendaring: process
                                                        \-> other external mail: delete by transport rule
```

Use the user's `onmicrosoft.com` alias as the forwarding destination to avoid an MX loop.

### Exchange Online

Set the custom domain to **Internal Relay** when it is shared with the third-party mail system:

```powershell
Connect-ExchangeOnline
Get-AcceptedDomain | Format-Table Name,DomainName,DomainType,Default
Set-AcceptedDomain -Identity "3-5pe.com" -DomainType InternalRelay
```

Microsoft's published third-party-mail calendar rules are:

```powershell
New-TransportRule -Name "Direct to Calendar" -MessageTypeMatches Calendaring -SetHeaderName "X-MS-Exchange-Organization-CalendarBooking-Response" -SetHeaderValue Tentative
New-TransportRule -Name "Direct to Calendar triage action" -MessageTypeMatches Calendaring -SetHeaderName "X-MS-Exchange-Organization-CalendarBooking-TriageAction" -SetHeaderValue MoveToDeletedItems
New-TransportRule -Name "Delete all except Calendaring" -ExceptIfMessageTypeMatches Calendaring -FromScope NotInOrganization -DeleteMessage:$true
```

### one.com

Configure an automatic forward for each mailbox to the corresponding `user@tenant.onmicrosoft.com` address. **Verify with a pilot account that the original message remains in the one.com mailbox.** The design requires dual delivery. If the one.com plan redirects instead of keeping a copy, use a small SMTP duplication gateway/front-end or ask one.com support for copy/dual-delivery support.

### SPF

If both one.com and Microsoft 365 send for the same domain, authorize both in one SPF record. one.com documents this combined example:

```text
v=spf1 include:_custspf.one.com include:spf.protection.outlook.com ~all
```

Also validate DKIM and DMARC for both sending paths.

## V2.42 fallback

The NATIVE edition additionally has an optional external-iMIP fallback. If an invitation reaches Thunderbird through one.com before Exchange has a matching event, the add-on creates a personal M365 calendar copy **without attendees** and allows Thunderbird's normal iMIP email transport to send the RSVP. The server-side relay remains the preferred production path.

## References

- https://learn.microsoft.com/en-us/microsoftteams/connect-teams-essentials-to-email
- https://learn.microsoft.com/en-us/exchange/security-and-compliance/mail-flow-rules/conditions-and-exceptions
- https://help.one.com/hc/en-us/articles/360000934598
- https://help.one.com/hc/en-us/articles/10311693187985
