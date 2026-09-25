#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
PARTS = VERSION.split(".")
DISPLAY = f"{PARTS[0]}.{PARTS[2]}" if len(PARTS) == 3 and PARTS[1] == "0" else VERSION
LABEL = f"V{DISPLAY}"
DIST = ROOT / "dist"
FIXED_TIME = (2026, 1, 1, 0, 0, 0)


def run(*args):
    print("[RUN]", " ".join(str(a) for a in args))
    subprocess.run([str(a) for a in args], cwd=ROOT, check=True)


def write_member(archive, arcname, data):
    info = zipfile.ZipInfo(arcname, FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def zip_tree(source, output, prefix="", exclude=None):
    exclude = exclude or (lambda p: False)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w") as archive:
        for path in sorted(source.rglob("*")):
            if not path.is_file() or exclude(path):
                continue
            rel = path.relative_to(source).as_posix()
            arcname = f"{prefix}/{rel}" if prefix else rel
            write_member(archive, arcname, path.read_bytes())
    return output


def repo_exclude(path):
    rel = path.relative_to(ROOT)
    if ".git" in rel.parts or "dist" in rel.parts:
        return True
    return False


def source_exclude(path):
    rel = path.relative_to(ROOT)
    if ".git" in rel.parts or "dist" in rel.parts or "release" in rel.parts:
        return True
    if path.suffix.lower() in {".xpi", ".zip"}:
        return True
    if path.name == "RELEASE_AUDIT.json":
        return True
    return False


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    run(sys.executable, ROOT / "tools" / "release_audit.py")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    standard = ROOT / "release" / f"M365_Thunderbird_Calendar_{LABEL}_STANDARD.xpi"
    native = ROOT / "release" / f"M365_Thunderbird_Calendar_{LABEL}_NATIVE.xpi"
    atn = ROOT / "release" / f"M365_Thunderbird_Calendar_{LABEL}_ATN_STANDARD.xpi"

    # GitHub-ready repository including built public XPIs.
    repo_zip = DIST / f"M365_Calendar_for_Thunderbird_{LABEL}_GitHub_Repository.zip"
    zip_tree(ROOT, repo_zip, "M365-Calendar-for-Thunderbird", repo_exclude)

    # Public source only, without build outputs.
    source_zip = DIST / f"M365_Calendar_for_Thunderbird_{LABEL}_PUBLIC_SOURCE.zip"
    zip_tree(ROOT, source_zip, f"M365_Calendar_for_Thunderbird_{LABEL}_PUBLIC_SOURCE", source_exclude)

    # Self-contained ATN source submission. No built XPI/ZIP is embedded.
    with tempfile.TemporaryDirectory(prefix="m365_atn_source_") as tmp_name:
        tmp = Path(tmp_name) / f"M365_Calendar_for_Thunderbird_{LABEL}_ATN_SOURCE"
        (tmp / "source").mkdir(parents=True)
        shutil.copytree(ROOT / "source" / "STANDARD", tmp / "source" / "STANDARD")
        (tmp / "tools").mkdir()
        shutil.copy2(ROOT / "tools" / "build_xpi.py", tmp / "tools" / "build_xpi.py")
        shutil.copy2(ROOT / "VERSION", tmp / "VERSION")
        shutil.copy2(ROOT / "LICENSE", tmp / "LICENSE")
        readme = f"""# ATN source for {LABEL}\n\nThis archive is the matching human-readable source for the ATN STANDARD XPI.\n\nRequirements:\n- Python 3.13 recommended; Python 3.9+ is sufficient for the build helper.\n- No npm packages, bundler, minifier, transpiler or obfuscator are required.\n\nBuild from this directory:\n\n    python tools/build_xpi.py --atn\n\nOutput:\n\n    release/M365_Thunderbird_Calendar_{LABEL}_ATN_STANDARD.xpi\n\nThe build script does not rewrite JavaScript, HTML, CSS, locale files or the manifest. It creates a deterministic ZIP/XPI from source/STANDARD with fixed ZIP metadata.\n"""
        (tmp / "README.md").write_text(readme, encoding="utf-8")
        atn_source_zip = DIST / f"M365_Calendar_for_Thunderbird_{LABEL}_ATN_SOURCE.zip"
        zip_tree(tmp, atn_source_zip, tmp.name)

    # Copy direct public XPIs to dist.
    for path in (standard, native, atn):
        shutil.copy2(path, DIST / path.name)

    # ATN reviewer notes extracted as a standalone file for convenience.
    reviewer = f"""# ATN reviewer notes - {LABEL}\n\n- Submission edition: STANDARD.\n- Add-on ID: m365-calendar-standard@3-5pe.com.\n- No experiment_apis manifest entry.\n- No experiments/ directory.\n- Source is readable JavaScript/HTML/CSS.\n- Python build helper only creates the deterministic XPI; it does not transpile, minify, obfuscate or rewrite source.\n- Runtime network host permissions are limited to login.microsoftonline.com and graph.microsoft.com.\n- Public Client ID and tenant defaults are empty; no client secret is used.\n- The separate GitHub NATIVE edition is not part of the ATN submission.\n"""
    reviewer_path = DIST / f"ATN_REVIEWER_NOTES_{LABEL}.md"
    reviewer_path.write_text(reviewer, encoding="utf-8")

    shutil.copy2(ROOT / "PUBLISHING.md", DIST / f"PUBLISHING_TEXTS_{LABEL}.md")
    shutil.copy2(ROOT / "RELEASE_AUDIT.json", DIST / f"PUBLIC_RELEASE_AUDIT_{LABEL}.json")

    # ATN submission convenience archive.
    atn_submission = DIST / f"M365_Calendar_for_Thunderbird_{LABEL}_ATN_SUBMISSION.zip"
    with zipfile.ZipFile(atn_submission, "w") as archive:
        for path in (DIST / atn.name, atn_source_zip, reviewer_path, DIST / f"PUBLISHING_TEXTS_{LABEL}.md"):
            write_member(archive, path.name, path.read_bytes())

    # GitHub release upload convenience archive.
    github_release = DIST / f"M365_Calendar_for_Thunderbird_{LABEL}_GitHub_RELEASE.zip"
    with zipfile.ZipFile(github_release, "w") as archive:
        for path in (DIST / standard.name, DIST / native.name, DIST / f"PUBLISHING_TEXTS_{LABEL}.md", DIST / f"PUBLIC_RELEASE_AUDIT_{LABEL}.json"):
            write_member(archive, path.name, path.read_bytes())

    artifacts = []
    for path in sorted(DIST.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS.txt":
            artifacts.append({"file": path.name, "bytes": path.stat().st_size, "sha256": sha256(path)})
    (DIST / "PUBLIC_ARTIFACTS.json").write_text(json.dumps({"version": VERSION, "display": LABEL, "artifacts": artifacts}, indent=2) + "\n", encoding="utf-8")

    checksum_lines = []
    for path in sorted(DIST.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS.txt":
            checksum_lines.append(f"{sha256(path)}  {path.name}")
    (DIST / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    print(f"Public release artifacts created in {DIST}")
