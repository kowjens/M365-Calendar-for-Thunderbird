#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, sys, zipfile

ROOT=Path(__file__).resolve().parents[1]
VERSION=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
DISPLAY='.'.join([VERSION.split('.')[0], VERSION.split('.')[2]]) if VERSION.split('.')[1]=='0' else VERSION
paths={
    'STANDARD':ROOT/'release'/f'M365_Thunderbird_Calendar_V{DISPLAY}_STANDARD.xpi',
    'NATIVE':ROOT/'release'/f'M365_Thunderbird_Calendar_V{DISPLAY}_NATIVE.xpi',
    'ATN_STANDARD':ROOT/'release'/f'M365_Thunderbird_Calendar_V{DISPLAY}_ATN_STANDARD.xpi',
}
errors=[]
for name,p in paths.items():
    if not p.exists(): errors.append(f'Missing {name}: {p.name}'); continue
    with zipfile.ZipFile(p) as z:
        names=set(z.namelist())
        m=json.loads(z.read('manifest.json'))
        if m.get('version')!=VERSION: errors.append(f'{name}: wrong version {m.get("version")}')
        if any(n.startswith('tests/') or n.startswith('docs/') for n in names): errors.append(f'{name}: development files packaged')
        if name in {'STANDARD','ATN_STANDARD'}:
            if m.get('browser_specific_settings',{}).get('gecko',{}).get('id')!='m365-calendar-standard@3-5pe.com': errors.append(f'{name}: wrong STANDARD ID')
            if m.get('experiment_apis') is not None: errors.append(f'{name}: experiment_apis must be absent')
            if any(n.startswith('experiments/') for n in names): errors.append(f'{name}: experiments/ must be absent')
        else:
            if m.get('browser_specific_settings',{}).get('gecko',{}).get('id')!='m365-calendar-for-thunderbird@3-5pe.com': errors.append('NATIVE: wrong ID')
            if not m.get('experiment_apis',{}).get('nativeCalendar'): errors.append('NATIVE: nativeCalendar missing')
if paths['STANDARD'].exists() and paths['ATN_STANDARD'].exists() and paths['STANDARD'].read_bytes()!=paths['ATN_STANDARD'].read_bytes():
    errors.append('STANDARD and ATN_STANDARD payloads must be byte-identical in V2.44')
if errors:
    print('Package validation failed:')
    for e in errors: print(' -',e)
    sys.exit(1)
for name,p in paths.items():
    print(f'{name}: {p.name} sha256={hashlib.sha256(p.read_bytes()).hexdigest()}')
print('Package validation passed.')
