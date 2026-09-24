# Thunderbird compatibility policy

For production and business use, **Thunderbird ESR is recommended**. This is especially important for GITHUB NATIVE because its custom `nativeCalendar` Experiment integrates with Thunderbird's built-in Calendar internals, which may change between major releases.

| Edition | Custom Experiment API | `strict_max_version` | Distribution |
|---|---:|---:|---|
| ATN STANDARD | No | none | addons.thunderbird.net |
| GITHUB STANDARD | No | none | GitHub |
| GITHUB NATIVE | Yes (`nativeCalendar`) | none | GitHub |

For the V2.44 ATN submission, the store artifact is **ATN STANDARD**. It intentionally contains no custom Experiment API and therefore does not provide the native Thunderbird Calendar provider. Microsoft 365 calendar functionality remains available through the add-on's Microsoft 365 Space and normal Graph-backed actions.

Users who need Microsoft 365 calendars directly inside Thunderbird's built-in Calendar view can install **GITHUB NATIVE** from the project releases. That edition provides deeper integration, but it is not submitted to ATN while new custom Experiment API submissions are paused.

The GitHub NATIVE manifest is not artificially capped with `strict_max_version`, so Monthly releases remain installable for compatibility testing. A new Thunderbird major can still expose a real Experiment/API incompatibility; ESR therefore remains the recommended production channel for NATIVE.
