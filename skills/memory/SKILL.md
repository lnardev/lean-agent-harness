---
name: memory
description: Persistent project memory in .memory/. Recall at session start or after compaction; save decisions, root causes and summaries with evidence.
---

# memory

Keeps context across sessions and long conversations in plain Markdown under `.memory/`. A memory entry is a claim to verify, never a fact to trust.

## Layout
* `.memory/index.md`: one line per entry, `- [topic-key](topic-key.md) — hook`.
* `.memory/<topic-key>.md`: one fact per file, updated in place by its topic key (`area-subject`, e.g. `auth-token-expiry`). Never create a second entry for the same topic.
* Search with `grep -ri <term> .memory/`.

## Recall
At session start and right after a compaction: read `index.md`, the latest `checkpoint` and only the entries relevant to the task.
* Before acting on an entry, verify it: the cited file, symbol or commit still exists (`grep`, `git log`). If the code contradicts it, the code wins: correct or delete the entry.
* If the answer is not in the index or the entries, say "not in memory" and check the code. Never guess.

## Save
Save a durable decision, a root-caused bug or a new convention the moment it is settled. Do not save raw tool output, whole conversations or anything derivable from the code.

Entry format:
```
# <topic-key>
Date: YYYY-MM-DD
Evidence: <file path, commit hash or command output>
<the fact, 1-5 lines; for decisions add Why:>
```
No `Evidence:`, no entry.

## Checkpoint and summary
When the conversation is long, before a compaction, and at the end of tracked work, write or update the `checkpoint` (end of work: `session-summary`) entry:
* Goal, discoveries, done, next steps, files touched.
* Overwrite the previous one; keep `index.md` pointing at it.

## Exclusions
Never store secrets: `.env*` values, tokens, keys, passwords, personal data. `.memory/` is personal; tell the user to add it to `.gitignore` if it is not there yet.
