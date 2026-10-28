---
name: commit
description: Verifies quality gates and creates an atomic Conventional Commit. Invoke explicitly.
argument-hint: [hint]
disable-model-invocation: true
---

# commit

1. **Gates:** run the typecheck/lint/test scripts declared in the active manifest (`package.json`, `go.mod`, `Makefile`, ...). Require 0 errors and 0 new warnings; quote the summary line.
2. **Guard:** no secrets (`.env*`, `*.pem`, `*.key`) staged; no debug residue in the diff.
3. **Stage** only this task's files with `git add <files>`; never `git add .`.
4. **Message:** Conventional Commits (`feat|fix|refactor|test|docs|chore(scope): summary`), folding in the user's hint. No AI attribution lines.
5. `git commit -m "<message>"`, then delete `.tasks/current.md`.
