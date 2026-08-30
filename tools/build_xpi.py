#!/usr/bin/env python3
from pathlib import Path
import argparse, json, zipfile

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = ["manifest.json","background.js","calendar","invite","lib","config","_locales","icons"]

def display_version(semver):
    parts=str(semver).split('.')
    if len(parts) == 3 and parts[1] == '0':
        return f"{parts[0]}.{parts[2]}"
    return str(semver)

def build(variant):
    variant = variant.upper()
    src = ROOT / "source" / variant
    items = INCLUDE + (["experiments"] if variant == "NATIVE" else [])
    manifest = json.loads((src/"manifest.json").read_text(encoding="utf-8"))
    out = ROOT / "release" / f"M365_Thunderbird_Calendar_V{display_version(manifest['version'])}_{variant}.xpi"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists(): out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for item in items:
            p=src/item
            if not p.exists(): raise SystemExit(f"Missing build item: {p}")
            if p.is_file(): z.write(p,p.relative_to(src).as_posix())
            else:
                for f in sorted(p.rglob('*')):
                    if f.is_file(): z.write(f,f.relative_to(src).as_posix())
    with zipfile.ZipFile(out) as z:
        if "manifest.json" not in z.namelist(): raise SystemExit("manifest.json is not at XPI root")
    print(out)

if __name__ == "__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument('--variant', choices=['STANDARD','NATIVE'])
    ap.add_argument('--all', action='store_true')
    args=ap.parse_args()
    for v in (['STANDARD','NATIVE'] if args.all else [args.variant or 'NATIVE']): build(v)
