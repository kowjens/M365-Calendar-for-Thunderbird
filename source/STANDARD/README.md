# M365 Calendar for Thunderbird V2.43 – GITHUB_STANDARD

Microsoft 365 / Exchange Online calendar integration for Thunderbird using Microsoft Graph.

- Build mode: **STANDARD**
- Distribution: **GITHUB**
- Microsoft Entra configuration: **user/admin supplied Client ID and tenant**
- Native Thunderbird calendar provider: **no**
- Compatibility: **ESR recommended; GitHub builds are not capped with `strict_max_version`, so Monthly releases remain installable/testable**
- V2.43: cumulative release-recovery and metadata-consistency hardening; runtime retains V2.42 external-iMIP behavior and the V2.41 Thunderbird 154+/156 startup fix
- V2.40: publication hardening; validator-safe calendar CSS, fixed GitHub Actions XPI build step, and CSS regression coverage
- V2.39: ESR-first compatibility policy; Monthly releases remain usable without a GitHub manifest cap
- V2.38: standalone Settings & diagnostics page for host/update recovery
- V2.36: local-only reminder Dismiss/Snooze guard; no Graph PATCH or attendee mail for Thunderbird alarm bookkeeping
- V2.35: outgoing-message confirmation gate (enabled by default)
- V2.34: Teams join-link recovery, safe email-iTIP RSVP handling and final `3-5pe.com` public identities

See `docs/USER_GUIDE_DE.md`, `docs/USER_GUIDE_EN.md`, `docs/ADMIN_GUIDE_DE.md` and `docs/ADMIN_GUIDE_EN.md`.


## External iMIP invitation handling (introduced in V2.42)

See `docs/setup/` for Microsoft Entra registration. NATIVE additionally contains the optional external-iMIP fallback; STANDARD does not provide native iTIP interception.
