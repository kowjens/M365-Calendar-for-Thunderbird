#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
PARTS = EXPECTED.split(".")
DISPLAY = f"{PARTS[0]}.{PARTS[2]}" if len(PARTS) == 3 and PARTS[1] == "0" else EXPECTED
LABEL = f"V{DISPLAY}"
ERRORS = []


def fail(path, message):
    try:
        rel = path.relative_to(ROOT)
    except ValueError:
        rel = path
    ERRORS.append(f"{rel}: {message}")


if not re.fullmatch(r"\d+\.\d+\.\d+", EXPECTED):
    fail(ROOT / "VERSION", f"invalid semantic version {EXPECTED!r}")

package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
if package.get("version") != EXPECTED:
    fail(ROOT / "package.json", "version mismatch")

cff = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(rf"(?m)^version:\s*[\"']?{re.escape(EXPECTED)}[\"']?\s*$", cff):
    fail(ROOT / "CITATION.cff", "version mismatch")

for variant in ("STANDARD", "NATIVE"):
    src = ROOT / "source" / variant
    manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != EXPECTED:
        fail(src / "manifest.json", f"manifest version {manifest.get('version')!r}")
    background = (src / "background.js").read_text(encoding="utf-8")
    if f'const VERSION = "{EXPECTED}";' not in background:
        fail(src / "background.js", "background VERSION mismatch")
    calendar = (src / "calendar" / "calendar.js").read_text(encoding="utf-8")
    runtime_versions = set(re.findall(r"(?<!\d)(\d+\.0\.\d+)(?!\d)", calendar))
    stale = sorted(v for v in runtime_versions if v != EXPECTED)
    if EXPECTED not in runtime_versions:
        fail(src / "calendar" / "calendar.js", f"current runtime version {EXPECTED} missing")
    if stale:
        fail(src / "calendar" / "calendar.js", f"stale runtime versions: {stale}")
    build_variant = (src / "BUILD_VARIANT.md").read_text(encoding="utf-8")
    if f"Version: {EXPECTED} / {LABEL}" not in build_variant:
        fail(src / "BUILD_VARIANT.md", "current version marker missing")
    first = (src / "README.md").read_text(encoding="utf-8").splitlines()[0]
    if LABEL not in first:
        fail(src / "README.md", f"header does not contain {LABEL}")

current_checks = [
    (ROOT / "README.md", f"**Version:** {EXPECTED} / {LABEL}"),
    (ROOT / "BUILD.md", f"release/M365_Thunderbird_Calendar_{LABEL}_ATN_STANDARD.xpi"),
    (ROOT / "PUBLISHING.md", LABEL),
    (ROOT / "docs" / "COMPATIBILITY.md", f"For the {LABEL} ATN submission"),
    (ROOT / "docs" / "README.md", f"[{LABEL}](releases/{LABEL}.md)"),
]
for path, needle in current_checks:
    if not path.exists():
        fail(path, "missing required current-release file")
    elif needle not in path.read_text(encoding="utf-8"):
        fail(path, f"missing current marker {needle!r}")

for name in ("USER_GUIDE_DE.md", "USER_GUIDE_EN.md", "ADMIN_GUIDE_DE.md", "ADMIN_GUIDE_EN.md"):
    path = ROOT / "docs" / name
    first = path.read_text(encoding="utf-8").splitlines()[0]
    if LABEL not in first:
        fail(path, f"header does not contain {LABEL}")

if not (ROOT / "docs" / "releases" / f"{LABEL}.md").exists():
    fail(ROOT / "docs" / "releases", f"missing {LABEL}.md")

# Files that describe the current release must not contain an older semantic version.
scan = [
    ROOT / "README.md",
    ROOT / "BUILD.md",
    ROOT / "PUBLISHING.md",
    ROOT / "docs" / "COMPATIBILITY.md",
]
for path in scan:
    text = path.read_text(encoding="utf-8")
    semvers = set(re.findall(r"(?<!\d)(\d+\.\d+\.\d+)(?!\d)", text))
    stale = sorted(v for v in semvers if v != EXPECTED)
    if stale:
        fail(path, f"stale current-release semantic version(s): {stale}")

# No stale version-numbered publishing files at repository root.
for path in ROOT.glob("PUBLISHING_V*.md"):
    fail(path, "obsolete version-numbered publishing file; use PUBLISHING.md")

if ERRORS:
    print("Version validation failed:")
    for error in ERRORS:
        print(" -", error)
    sys.exit(1)
print(f"Repository version validation passed: {EXPECTED} / {LABEL}")
