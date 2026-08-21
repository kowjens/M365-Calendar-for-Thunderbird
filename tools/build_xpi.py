#!/usr/bin/env python3
from pathlib import Path
import argparse, json, zipfile, shutil

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = ["manifest.json","background.js","calendar","invite","lib","config","_locales","icons"]

def build(variant):
    variant = variant.upper()
    src = ROOT / "source" / variant
    if variant == "NATIVE":
        items = INCLUDE + ["experiments"]
    else:
        items = INCLUDE
    manifest = json.loads((src/"manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    out = ROOT / "release" / f"M365_Thunderbird_Calendar_V{version.replace('.', '.')}_{variant}.xpi"
    # Preserve established display version V2.19 rather than 2.0.19 in filename.
    out = ROOT / "release" / f"M365_Thunderbird_Calendar_V2.19_{variant}.xpi"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists(): out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for item in items:
            p=src/item
            if not p.exists():
                raise SystemExit(f"Missing build item: {p}")
            if p.is_file():
                z.write(p,p.relative_to(src))
            else:
                for f in sorted(p.rglob('*')):
                    if f.is_file(): z.write(f,f.relative_to(src))
    with zipfile.ZipFile(out) as z:
        if "manifest.json" not in z.namelist():
            raise SystemExit("manifest.json is not at XPI root")
    print(out)

if __name__ == "__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument('--variant', choices=['STANDARD','NATIVE'])
    ap.add_argument('--all', action='store_true')
    args=ap.parse_args()
    variants=['STANDARD','NATIVE'] if args.all else [args.variant or 'NATIVE']
    for v in variants: build(v)
