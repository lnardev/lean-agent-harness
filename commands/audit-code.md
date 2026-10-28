# Command: /audit-code [path]

Deep static security analysis of a directory or the entire workspace. `$ARGUMENTS` defaults to the project root.

## Execution Steps
1. **Scope:** Audit `$ARGUMENTS` (or the whole workspace if empty). Skip `.git`, `node_modules`, `.env*`, vendored code, and binary files.
2. **Load Skill:** Read `skills/security-audit/SKILL.md` before scanning.
3. **Scan Vectors:** Broken authentication/authorization (IDOR, missing guards), injection (SQL/NoSQL/XSS/command execution), secrets hardcoded in source, insecure deserialization, SSRF, unsanitized trust-boundary crossings, dependency CVEs.
4. **Report:** Severity matrix (Critical/High/Med/Low) with `file:line`, failure mechanism, blast radius, and the surgical fix. No theoretical findings — every issue must cite a concrete attack path.
