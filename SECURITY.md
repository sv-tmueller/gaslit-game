# Security Policy

## Current posture

Pitfall is a static, client-side browser game deployed on Vercel. There is no
backend, no user accounts, and no user data collected today. The game does
not run any telemetry. (Aggregate, privacy-preserving analytics is a
possible future addition, not a current surface.)

Given that shape, the realistic attack surface is:

* Vulnerabilities in third-party dependencies (npm packages, build tooling).
* Hosting and deployment configuration (Vercel project settings, DNS,
  headers, secrets in the deployment pipeline).

It is not application logic operating on sensitive data, because there
isn't any today. This policy will be revised as the game grows a backend,
accounts, or user data.

## Reporting a vulnerability

The preferred way to report a security issue is through
[GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
on this repository's Security tab. This lets you share details privately
with the maintainer before anything is public.

If that option is not available to you, or your report doesn't fit that
workflow, contact the maintainer, [@sv-tmueller](https://github.com/sv-tmueller),
on GitHub.

Please do not open a public issue for a suspected vulnerability.

## What to expect

There is no dedicated security team behind this project; it's maintained
by one person. Reports will be read and triaged as soon as reasonably
possible, but there is no guaranteed response time.
