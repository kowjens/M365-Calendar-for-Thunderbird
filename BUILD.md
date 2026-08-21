# Build

**Author:** Jens Kowalsky

## Requirements

- Python 3.9+ for the repository build helper
- Node.js for contract/regression tests
- Thunderbird for manual integration testing

## Build both XPIs

```bash
python tools/build_xpi.py --all
```

Outputs are written to `release/`.

## Build one edition

```bash
python tools/build_xpi.py --variant STANDARD
python tools/build_xpi.py --variant NATIVE
```

## Windows / PowerShell

Each source tree also contains its original PowerShell builder:

```powershell
cd source\STANDARD
.\build_xpi.ps1

cd ..\NATIVE
.\build_xpi.ps1
```

## Run tests

```bash
python tools/run_tests.py
python tools/neutrality_check.py
```

The XPI must contain `manifest.json` at the archive root.
