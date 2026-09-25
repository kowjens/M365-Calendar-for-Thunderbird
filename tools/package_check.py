#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
PARTS = VERSION.split(".")
DISPLAY = f"{PARTS[0]}.{PARTS[2]}" if len(PARTS) == 3 and PARTS[1] == "0" else VERSION
PATHS = {
    "STANDARD": ROOT / "release" / f"M365_Thunderbird_Calendar_V{DISPLAY}_STANDARD.xpi",
    "NATIVE": ROOT / "release" / f"M365_Thunderbird_Calendar_V{DISPLAY}_NATIVE.xpi",
    "ATN_STANDARD": ROOT / "release" / f"M365_Thunderbird_Calendar_V{DISPLAY}_ATN_STANDARD.xpi",
}
ERRORS = []


def err(message):
    ERRORS.append(message)


for name, path in PATHS.items():
    if not path.exists():
        err(f"Missing {name}: {path.name}")
        continue
    if not zipfile.is_zipfile(path):
        err(f"{name}: not a valid ZIP/XPI")
        continue
    with zipfile.ZipFile(path) as archive:
        bad = archive.testzip()
        if bad:
            err(f"{name}: corrupt member {bad}")
        names = archive.namelist()
        if not names or "manifest.json" not in names:
            err(f"{name}: manifest.json missing at XPI root")
            continue
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("version") != VERSION:
            err(f"{name}: wrong version {manifest.get('version')}")
        if any(n.startswith(("tests/", "docs/")) for n in names):
            err(f"{name}: development files packaged")
        if any(n.endswith((".py", ".ps1", ".bat", ".cmd")) for n in names):
            err(f"{name}: build/update script packaged into XPI")
        if name in {"STANDARD", "ATN_STANDARD"}:
            if manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id") != "m365-calendar-standard@3-5pe.com":
                err(f"{name}: wrong STANDARD ID")
            if manifest.get("experiment_apis") is not None:
                err(f"{name}: experiment_apis must be absent")
            if any(n.startswith("experiments/") for n in names):
                err(f"{name}: experiments/ must be absent")
        else:
            if manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id") != "m365-calendar-for-thunderbird@3-5pe.com":
                err("NATIVE: wrong ID")
            if not manifest.get("experiment_apis", {}).get("nativeCalendar"):
                err("NATIVE: nativeCalendar missing")

if PATHS["STANDARD"].exists() and PATHS["ATN_STANDARD"].exists():
    if PATHS["STANDARD"].read_bytes() != PATHS["ATN_STANDARD"].read_bytes():
        err("STANDARD and ATN_STANDARD payloads must be byte-identical")

if ERRORS:
    print("Package validation failed:")
    for error in ERRORS:
        print(" -", error)
    sys.exit(1)

for name, path in PATHS.items():
    print(f"{name}: {path.name} sha256={hashlib.sha256(path.read_bytes()).hexdigest()}")
print("Package validation passed.")
