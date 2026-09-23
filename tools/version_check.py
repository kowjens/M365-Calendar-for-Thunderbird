#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
VARIANTS = ("STANDARD", "NATIVE")

failed = False
print(f"Expected repository version: {EXPECTED_VERSION}", flush=True)
for variant in VARIANTS:
    manifest_path = ROOT / "source" / variant / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        rel = manifest_path.relative_to(ROOT).as_posix()
        print(f"::error file={rel}::Cannot read manifest: {exc}", flush=True)
        failed = True
        continue
    actual = manifest.get("version")
    print(f"{variant}: manifest.version={actual!r}", flush=True)
    if actual != EXPECTED_VERSION:
        rel = manifest_path.relative_to(ROOT).as_posix()
        print(
            f"::error file={rel},line=5::Version mismatch: expected {EXPECTED_VERSION}, got {actual!r}",
            flush=True,
        )
        failed = True

if failed:
    sys.exit(1)
print("Repository version sanity check passed.", flush=True)
