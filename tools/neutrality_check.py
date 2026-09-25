#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
AUTHOR = "Jens Kowalsky, 3-5 Power Electronics GmbH"
PUBLIC_IDS = {
    "STANDARD": "m365-calendar-standard@3-5pe.com",
    "NATIVE": "m365-calendar-for-thunderbird@3-5pe.com",
}
ERRORS = []


def err(message):
    ERRORS.append(message)


for variant in ("STANDARD", "NATIVE"):
    src = ROOT / "source" / variant
    config = (src / "config" / "build-config.js").read_text(encoding="utf-8")
    if not re.search(r'clientId:\s*""', config):
        err(f"{variant}: Client ID default is not empty")
    if not re.search(r'tenant:\s*""', config):
        err(f"{variant}: tenant default is not empty")
    if not re.search(r'buildFlavor:\s*"github"', config):
        err(f"{variant}: unexpected public build flavor")
    manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("author") != AUTHOR:
        err(f"{variant}: unexpected author")
    if manifest.get("browser_specific_settings", {}).get("gecko", {}).get("id") != PUBLIC_IDS[variant]:
        err(f"{variant}: unexpected add-on ID")

setup = ROOT / "docs" / "setup"
allowed_setup = {"MICROSOFT_ENTRA_SETUP_DE.md", "MICROSOFT_ENTRA_SETUP_EN.md"}
actual_setup = {p.name for p in setup.iterdir() if p.is_file()}
extra = sorted(actual_setup - allowed_setup)
if extra:
    err("Unexpected provider/deployment-specific setup documents: " + ", ".join(extra))

# Public repository must never contain private build trees or private release naming.
for path in ROOT.rglob("*"):
    rel = path.relative_to(ROOT).as_posix()
    upper = rel.upper()
    if "INTERNAL_NATIVE" in upper or "INTERNAL_STANDARD" in upper or "PRIVATE_INTERNAL" in upper:
        err(f"Private/internal path in public repository: {rel}")

allowed_addon_ids = set(PUBLIC_IDS.values())
mail_re = re.compile(r"[A-Z0-9._%+-]+@3-5pe\.com", re.I)
guid_re = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
forbidden_text = [
    (re.compile(r"one\.com", re.I), "provider-specific one.com reference"),
    (re.compile(r"35pwr\.com", re.I), "private service-domain reference"),
    (re.compile(r"sandbox:/|/mnt/data/|chatgpt", re.I), "build/chat transcript path reference"),
    (re.compile(r"\bPRIVATE_INTERNAL\b|\bINTERNAL_NATIVE\b|\bINTERNAL_STANDARD\b", re.I), "private build label"),
]

for path in ROOT.rglob("*"):
    if not path.is_file() or ".git" in path.parts or "release" in path.parts:
        continue
    if path == Path(__file__).resolve():
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    rel = path.relative_to(ROOT)
    for address in mail_re.findall(text):
        if address.lower() not in {a.lower() for a in allowed_addon_ids}:
            err(f"{rel}: non-public organization mailbox {address}")
    # Real GUIDs are not expected anywhere in public source. Entra docs use labels/placeholders.
    if guid_re.search(text):
        err(f"{rel}: GUID-like value found in public repository")
    for rx, label in forbidden_text:
        if rx.search(text):
            err(f"{rel}: {label}")

if ERRORS:
    print("Public repository hygiene check failed:")
    for error in ERRORS:
        print(" -", error)
    sys.exit(1)
print("Public repository hygiene check passed.")
