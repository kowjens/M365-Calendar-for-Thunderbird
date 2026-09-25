#!/usr/bin/env python3
from pathlib import Path
import argparse, json, zipfile, hashlib

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = ["manifest.json", "background.js", "calendar", "invite", "confirm", "options", "lib", "config", "_locales", "icons"]
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
REPOSITORY_VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def display_version(semver):
    parts = str(semver).split(".")
    if len(parts) == 3 and parts[1] == "0":
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
            yield from (f for f in sorted(p.rglob("*")) if f.is_file())


def write_bytes(z, rel, data):
    info = zipfile.ZipInfo(rel, FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def build(variant, output_suffix=None):
    variant = variant.upper()
    if variant not in {"STANDARD", "NATIVE"}:
        raise SystemExit(f"Unknown variant: {variant}")
    src = ROOT / "source" / variant
    items = INCLUDE + (["experiments"] if variant == "NATIVE" else [])
    manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("version") != REPOSITORY_VERSION:
        raise SystemExit(
            f"{variant} manifest version {manifest.get('version')!r} does not match VERSION {REPOSITORY_VERSION!r}"
        )
    suffix = output_suffix or variant
    out = ROOT / "release" / f"M365_Thunderbird_Calendar_V{display_version(manifest['version'])}_{suffix}.xpi"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w") as z:
        for f in iter_files(src, items):
            rel = f.relative_to(src).as_posix()
            write_bytes(z, rel, f.read_bytes())
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        if "manifest.json" not in names:
            raise SystemExit("manifest.json is not at XPI root")
        if any(name.startswith("tests/") or name.startswith("docs/") for name in names):
            raise SystemExit("XPI contains development-only files")
    print(f"{out}  sha256={hashlib.sha256(out.read_bytes()).hexdigest()}")
    return out


def build_atn():
    # ATN deliberately packages the STANDARD source unchanged.
    return build("STANDARD", output_suffix="ATN_STANDARD")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", choices=["STANDARD", "NATIVE"])
    ap.add_argument("--all", action="store_true", help="Build the GitHub STANDARD and NATIVE editions")
    ap.add_argument("--atn", action="store_true", help="Build the Experiment-free ATN STANDARD edition")
    args = ap.parse_args()
    if args.atn:
        build_atn()
    else:
        for v in (["STANDARD", "NATIVE"] if args.all else [args.variant or "NATIVE"]):
            build(v)
