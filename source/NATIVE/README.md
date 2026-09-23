# M365 Calendar for Thunderbird V2.40 – GITHUB_NATIVE

Microsoft 365 / Exchange Online calendar integration for Thunderbird using Microsoft Graph.

- Build mode: **NATIVE**
- Distribution: **GITHUB**
- Client ID/Tenant preconfigured: **no**
- Native Thunderbird calendar provider: **yes**
- Compatibility: **ESR recommended; GitHub/INTERNAL builds are not capped with `strict_max_version`, so Monthly releases remain installable/testable**
- V2.40: publication hardening; validator-safe calendar CSS, fixed GitHub Actions XPI build step, and CSS regression coverage
- V2.39: ESR-first compatibility policy; Monthly releases remain usable without a GitHub/internal manifest cap
- V2.36: local-only reminder Dismiss/Snooze guard; no Graph PATCH or attendee mail for Thunderbird alarm bookkeeping
- V2.35: outgoing-message confirmation gate (enabled by default)
- V2.34: Teams join-link recovery, safe email-iTIP RSVP handling and final `3-5pe.com` public identities

See `docs/USER_GUIDE_DE.md`, `docs/USER_GUIDE_EN.md`, `docs/ADMIN_GUIDE_DE.md` and `docs/ADMIN_GUIDE_EN.md`.
