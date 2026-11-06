# Exclusions

Do not report:

1. Denial of service, resource exhaustion, rate limiting, memory or CPU consumption.
2. Missing hardening or best practices with no concrete vulnerability.
3. Outdated third-party libraries, unless the project's own auditor (`npm audit`, `pip-audit`, `govulncheck`) flags them.
4. Race conditions or timing attacks that are only theoretical.
5. Regex injection, regex DoS, log spoofing, missing audit logs.
6. Path-only SSRF: it matters only if the host or protocol is controllable.
7. Findings in documentation or in test-only files.
8. Client-side missing auth checks: the server is responsible for them.
9. Memory-safety issues in memory-safe languages.

Trusted inputs:

* Environment variables and CLI flags are trusted. An attack that needs to control one is invalid.
* UUIDs are unguessable and need no validation.
* Logging non-PII data is not a finding. Logging secrets, passwords or PII is.
