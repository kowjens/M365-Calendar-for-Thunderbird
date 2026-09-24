# Thunderbird compatibility policy

For production and business use, **Thunderbird ESR is recommended**. The NATIVE edition uses a Thunderbird Experiment API to integrate Microsoft 365 calendars into Thunderbird's built-in Calendar UI. Experiment APIs expose Thunderbird interfaces that may change between major releases. ESR reduces that change frequency and therefore provides the most predictable deployment target.

The Monthly channel remains a supported target. GitHub builds are **not artificially capped with `strict_max_version`**, so they can continue to be tested after a Thunderbird major update. A new Thunderbird major can still expose a real API incompatibility; in that case the add-on reports diagnostics instead of being intentionally blocked by the manifest.

| Edition | `strict_max_version` | Policy |
|---|---|---|
| NATIVE – GitHub | none | ESR recommended; Monthly supported/testable without a manifest cap |
| NATIVE – ATN | `156.*` in V2.43 | Validated ceiling required for the Experiment package submitted to addons.thunderbird.net |
| STANDARD – GitHub | none | Uses normal WebExtension APIs; no artificial maximum |

For the V2.43 ATN submission the packaged maximum is **Thunderbird 156 (`156.*`)**. This ATN-only limit does not exist in the GitHub NATIVE XPI. When a later Monthly major is confirmed compatible, the ATN compatibility ceiling can be raised independently.
