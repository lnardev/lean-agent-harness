---
name: security-audit
description: Static and architectural security review. Identifies injection risks, auth bypasses, trust boundary violations, and leaked secrets.
---

# Security Audit

Inspect the codebase for concrete security defects where an untrusted principal crosses a real trust boundary or abuses application logic.

## Audit Vectors

1. **Authentication & Authorization:** Missing guards on routes/handlers, broken object-level authorization (IDOR), privilege escalation, unsafe token/session handling.
2. **Input Validation & Injection:** Raw SQL/NoSQL queries, unsanitized command execution (`os/exec`, `eval`), unescaped template rendering (XSS), path traversal (`../`).
3. **Secrets & Configurations:** Hardcoded API keys, exposed `.env` values, secrets leaked in logs or error traces, weak CORS policies, insecure crypto defaults.
4. **Data Boundaries & Deserialization:** Insecure deserialization, mass assignment vulnerabilities, improper SSRF protections on external fetches.
5. **Supply Chain & Dependencies:** Known CVEs in dependencies, use of deprecated packages, unsafe imports.

## Reporting Standard

For each finding, provide:
- **Location:** File path and line range.
- **Vulnerability:** Clear classification and mechanism of failure.
- **Impact & Severity:** Concrete blast radius (Critical, High, Medium, Low). No theoretical risks without a valid attack path.
- **Surgical Fix:** Minimal code diff or exact remediation to restore the invariant.

## Output Format

Summarize findings in a clean Markdown matrix followed by actionable remediations:

| Severity | Category | File:Line | Description | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| High | Injection | `server/db.go:45` | Unsanitized query input | Use parameterized query |