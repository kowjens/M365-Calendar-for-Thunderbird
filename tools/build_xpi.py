#!/usr/bin/env python3
from pathlib import Path
import argparse, json, zipfile, hashlib

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = ["manifest.json", "background.js", "calendar", "invite", "confirm", "lib", "config", "_locales", "icons"]
FIXED_TIME = (2026, 1, 1, 0, 0, 0)


def display_version(semver):
    parts = str(semver).split('.')
    if len(parts) == 3 and parts[1] == '0':
        return f"{parts[0]}.{parts[2]}"
    return str(semver)


def iter_files(src, items):
    for item in items:
        p = src / item
        if not p.exists():
            raise SystemExit(f"Missing build item: {p}")
        if p.is_file():
            yield p
        else:
            yield from (f for f in sorted(p.rglob('*')) if f.is_file())


def add_file(z, src, f):
    rel = f.relative_to(src).as_posix()
    info = zipfile.ZipInfo(rel, FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    z.writestr(info, f.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def build(variant):
    variant = variant.upper()
    src = ROOT / "source" / variant
    items = INCLUDE + (["experiments"] if variant == "NATIVE" else [])
    manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    out = ROOT / "release" / f"M365_Thunderbird_Calendar_V{display_version(manifest['version'])}_{variant}.xpi"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w") as z:
        for f in iter_files(src, items):
            add_file(z, src, f)
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        if "manifest.json" not in names:
            raise SystemExit("manifest.json is not at XPI root")
        if any(name.startswith("tests/") or name.startswith("docs/") for name in names):
            raise SystemExit("XPI contains development-only files")
    print(f"{out}  sha256={hashlib.sha256(out.read_bytes()).hexdigest()}")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument('--variant', choices=['STANDARD', 'NATIVE'])
    ap.add_argument('--all', action='store_true')
    args = ap.parse_args()
    for v in (['STANDARD', 'NATIVE'] if args.all else [args.variant or 'NATIVE']):
        build(v)
