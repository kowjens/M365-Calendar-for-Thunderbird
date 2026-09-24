# Build and validation

## Requirements

- Python 3.13 recommended (3.9+ should work for the helper scripts)
- Node.js 22+ for JavaScript syntax/regression tests
- Thunderbird for manual integration testing

No npm install step and no generated/minified JavaScript are required.

## Validate

```bash
python tools/run_tests.py
python tools/neutrality_check.py
python tools/atn_check.py
```

## Build GitHub / general-use XPIs

```bash
python tools/build_xpi.py --all
```

Outputs:

- `release/M365_Thunderbird_Calendar_V2.43_NATIVE.xpi`
- `release/M365_Thunderbird_Calendar_V2.43_STANDARD.xpi`

The GitHub NATIVE package deliberately has **no `strict_max_version`**. ESR is recommended for production, but normal Thunderbird Monthly releases are not blocked by an artificial manifest ceiling.

## Build the ATN NATIVE XPI

```bash
python tools/build_xpi.py --atn
```

Output:

- `release/M365_Thunderbird_Calendar_V2.43_ATN_NATIVE.xpi`

The ATN package is built from the same NATIVE source, but the build injects `strict_max_version: 156.*` into the packaged manifest because Thunderbird's Experiment-specific review/linting requires a maximum version. A generic Firefox-oriented validator may still describe the field as unnecessary; that warning is not used to remove the Experiment cap. The source manifest itself remains uncapped so GitHub and internal/test deployments continue to work on newer Monthly releases for compatibility testing.

The build is deterministic: XPI entries are sorted and use fixed ZIP metadata. This makes reviewer/source reproduction easier.

See `docs/COMPATIBILITY.md` for the release-channel policy.
