# Security Policy

**Maintainer:** Jens Kowalsky

## Sensitive data

Never commit:

- OAuth tokens or authorization codes
- client secrets
- tenant-specific private configuration
- Thunderbird profile data
- private calendar exports or contact data

This extension uses OAuth Authorization Code + PKCE and must not contain a Client Secret.

## Reporting

Please report security-sensitive findings privately to the repository maintainer instead of publishing exploit details in a public issue.
