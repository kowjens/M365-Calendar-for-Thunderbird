# M365 Calendar for Thunderbird V2.39

## ESR-first, Monthly-compatible distribution policy

V2.39 keeps Thunderbird ESR as the recommended production channel while avoiding an unnecessary monthly maintenance burden for GitHub and internal deployments.

- GitHub NATIVE no longer declares `strict_max_version`.
- INTERNAL NATIVE no longer declares `strict_max_version`.
- STANDARD remains uncapped.
- Normal Thunderbird Monthly releases therefore remain installable/testable after a major-version update instead of being blocked only by the manifest.
- ESR remains the recommended business/production channel because the NATIVE edition uses a Thunderbird Experiment API and internal calendar interfaces can change between major releases.
- A separate ATN NATIVE package is generated with `strict_max_version: 156.*`, because current ATN Experiment linting requires a maximum Thunderbird version.
- The standalone Settings & diagnostics page introduced in V2.38 remains available from Thunderbird's Add-ons Manager for diagnosing real compatibility problems after host updates.
- Microsoft Graph sync, Teams-link recovery, fail-closed RSVP handling, outgoing-message confirmation and local-only Reminder Dismiss/Snooze behavior are unchanged from V2.34–V2.38.

This release changes compatibility/distribution policy; it does not intentionally relax the fail-closed calendar safety behavior.
