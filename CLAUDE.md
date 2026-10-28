# Claude Code Project Configuration

Single source of truth is defined in `AGENTS.md`. All directives, subagents, skills, and lifecycle commands apply here.

Read and adhere strictly to:
@AGENTS.md

## Fast Command Reference
- `/plan-flow <task>`: Read-only architecture analysis & ODD milestone checklist.
- `/orchestrate <task>`: Step-by-step implementation, RED-GREEN loop, and DoD validation.
- `/review [target]`: Risk-based git diff audit against SonarQube quality gates.
- `/commit [hint]`: Quality gate verification and atomic Conventional Commit.