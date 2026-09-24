# Build and validation

## Requirements

- Python 3.13 recommended (3.9+ should work for the helper scripts)
- Node.js 22+ for JavaScript syntax/regression tests
- Thunderbird for manual integration testing

No npm dependency is required to build the add-on. First-party JavaScript/HTML/CSS is shipped human-readable: there is no transpilation, minification, obfuscation, template compilation or JavaScript bundling.

## Validate

```bash
python tools/version_check.py
python tools/run_tests.py
python tools/neutrality_check.py
python tools/atn_check.py
```

## Build GitHub editions

```bash
python tools/build_xpi.py --all
```

Outputs:

- `release/M365_Thunderbird_Calendar_V2.44_STANDARD.xpi`
- `release/M365_Thunderbird_Calendar_V2.44_NATIVE.xpi`

## Build the ATN STANDARD edition

```bash
python tools/build_xpi.py --atn
```

Output:

- `release/M365_Thunderbird_Calendar_V2.44_ATN_STANDARD.xpi`

The ATN artifact is packaged from the same human-readable `source/STANDARD` files as the GitHub STANDARD artifact. The build does **not** rewrite the manifest, source code or permissions. It only creates a deterministic ZIP/XPI with fixed ZIP metadata. Consequently the STANDARD and ATN_STANDARD XPI payloads are byte-identical; only the output filename differs.

The ATN STANDARD edition contains **no `experiment_apis` entry and no `experiments/` directory**. The deeper GITHUB NATIVE edition is not submitted to ATN while new custom Experiment API submissions are paused.

## Official Thunderbird webext-linter

GitHub Actions clones the current official `thunderbird/webext-linter`, installs its pinned dependencies with `npm ci`, and runs it against the ATN_STANDARD XPI. The linter itself requires Node.js 20 or newer.

Equivalent manual check:

```bash
git clone --depth 1 https://github.com/thunderbird/webext-linter.git
cd webext-linter
npm ci
node verify.js ../M365-Calendar-for-Thunderbird/release/M365_Thunderbird_Calendar_V2.44_ATN_STANDARD.xpi
```

See `docs/COMPATIBILITY.md` and `PUBLISHING_V2.44.md`.
