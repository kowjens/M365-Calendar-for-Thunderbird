#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
ERRORS = []


def err(message):
    ERRORS.append(message)


standard = ROOT / "source" / "STANDARD"
native = ROOT / "source" / "NATIVE"
sm = json.loads((standard / "manifest.json").read_text(encoding="utf-8"))
nm = json.loads((native / "manifest.json").read_text(encoding="utf-8"))

if sm.get("version") != VERSION:
    err(f"STANDARD version must be {VERSION}")
if nm.get("version") != VERSION:
    err(f"NATIVE version must be {VERSION}")

expected_names = {
    "STANDARD": "M365 Calendar Standard for Thunderbird",
    "NATIVE": "M365 Calendar Native for Thunderbird",
}
for label, manifest in (("STANDARD", sm), ("NATIVE", nm)):
    name = manifest.get("name", "")
    if name != expected_names[label]:
        err(f"{label}: unexpected add-on name {name!r}")
    if not name.endswith(" for Thunderbird"):
        err(f"{label}: name must end with ' for Thunderbird'")

for variant, src in (("STANDARD", standard), ("NATIVE", native)):
    for lang in ("de", "en"):
        loc = src / "_locales" / lang / "messages.json"
        data = json.loads(loc.read_text(encoding="utf-8"))
        if "extName" in data:
            err(f"{variant}: remove unused localized extName from {loc.relative_to(ROOT)}")

if sm.get("browser_specific_settings", {}).get("gecko", {}).get("id") != "m365-calendar-standard@3-5pe.com":
    err("Unexpected STANDARD/ATN add-on ID")
if sm.get("experiment_apis") is not None:
    err("ATN STANDARD must not contain experiment_apis")
if (standard / "experiments").exists():
    err("ATN STANDARD source must not contain experiments/")
if sm.get("browser_specific_settings", {}).get("gecko", {}).get("strict_max_version") is not None:
    err("ATN STANDARD must not impose strict_max_version")

if nm.get("browser_specific_settings", {}).get("gecko", {}).get("id") != "m365-calendar-for-thunderbird@3-5pe.com":
    err("Unexpected GITHUB NATIVE add-on ID")
if not nm.get("experiment_apis", {}).get("nativeCalendar"):
    err("GITHUB NATIVE must retain nativeCalendar")

allowed_hosts = {
    "https://login.microsoftonline.com/*",
    "https://graph.microsoft.com/*",
}
for label, manifest in (("STANDARD", sm), ("NATIVE", nm)):
    hosts = {p for p in manifest.get("permissions", []) if isinstance(p, str) and p.startswith("https://")}
    if hosts != allowed_hosts:
        err(f"{label}: unexpected network host permissions: {sorted(hosts)}")

for variant, src in (("STANDARD", standard), ("NATIVE", native)):
    config = (src / "config" / "build-config.js").read_text(encoding="utf-8")
    if not re.search(r'clientId:\s*""', config) or not re.search(r'tenant:\s*""', config):
        err(f"{variant}: public OAuth defaults must be empty")
    for path in src.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".js", ".html", ".json", ".css"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"\beval\s*\(|new\s+Function\s*\(", text):
            err(f"{variant}: dynamic code execution in {path.relative_to(ROOT)}")
        if re.search(r"<script[^>]+src=[\"']https?://", text, re.I):
            err(f"{variant}: remote script in {path.relative_to(ROOT)}")

if ERRORS:
    print("ATN/public preflight failed:")
    for error in ERRORS:
        print(" -", error)
    sys.exit(1)
print(f"ATN/public preflight passed ({VERSION}; ATN STANDARD has no custom Experiment API).")
