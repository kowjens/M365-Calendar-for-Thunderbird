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

## Build

```bash
python tools/build_xpi.py --all
```

The build is deterministic: XPI entries are sorted and use fixed ZIP metadata. This makes reviewer/source reproduction easier.

Outputs:

- `release/M365_Thunderbird_Calendar_V2.36_NATIVE.xpi`
- `release/M365_Thunderbird_Calendar_V2.36_STANDARD.xpi`

The NATIVE XPI is the package intended for addons.thunderbird.net. It contains the Thunderbird Experiment API needed for native Calendar integration.
