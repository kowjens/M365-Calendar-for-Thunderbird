#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
errors = []

standard = ROOT / "source" / "STANDARD"
native = ROOT / "source" / "NATIVE"
sm = json.loads((standard / "manifest.json").read_text(encoding="utf-8"))
nm = json.loads((native / "manifest.json").read_text(encoding="utf-8"))

def err(msg): errors.append(msg)

if sm.get("version") != VERSION: err(f"STANDARD version must be {VERSION}")
if sm.get("browser_specific_settings",{}).get("gecko",{}).get("id") != "m365-calendar-standard@3-5pe.com": err("Unexpected STANDARD/ATN add-on ID")
if sm.get("experiment_apis") is not None: err("ATN STANDARD must not contain experiment_apis")
if (standard / "experiments").exists(): err("ATN STANDARD source must not contain experiments/")
if sm.get("browser_specific_settings",{}).get("gecko",{}).get("strict_max_version") is not None: err("ATN STANDARD must not impose strict_max_version")
if nm.get("browser_specific_settings",{}).get("gecko",{}).get("id") != "m365-calendar-for-thunderbird@3-5pe.com": err("Unexpected GITHUB NATIVE add-on ID")
if not nm.get("experiment_apis",{}).get("nativeCalendar"): err("GITHUB NATIVE must retain nativeCalendar")

for variant, src in (("STANDARD", standard),("NATIVE", native)):
    cfg=(src/'config'/'build-config.js').read_text(encoding='utf-8')
    if not re.search(r'clientId:\s*""',cfg) or not re.search(r'tenant:\s*""',cfg): err(f"{variant}: public OAuth defaults must be empty")
    for f in src.rglob('*'):
        if not f.is_file() or f.suffix.lower() not in {'.js','.html','.json','.css'}: continue
        text=f.read_text(encoding='utf-8',errors='ignore')
        if re.search(r'\beval\s*\(|new\s+Function\s*\(',text): err(f"{variant}: dynamic code execution in {f.relative_to(ROOT)}")
        if re.search(r'<script[^>]+src=["\']https?://',text,re.I): err(f"{variant}: remote script in {f.relative_to(ROOT)}")

if errors:
    print("ATN/public preflight failed:")
    for e in errors: print(" -", e)
    sys.exit(1)
print(f"ATN/public preflight passed ({VERSION}; ATN STANDARD has no custom Experiment API).")
