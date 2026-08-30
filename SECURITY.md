# Security Policy

## Supported release

Security fixes are applied to the current public release. Because the NATIVE edition uses a Thunderbird Experiment API, compatibility is intentionally bounded and revalidated for new Thunderbird major versions.

## Sensitive data

Do not include OAuth tokens, authorization codes, private Thunderbird profile data, private calendar diagnostic exports or client secrets in public GitHub issues.

The add-on uses OAuth Authorization Code + PKCE and does not require a Microsoft client secret.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for this repository if it is enabled. Otherwise contact the maintainer through the GitHub profile without publishing exploit details in a public issue.
