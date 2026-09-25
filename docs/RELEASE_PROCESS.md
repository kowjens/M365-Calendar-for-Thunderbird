# Release process

## Public release gate

Run from the repository root:

```bash
python tools/release_audit.py
python tools/make_public_release.py
```

`release_audit.py` validates version consistency, public/private separation, ATN policy constraints, JavaScript syntax/regression tests and the final XPI payloads.

`make_public_release.py` creates deterministic public repository/source archives and the ATN source/submission packages under `dist/`.

## Mandatory manual checks

Before publishing, compare `VERSION`, manifest versions, README, release notes and `PUBLISHING.md`; inspect the final ZIP/XPI file lists; verify that no archive marked PRIVATE/INTERNAL/DO_NOT_PUBLISH is attached to GitHub or ATN; and run the final worker audit prompt shipped with the private master release package.

## ATN

Submit only the ATN STANDARD XPI and, when the portal requests source, the matching ATN SOURCE ZIP generated from the same release. Do not submit GITHUB NATIVE or any internal package.
