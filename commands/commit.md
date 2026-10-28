# Command: /commit [hint]

Verify final quality gates, selectively stage changes, create an atomic Conventional Commit, and clean up temporary state.

## Execution Steps
1. **Quality Gates Verification:**
   * Run compiler / typecheck (`tsc --noEmit` or native equivalent).
   * Run full test suite for the affected components.
   * Confirm terminal outputs pass cleanly with 0 errors and 0 warnings.
2. **Security & Cleanliness Guard:**
   * Verify no secrets or sensitive files (`.env`, `*.pem`, `*.key`) are staged.
   * Confirm no debug residue (`console.log`, `print`, `debugger`, debug instrumentation) remains in the diff.
3. **Selective Staging:**
   * Stage only files belonging to the completed task (`git add <files>`). Never run a blind `git add .`.
4. **Conventional Commit Construction:**
   * Formulate commit message following Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
   * Incorporate `$ARGUMENTS` (hint) into the scope or summary.
   * Never inject synthetic AI attribution lines (`Co-Authored-By: Claude`, etc.).
5. **Execute Commit:**
   * Run `git commit -m "<type>(<scope>): <summary>"`.
6. **Clean State:**
   * Remove ephemeral `.tasks/current.md` now that the slice is safely committed.