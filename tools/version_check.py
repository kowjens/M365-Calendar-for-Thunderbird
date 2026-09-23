#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = ("STANDARD", "NATIVE")

failed = False

def error(path: Path, message: str, line: int | None = None) -> None:
    global failed
    rel = path.relative_to(ROOT).as_posix()
    loc = f",line={line}" if line else ""
    print(f"::error file={rel}{loc}::{message}", flush=True)
    failed = True

version_path = ROOT / "VERSION"
try:
    expected = version_path.read_text(encoding="utf-8").strip()
except Exception as exc:
    print(f"::error file=VERSION::Cannot read VERSION: {exc}", flush=True)
    sys.exit(1)

if not re.fullmatch(r"\d+\.\d+\.\d+", expected):
    error(version_path, f"Invalid VERSION value: {expected!r}", 1)

print(f"Expected repository version: {expected}", flush=True)

# package.json
package_path = ROOT / "package.json"
try:
    package_version = json.loads(package_path.read_text(encoding="utf-8")).get("version")
    print(f"package.json: version={package_version!r}", flush=True)
    if package_version != expected:
        error(package_path, f"Version mismatch: expected {expected}, got {package_version!r}", 3)
except Exception as exc:
    error(package_path, f"Cannot read package.json: {exc}")

# CITATION.cff (simple top-level version field; no YAML dependency needed)
citation_path = ROOT / "CITATION.cff"
try:
    citation_text = citation_path.read_text(encoding="utf-8")
    match = re.search(r"(?m)^version:\s*['\"]?([^'\"\s]+)", citation_text)
    citation_version = match.group(1) if match else None
    print(f"CITATION.cff: version={citation_version!r}", flush=True)
    if citation_version != expected:
        error(citation_path, f"Version mismatch: expected {expected}, got {citation_version!r}")
except Exception as exc:
    error(citation_path, f"Cannot read CITATION.cff: {exc}")

for variant in VARIANTS:
    manifest_path = ROOT / "source" / variant / "manifest.json"
    try:
        manifest_version = json.loads(manifest_path.read_text(encoding="utf-8")).get("version")
        print(f"{variant}: manifest.version={manifest_version!r}", flush=True)
        if manifest_version != expected:
            error(manifest_path, f"Version mismatch: expected {expected}, got {manifest_version!r}", 5)
    except Exception as exc:
        error(manifest_path, f"Cannot read manifest: {exc}")

    background_path = ROOT / "source" / variant / "background.js"
    try:
        background_text = background_path.read_text(encoding="utf-8")
        match = re.search(r'(?m)^const VERSION\s*=\s*["\']([^"\']+)["\'];?', background_text)
        background_version = match.group(1) if match else None
        print(f"{variant}: background VERSION={background_version!r}", flush=True)
        if background_version != expected:
            error(background_path, f"Version mismatch: expected {expected}, got {background_version!r}")
    except Exception as exc:
        error(background_path, f"Cannot read background.js: {exc}")

if failed:
    sys.exit(1)
print("Repository version sanity check passed.", flush=True)
