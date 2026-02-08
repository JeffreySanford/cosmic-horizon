# Security Policy

## Supported Versions

This repository tracks `master` as the supported development branch.

## Reporting a Vulnerability

1. Do not open public issues for exploitable vulnerabilities.
2. Email: `security@vlassportal.example` (replace with your real mailbox).
3. Include:
   - Description and impact
   - Reproduction steps
   - Affected commit/branch
   - Suggested remediation (if known)

## Response Targets

- Initial acknowledgment: within 3 business days
- Triage and severity assignment: within 7 business days
- Remediation timeline: based on severity and exploitability

## Secrets Handling

- Secrets must never be committed.
- Use `.env.example` for placeholders only.
- Enable GitHub secret scanning and push protection.
