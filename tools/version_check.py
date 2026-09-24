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
    try:
        rel = path.relative_to(ROOT).as_posix()
    except Exception:
        rel = str(path)
    loc = f",line={line}" if line else ""
    print(f"::error file={rel}{loc}::{message}", flush=True)
    failed = True


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def display_version(semver: str) -> str:
    parts = semver.split(".")
    if len(parts) == 3 and parts[1] == "0":
        return f"{parts[0]}.{parts[2]}"
    return semver


version_path = ROOT / "VERSION"
try:
    expected = read(version_path).strip()
except Exception as exc:
    print(f"::error file=VERSION::Cannot read VERSION: {exc}", flush=True)
    sys.exit(1)

if not re.fullmatch(r"\d+\.\d+\.\d+", expected):
    error(version_path, f"Invalid VERSION value: {expected!r}", 1)

display = display_version(expected)
release_label = f"V{display}"
print(f"Expected repository version: {expected} ({release_label})", flush=True)

# Canonical metadata.
package_path = ROOT / "package.json"
try:
    package_version = json.loads(read(package_path)).get("version")
    print(f"package.json: version={package_version!r}", flush=True)
    if package_version != expected:
        error(package_path, f"Version mismatch: expected {expected}, got {package_version!r}", 3)
except Exception as exc:
    error(package_path, f"Cannot read package.json: {exc}")

citation_path = ROOT / "CITATION.cff"
try:
    citation_text = read(citation_path)
    match = re.search(r"(?m)^version:\s*['\"]?([^'\"\s]+)", citation_text)
    citation_version = match.group(1) if match else None
    print(f"CITATION.cff: version={citation_version!r}", flush=True)
    if citation_version != expected:
        error(citation_path, f"Version mismatch: expected {expected}, got {citation_version!r}")
except Exception as exc:
    error(citation_path, f"Cannot read CITATION.cff: {exc}")

# Current repository-facing metadata. Historical changelog/release files are intentionally excluded.
current_checks = [
    (ROOT / "README.md", f"**Version:** {expected} / {release_label}", "current README version"),
    (ROOT / "docs" / "COMPATIBILITY.md", f"For the {release_label} ATN submission", "ATN compatibility release label"),
    (ROOT / "docs" / "README.md", f"[{release_label}](releases/{release_label}.md)", "documentation release index"),
]
for path, needle, what in current_checks:
    try:
        if needle not in read(path):
            error(path, f"Missing {what}: expected {needle!r}")
    except Exception as exc:
        error(path, f"Cannot validate {what}: {exc}")

for name in ("USER_GUIDE_DE.md", "USER_GUIDE_EN.md", "ADMIN_GUIDE_DE.md", "ADMIN_GUIDE_EN.md"):
    path = ROOT / "docs" / name
    try:
        first = read(path).splitlines()[0] if read(path).splitlines() else ""
        if release_label not in first:
            error(path, f"Current documentation header must contain {release_label}; got {first!r}", 1)
    except Exception as exc:
        error(path, f"Cannot validate current documentation header: {exc}")

build_doc = ROOT / "BUILD.md"
try:
    build_text = read(build_doc)
    expected_outputs = [
        f"release/M365_Thunderbird_Calendar_{release_label}_NATIVE.xpi",
        f"release/M365_Thunderbird_Calendar_{release_label}_STANDARD.xpi",
        f"release/M365_Thunderbird_Calendar_{release_label}_ATN_NATIVE.xpi",
    ]
    for out in expected_outputs:
        if out not in build_text:
            error(build_doc, f"Build documentation is stale; missing {out}")
    stale = re.findall(r"release/M365_Thunderbird_Calendar_(V\d+\.\d+)_(?:NATIVE|STANDARD|ATN_NATIVE)\.xpi", build_text)
    for label in stale:
        if label != release_label:
            error(build_doc, f"Build documentation contains stale release output {label}; expected {release_label}")
except Exception as exc:
    error(build_doc, f"Cannot validate build documentation: {exc}")

for variant in VARIANTS:
    vr = ROOT / "source" / variant
    manifest_path = vr / "manifest.json"
    try:
        manifest_version = json.loads(read(manifest_path)).get("version")
        print(f"{variant}: manifest.version={manifest_version!r}", flush=True)
        if manifest_version != expected:
            error(manifest_path, f"Version mismatch: expected {expected}, got {manifest_version!r}", 5)
    except Exception as exc:
        error(manifest_path, f"Cannot read manifest: {exc}")

    background_path = vr / "background.js"
    try:
        background_text = read(background_path)
        match = re.search(r'(?m)^const VERSION\s*=\s*["\']([^"\']+)["\'];?', background_text)
        background_version = match.group(1) if match else None
        print(f"{variant}: background VERSION={background_version!r}", flush=True)
        if background_version != expected:
            error(background_path, f"Version mismatch: expected {expected}, got {background_version!r}")
    except Exception as exc:
        error(background_path, f"Cannot read background.js: {exc}")

    # Runtime fallback strings must follow VERSION; historical release labels in comments/tests are allowed.
    calendar_path = vr / "calendar" / "calendar.js"
    try:
        cal_text = read(calendar_path)
        if expected not in cal_text:
            error(calendar_path, f"Current runtime fallback version {expected} not found")
        semvers = set(re.findall(r'(?<!\d)(\d+\.0\.\d+)(?!\d)', cal_text))
        stale_semvers = sorted(v for v in semvers if v != expected)
        if stale_semvers:
            error(calendar_path, f"Stale runtime version literal(s): {', '.join(stale_semvers)}; expected only {expected}")
    except Exception as exc:
        error(calendar_path, f"Cannot validate runtime fallback versions: {exc}")

    build_variant = vr / "BUILD_VARIANT.md"
    try:
        text = read(build_variant)
        marker = f"Version: {expected} / {release_label}"
        if marker not in text:
            error(build_variant, f"Missing current build variant marker {marker!r}")
    except Exception as exc:
        error(build_variant, f"Cannot validate BUILD_VARIANT.md: {exc}")

    variant_readme = vr / "README.md"
    try:
        first = read(variant_readme).splitlines()[0]
        if release_label not in first:
            error(variant_readme, f"Variant README header must contain {release_label}; got {first!r}", 1)
    except Exception as exc:
        error(variant_readme, f"Cannot validate variant README: {exc}")

    for name in ("USER_GUIDE_DE.md", "USER_GUIDE_EN.md", "ADMIN_GUIDE_DE.md", "ADMIN_GUIDE_EN.md"):
        path = vr / "docs" / name
        try:
            first = read(path).splitlines()[0]
            if release_label not in first:
                error(path, f"Variant documentation header must contain {release_label}; got {first!r}", 1)
        except Exception as exc:
            error(path, f"Cannot validate variant documentation header: {exc}")

    compat = vr / "docs" / "COMPATIBILITY.md"
    try:
        if f"For the {release_label} ATN submission" not in read(compat):
            error(compat, f"Variant compatibility document is not labeled for {release_label}")
    except Exception as exc:
        error(compat, f"Cannot validate variant compatibility document: {exc}")

if failed:
    sys.exit(1)
print("Repository version and release-metadata sanity check passed.", flush=True)
