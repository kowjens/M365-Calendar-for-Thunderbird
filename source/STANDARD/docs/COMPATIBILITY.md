# Thunderbird compatibility policy

M365 Calendar for Thunderbird supports both **Thunderbird ESR** and the normal **Monthly release channel**.

## Recommended channel

For production and business use, **Thunderbird ESR is recommended**. The NATIVE edition uses a Thunderbird Experiment API to integrate Microsoft 365 calendars into Thunderbird's built-in Calendar UI. Experiment APIs deliberately expose internal Thunderbird interfaces, which may change between major releases. ESR reduces that change frequency and therefore provides the most predictable deployment target.

The Monthly channel remains a supported target. GitHub and INTERNAL builds are **not artificially capped with `strict_max_version`**, so they can continue to run after a Thunderbird major update. A new Thunderbird major can still expose a real API incompatibility; in that case the add-on reports diagnostics instead of being intentionally blocked by the manifest.

## Distribution policy

| Edition / distribution | `strict_max_version` | Policy |
| --- | --- | --- |
| NATIVE – INTERNAL | none | ESR recommended; Monthly supported/testable without a manifest cap |
| NATIVE – GitHub | none | ESR recommended; Monthly supported/testable without a manifest cap |
| STANDARD – GitHub/INTERNAL | none | Uses normal WebExtension APIs; no artificial maximum |
| NATIVE – addons.thunderbird.net submission | current validated major | Thunderbird's Experiment-specific review/linter requires a maximum version for accepted Experiment-based add-ons |

For the V2.40 ATN submission the packaged maximum is **Thunderbird 156 (`156.*`)**. This ATN-only limit does not exist in the GitHub or INTERNAL NATIVE XPI. When a later Monthly major is confirmed compatible, the ATN compatibility ceiling can be raised without changing the GitHub/internal build strategy.

## Diagnostics after a Thunderbird update

If a Monthly update causes a problem, open **Add-ons and Themes → M365 Calendar for Thunderbird → Preferences/Options**. The standalone diagnostics page is independent of the M365 Space and reports the Thunderbird/add-on versions, background responsiveness, Experiment ping and native-provider state.
