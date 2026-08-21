# Release notes — V2.19

**Author:** Jens Kowalsky

V2.19 is the first clean public GitHub repository package under the QnD by JK branding. It is based on the tested V2.19 code line and contains neutral STANDARD and NATIVE editions.

## Highlights

- Full Microsoft Graph calendar/Teams workflow.
- Optional native Thunderbird Calendar provider.
- Automatic native synchronization.
- Stable add/modify/delete cache reconciliation.
- Teams meeting actions in Thunderbird's native Calendar.
- Native M365 event editor on double-click.
- Thunderbird address-book attendee autocomplete.
- Viewport-safe dialogs with a fixed action footer and scrollable body.
- German and English administrator/user documentation.

## Public distribution changes

- Author changed to **Jens Kowalsky**.
- Public add-on ID: `m365-calendar@jenskowalsky.invalid`.
- JK logo is used for Thunderbird add-on icons.
- QnD by JK is used as repository branding.
- No private tenant, Client ID, company domain, or organization-specific configuration is included.

Because the public add-on ID differs from private/internal builds, its OAuth redirect URI also differs. Configure the exact URI shown by the installed public add-on in Microsoft Entra.
