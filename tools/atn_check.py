#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "NATIVE": {"id": "m365-calendar-public@35pwr.com", "max": "154.*"},
    "STANDARD": {"id": "m365-calendar-standard@35pwr.com", "max": None},
}
errors=[]
for variant, expected in EXPECTED.items():
    src=ROOT/'source'/variant
    m=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
    g=m.get('browser_specific_settings',{}).get('gecko',{})
    if m.get('version')!='2.0.33': errors.append(f'{variant}: version must be 2.0.33')
    if g.get('id')!=expected['id']: errors.append(f'{variant}: unexpected public ID {g.get("id")}')
    if g.get('strict_min_version')!='128.0': errors.append(f'{variant}: strict_min_version must be 128.0')
    if expected['max'] and g.get('strict_max_version')!=expected['max']: errors.append(f'{variant}: strict_max_version must be {expected["max"]}')
    if 'sensitiveDataUpload' not in m.get('permissions',[]): errors.append(f'{variant}: sensitiveDataUpload permission missing')
    cfg=(src/'config'/'build-config.js').read_text(encoding='utf-8')
    if not re.search(r'clientId:\s*""',cfg) or not re.search(r'tenant:\s*""',cfg): errors.append(f'{variant}: public OAuth defaults must be empty')
    for f in src.rglob('*'):
        if not f.is_file() or f.suffix.lower() not in {'.js','.html','.json'}: continue
        text=f.read_text(encoding='utf-8',errors='ignore')
        if 'jenskowalsky.invalid' in text: errors.append(f'{variant}: obsolete .invalid add-on ID in {f.relative_to(ROOT)}')
        if re.search(r'\beval\s*\(|new\s+Function\s*\(', text): errors.append(f'{variant}: dynamic code execution in {f.relative_to(ROOT)}')
        if re.search(r'<script[^>]+src=["\']https?://', text, re.I): errors.append(f'{variant}: remote script in {f.relative_to(ROOT)}')
if errors:
    print('ATN preflight failed:')
    for e in errors: print(' -',e)
    sys.exit(1)
print('ATN preflight passed.')
