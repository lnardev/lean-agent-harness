---
name: audit-code
description: Deep static security audit of a path or the whole workspace. Invoke explicitly.
argument-hint: [path]
disable-model-invocation: true
---

# audit-code

Scope: the given path, else the whole workspace. Skip `.git`, `node_modules`, `.env*`, vendored code, binaries.

1. Load the `security-audit` skill.
2. Scan: broken authn/authz (IDOR, missing guards), injection (SQL/NoSQL/XSS/command), hardcoded secrets, insecure deserialization, SSRF, unsanitized trust-boundary crossings, dependency CVEs.
3. Report a severity matrix (Critical/High/Med/Low) with `file:line`, failure mechanism, blast radius and the surgical fix. Every finding needs a concrete attack path; no theoretical issues.
