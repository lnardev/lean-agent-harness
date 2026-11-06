---
name: security-audit
description: Static and architectural security review. Identifies injection risks, auth bypasses, trust boundary violations, and leaked secrets.
---

# Security Audit

Inspect the codebase for concrete security defects where an untrusted principal crosses a real trust boundary or abuses application logic.

## Scope

The given path, else the whole workspace. Skip `.git`, `node_modules`, `.env*`, vendored code and binaries.

## Audit Vectors

1. **Authentication & Authorization:** Missing guards on routes/handlers, broken object-level authorization (IDOR), privilege escalation, unsafe token/session handling.
2. **Input Validation & Injection:** Raw SQL/NoSQL queries, unsanitized command execution (`os/exec`, `eval`), unescaped template rendering (XSS), path traversal (`../`).
3. **Secrets & Configurations:** Hardcoded API keys, exposed `.env` values, secrets leaked in logs or error traces, weak CORS policies, insecure crypto defaults.
4. **Data Boundaries & Deserialization:** Insecure deserialization, mass assignment vulnerabilities, improper SSRF protections on external fetches.
5. **Supply Chain & Dependencies:** Known CVEs reported by the project's auditor, deprecated packages, unsafe imports.
6. **Data Exposure:** PII or secrets in logs, API responses leaking fields, debug information in production.

## Verification

Verify pass: for each candidate, re-read the code and trace the data from the untrusted source to the sensitive sink. Give it a confidence from 1 to 10 and drop anything below 8. Apply `references/exclusions.md` before reporting. Subagents may verify findings in parallel; without them, verify sequentially and say so.

## Reporting Standard

Per finding:
- **Location:** file path and line range.
- **Vulnerability:** classification and mechanism of failure.
- **Severity:** Critical, High, Medium or Low, with the concrete blast radius.
- **Exploit Scenario:** the attacker's steps from untrusted input to impact. No path, no finding.
- **Surgical Fix:** minimal diff or exact remediation.

## Output Format

A Markdown matrix, then the exploit scenarios:

| Severity | Category | File:Line | Description | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| High | Injection | `server/db.go:45` | Unsanitized query input | Use parameterized query |
