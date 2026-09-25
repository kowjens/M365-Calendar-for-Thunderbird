#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
PARTS = VERSION.split(".")
DISPLAY = f"{PARTS[0]}.{PARTS[2]}" if len(PARTS) == 3 and PARTS[1] == "0" else VERSION


def run(script, *args):
    cmd = [sys.executable, str(TOOLS / script), *args]
    print("\n[RUN]", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def check_archives():
    dist = ROOT / "dist"
    if not dist.exists():
        print("\n[INFO] dist/ not present; archive-level audit skipped.")
        return
    errors = []
    for path in sorted(dist.glob("*.zip")) + sorted(dist.glob("*.xpi")):
        if not zipfile.is_zipfile(path):
            errors.append(f"{path.name}: invalid ZIP container")
            continue
        with zipfile.ZipFile(path) as archive:
            bad = archive.testzip()
            if bad:
                errors.append(f"{path.name}: corrupt member {bad}")
    if errors:
        raise SystemExit("Archive audit failed:\n - " + "\n - ".join(errors))
    print(f"\nArchive integrity passed for {len(list(dist.glob('*.zip'))) + len(list(dist.glob('*.xpi')))} artifact(s).")


def write_report():
    release = ROOT / "release"
    rows = []
    for path in sorted(release.glob("*.xpi")):
        rows.append({
            "file": path.name,
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        })
    report = {
        "version": VERSION,
        "display_version": f"V{DISPLAY}",
        "public_xpis": rows,
        "status": "PASS",
    }
    (ROOT / "RELEASE_AUDIT.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("\nWrote RELEASE_AUDIT.json")


if __name__ == "__main__":
    run("version_check.py")
    run("neutrality_check.py")
    run("atn_check.py")
    run("run_tests.py")
    run("build_xpi.py", "--all")
    run("build_xpi.py", "--atn")
    run("package_check.py")
    check_archives()
    write_report()
    print(f"\nFINAL PUBLIC RELEASE AUDIT: PASS ({VERSION} / V{DISPLAY})")
