#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
failed = False


def run_node(args, label, file_path):
    global failed
    rel = file_path.relative_to(ROOT).as_posix()
    print(f"[RUN] {label}: {rel}", flush=True)
    result = subprocess.run(["node", *args])
    if result.returncode:
        print(f"::error file={rel}::{label} failed with exit code {result.returncode}", flush=True)
        failed = True
    else:
        print(f"[OK ] {rel}", flush=True)


for variant in ["STANDARD", "NATIVE"]:
    src = ROOT / "source" / variant
    print(f"\n== {variant} ==", flush=True)

    syntax_files = [
        src / "background.js",
        src / "calendar" / "calendar.js",
        src / "invite" / "invite.js",
    ]
    if variant == "NATIVE":
        syntax_files.append(src / "experiments" / "nativeCalendar" / "api.js")

    for js in syntax_files:
        run_node(["--check", str(js)], "syntax check", js)

    tests = sorted((src / "tests").glob("test_*.js"))
    print(f"Running {len(tests)} {variant} regression tests...", flush=True)
    for test in tests:
        run_node([str(test)], "regression test", test)

if failed:
    print("\nOne or more checks failed. See the annotated file/test above.", flush=True)
    sys.exit(1)
print("\nAll tests passed.", flush=True)
