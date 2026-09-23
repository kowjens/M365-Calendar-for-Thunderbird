#!/usr/bin/env python3
from pathlib import Path
import json, re, sys, importlib.util

ROOT=Path(__file__).resolve().parents[1]
EXPECTED={
    "NATIVE":{"id":"m365-calendar-for-thunderbird@3-5pe.com"},
    "STANDARD":{"id":"m365-calendar-standard@3-5pe.com"},
}
errors=[]
for variant,expected in EXPECTED.items():
    src=ROOT/'source'/variant
    m=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
    g=m.get('browser_specific_settings',{}).get('gecko',{})
    if m.get('version')!='2.0.40': errors.append(f'{variant}: version must be 2.0.40 (actual: {m.get("version")!r})')
    if g.get('id')!=expected['id']: errors.append(f'{variant}: unexpected public ID {g.get("id")}')
    if g.get('strict_min_version')!='128.0': errors.append(f'{variant}: strict_min_version must be 128.0')
    if g.get('strict_max_version') is not None: errors.append(f'{variant}: GitHub source manifest must not impose strict_max_version in V2.40')
    if 'sensitiveDataUpload' not in m.get('permissions',[]): errors.append(f'{variant}: sensitiveDataUpload permission missing')
    cfg=(src/'config'/'build-config.js').read_text(encoding='utf-8')
    if not re.search(r'clientId:\s*""',cfg) or not re.search(r'tenant:\s*""',cfg): errors.append(f'{variant}: public OAuth defaults must be empty')
    for css in src.rglob('*.css'):
        text=css.read_text(encoding='utf-8',errors='ignore')
        if '\\n' in text or '\\r' in text:
            errors.append(f'{variant}: literal escaped newline token in CSS: {css.relative_to(ROOT)}')
    for f in src.rglob('*'):
        if not f.is_file() or f.suffix.lower() not in {'.js','.html','.json'}: continue
        text=f.read_text(encoding='utf-8',errors='ignore')
        if 'jenskowalsky.invalid' in text: errors.append(f'{variant}: obsolete .invalid add-on ID in {f.relative_to(ROOT)}')
        if re.search(r'\beval\s*\(|new\s+Function\s*\(',text): errors.append(f'{variant}: dynamic code execution in {f.relative_to(ROOT)}')
        if re.search(r'<script[^>]+src=["\']https?://',text,re.I): errors.append(f'{variant}: remote script in {f.relative_to(ROOT)}')
spec=importlib.util.spec_from_file_location('build_xpi',ROOT/'tools'/'build_xpi.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
if mod.ATN_STRICT_MAX_VERSION!='156.*': errors.append('ATN strict max must be 156.* for V2.40 submission package')
if errors:
    print('ATN/public preflight failed:')
    for e in errors: print(' -',e)
    sys.exit(1)
print('ATN/public preflight passed (V2.40; GitHub uncapped; ATN NATIVE package at 156.*).')
