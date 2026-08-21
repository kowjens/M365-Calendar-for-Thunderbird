#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
PUBLIC_ID='m365-calendar@jenskowalsky.invalid'
AUTHOR='Jens Kowalsky'
for variant in ['STANDARD','NATIVE']:
    src=ROOT/'source'/variant
    cfg=(src/'config/build-config.js').read_text(encoding='utf-8')
    if not re.search(r'clientId:\s*""', cfg):
        print(f'Public Client ID must be empty in {variant}')
        sys.exit(1)
    if not re.search(r'tenant:\s*""', cfg):
        print(f'Public tenant must be empty in {variant}')
        sys.exit(1)
    manifest=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('author') != AUTHOR:
        print(f'Unexpected author in {variant}: {manifest.get("author")}')
        sys.exit(1)
    if manifest.get('browser_specific_settings',{}).get('gecko',{}).get('id') != PUBLIC_ID:
        print(f'Unexpected add-on ID in {variant}')
        sys.exit(1)
print('Neutral public-build check passed.')
