#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
failed=False
for variant in ['STANDARD','NATIVE']:
    src=ROOT/'source'/variant
    print(f'== {variant} ==')
    for js in [src/'background.js', src/'calendar/calendar.js', src/'invite/invite.js'] + ([src/'experiments/nativeCalendar/api.js'] if variant=='NATIVE' else []):
        subprocess.run(['node','--check',str(js)],check=True)
    for test in sorted((src/'tests').glob('test_*.js')):
        r=subprocess.run(['node',str(test)])
        if r.returncode: failed=True
if failed: sys.exit(1)
print('All tests passed.')
