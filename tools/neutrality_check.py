#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT=Path(__file__).resolve().parents[1]
AUTHOR='Jens Kowalsky, 3-5 Power Electronics GmbH'
PUBLIC_IDS={'STANDARD':'m365-calendar-standard@3-5pe.com','NATIVE':'m365-calendar-for-thunderbird@3-5pe.com'}
errors=[]

for variant in ('STANDARD','NATIVE'):
    src=ROOT/'source'/variant
    cfg=(src/'config/build-config.js').read_text(encoding='utf-8')
    if not re.search(r'clientId:\s*""',cfg): errors.append(f'{variant}: Client ID default is not empty')
    if not re.search(r'tenant:\s*""',cfg): errors.append(f'{variant}: tenant default is not empty')
    if not re.search(r'buildFlavor:\s*"github"',cfg): errors.append(f'{variant}: unexpected public build flavor')
    m=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
    if m.get('author')!=AUTHOR: errors.append(f'{variant}: unexpected author')
    if m.get('browser_specific_settings',{}).get('gecko',{}).get('id')!=PUBLIC_IDS[variant]: errors.append(f'{variant}: unexpected add-on ID')

# Public setup documentation is intentionally limited to Microsoft Entra configuration.
setup=ROOT/'docs'/'setup'
allowed_setup={'MICROSOFT_ENTRA_SETUP_DE.md','MICROSOFT_ENTRA_SETUP_EN.md'}
actual_setup={p.name for p in setup.iterdir() if p.is_file()}
extra=sorted(actual_setup-allowed_setup)
if extra:
    errors.append('Unexpected provider/deployment-specific setup documents: '+', '.join(extra))

# No real organization mailboxes may appear in public source; only the two add-on IDs are allowed.
allowed_addon_ids=set(PUBLIC_IDS.values())
mail_re=re.compile(r'[A-Z0-9._%+-]+@3-5pe\.com',re.I)
for f in ROOT.rglob('*'):
    if not f.is_file() or '.git' in f.parts or 'release' in f.parts:
        continue
    try: text=f.read_text(encoding='utf-8')
    except (UnicodeDecodeError,OSError): continue
    for address in mail_re.findall(text):
        if address not in allowed_addon_ids:
            errors.append(f'{f.relative_to(ROOT)}: non-public organization mailbox {address}')

if errors:
    print('Public repository hygiene check failed:')
    for e in errors: print(' -',e)
    sys.exit(1)
print('Public repository hygiene check passed.')
