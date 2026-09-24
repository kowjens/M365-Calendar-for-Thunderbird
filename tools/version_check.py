#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
expected=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
parts=expected.split('.')
display=f"{parts[0]}.{parts[2]}" if len(parts)==3 and parts[1]=='0' else expected
label=f'V{display}'
errors=[]
def fail(path,msg): errors.append(f'{path.relative_to(ROOT)}: {msg}')

if not re.fullmatch(r'\d+\.\d+\.\d+', expected): fail(ROOT/'VERSION',f'invalid version {expected!r}')
if json.loads((ROOT/'package.json').read_text(encoding='utf-8')).get('version')!=expected: fail(ROOT/'package.json','version mismatch')
cff=(ROOT/'CITATION.cff').read_text(encoding='utf-8')
if not re.search(rf'(?m)^version:\s*["\']?{re.escape(expected)}["\']?\s*$',cff): fail(ROOT/'CITATION.cff','version mismatch')
for variant in ('STANDARD','NATIVE'):
    src=ROOT/'source'/variant
    m=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
    if m.get('version')!=expected: fail(src/'manifest.json',f'manifest version {m.get("version")!r}')
    bg=(src/'background.js').read_text(encoding='utf-8')
    if f'const VERSION = "{expected}";' not in bg: fail(src/'background.js','background VERSION mismatch')
    cal=(src/'calendar'/'calendar.js').read_text(encoding='utf-8')
    runtime=set(re.findall(r'(?<!\d)(\d+\.0\.\d+)(?!\d)',cal))
    stale=sorted(v for v in runtime if v!=expected)
    if expected not in runtime: fail(src/'calendar'/'calendar.js',f'current runtime version {expected} missing')
    if stale: fail(src/'calendar'/'calendar.js',f'stale runtime versions: {stale}')
    bv=(src/'BUILD_VARIANT.md').read_text(encoding='utf-8')
    if f'Version: {expected} / {label}' not in bv: fail(src/'BUILD_VARIANT.md','current marker missing')
    vr=(src/'README.md').read_text(encoding='utf-8').splitlines()[0]
    if label not in vr: fail(src/'README.md',f'header does not contain {label}')

checks=[
    (ROOT/'README.md',f'**Version:** {expected} / {label}'),
    (ROOT/'docs/COMPATIBILITY.md',f'For the {label} ATN submission'),
    (ROOT/'docs/README.md',f'[{label}](releases/{label}.md)'),
    (ROOT/'BUILD.md',f'release/M365_Thunderbird_Calendar_{label}_ATN_STANDARD.xpi'),
    (ROOT/f'PUBLISHING_{label}.md',f'M365_Thunderbird_Calendar_{label}_ATN_STANDARD.xpi'),
]
for p,needle in checks:
    if needle not in p.read_text(encoding='utf-8'): fail(p,f'missing current marker {needle!r}')
for name in ('USER_GUIDE_DE.md','USER_GUIDE_EN.md','ADMIN_GUIDE_DE.md','ADMIN_GUIDE_EN.md'):
    p=ROOT/'docs'/name
    first=p.read_text(encoding='utf-8').splitlines()[0]
    if label not in first: fail(p,f'header does not contain {label}')
if not (ROOT/'docs/releases'/f'{label}.md').exists(): fail(ROOT/'docs/releases',f'missing {label}.md')

# Current/public files must not contain previous current-release markers outside historical material/tests.
scan=[ROOT/'README.md',ROOT/'BUILD.md',ROOT/f'PUBLISHING_{label}.md',ROOT/'docs/COMPATIBILITY.md',ROOT/'docs/README.md']
for p in scan:
    text=p.read_text(encoding='utf-8')
    semvers=set(re.findall(r'(?<!\d)(\d+\.\d+\.\d+)(?!\d)', text))
    stale=sorted(v for v in semvers if v != expected)
    if stale: fail(p,f'stale current-release semantic version(s): {stale}')
if errors:
    print('Version validation failed:')
    for e in errors: print(' -',e)
    sys.exit(1)
print(f'Repository version validation passed: {expected} / {label}')
