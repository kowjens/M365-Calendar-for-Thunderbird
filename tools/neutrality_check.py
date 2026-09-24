#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
PUBLIC_IDS={'NATIVE':'m365-calendar-for-thunderbird@3-5pe.com','STANDARD':'m365-calendar-standard@3-5pe.com'}
AUTHOR='Jens Kowalsky, 3-5 Power Electronics GmbH'
BANNED_DOMAIN = '35pwr' + '.com'
PUBLIC_REPO_BANNED_LITERALS = {
    'internal' + ' native',
    'internal' + ' standard',
    'github/' + 'internal',
    'github / ' + 'internal',
    'internal' + ' build',
    'internal' + '-build',
    'one' + '.com',
    'onecom' + '_exchange',
}
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
    if manifest.get('browser_specific_settings',{}).get('gecko',{}).get('id') != PUBLIC_IDS[variant]:
        print(f'Unexpected add-on ID in {variant}')
        sys.exit(1)
for f in ROOT.rglob('*'):
    if not f.is_file() or '.git' in f.parts or 'release' in f.parts:
        continue
    try:
        text=f.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue
    lower = text.lower()
    if BANNED_DOMAIN.lower() in lower:
        print(f'Obsolete domain reference in {f.relative_to(ROOT)}')
        sys.exit(1)
    for literal in PUBLIC_REPO_BANNED_LITERALS:
        if literal in lower:
            print(f'Private/deployment-specific public-repository reference {literal!r} in {f.relative_to(ROOT)}')
            sys.exit(1)
print('Neutral public-build check passed.')
