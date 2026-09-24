# M365 Calendar for Thunderbird V2.43

V2.43 is a **cumulative release-recovery and metadata-consistency release** based on the V2.42 runtime. It is intended to provide one clean upgrade target after the V2.40/V2.41/V2.42 patch sequence.

## Changes

- Synchronizes all canonical release metadata to `2.0.43` / `V2.43`.
- Fixes stale V2.41 references in the GitHub build documentation and current user/admin documentation.
- Adds stricter repository version validation so stale release names and current-document version headers fail CI instead of reaching a release archive.
- Provides a cumulative recovery patch that can be applied over V2.40, V2.41, V2.42, or an already-partially-updated V2.42 repository.
- Retains the Thunderbird 154+/156 native startup compatibility introduced in V2.41.
- Retains the split-mail / external-iMIP handling introduced in V2.42.
- No intentional change to Microsoft Graph synchronization semantics compared with the V2.42 runtime.

## Compatibility

- Add-on version: `2.0.43`
- Display release: `V2.43`
- Minimum Thunderbird: `128.0`
- GitHub / INTERNAL builds: no artificial `strict_max_version`
- ATN NATIVE package: validated maximum `156.*`
