#!/usr/bin/env node
"use strict";

/**
 * Lean Agent Harness guard for Claude Code (PreToolUse hook).
 *
 * Enforces the secret and destructive-command rules of AGENTS.md: secret files are denied outright,
 * destructive shell commands go back to the user through Claude Code's own permission prompt.
 * Rules live in policy.json and the matcher in core.js (both installed beside this file, generated
 * by guard/build.js). Input it cannot read exits 2, which blocks the call: a broken guard fails closed.
 *
 * Best effort, not a sandbox: a command built through an interpreter (`python -c`) is not seen.
 */

const { createMatcher } = require("./core.js");
const policy = require("./policy.json");

const { isSecretPath, readsSecret, ruleHit } = createMatcher(policy);
// Grep reads file contents through `path` (a file) and `glob` (a file name filter).
const FILE_PATH_KEYS = ["file_path", "notebook_path", "path", "glob"];

/**
 * @param {string} toolName
 * @param {Record<string, unknown>} toolInput
 * @returns {{decision: "ask" | "deny", reason: string} | undefined}
 */
function decide(toolName, toolInput) {
  if (toolName === "Bash") {
    const command = toolInput.command;
    if (typeof command !== "string") return undefined;
    if (readsSecret(command)) {
      return { decision: "deny", reason: "This command reads a secret file: AGENTS.md forbids it." };
    }
    const hit = ruleHit(command);
    return hit ? { decision: hit.decision, reason: hit.reason } : undefined;
  }

  for (const key of FILE_PATH_KEYS) {
    const target = toolInput[key];
    if (typeof target === "string" && isSecretPath(target)) {
      return { decision: "deny", reason: `"${target}" is a secret file: AGENTS.md forbids reading, editing or writing it.` };
    }
  }
  return undefined;
}

/** @param {string} raw @returns {string} the hook's stdout */
function run(raw) {
  const event = JSON.parse(raw);
  if (typeof event !== "object" || event === null || typeof event.tool_name !== "string" || typeof event.tool_input !== "object" || event.tool_input === null) {
    throw new Error("expected {tool_name, tool_input}");
  }
  const verdict = decide(event.tool_name, event.tool_input);
  if (!verdict) return "";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: verdict.decision,
      permissionDecisionReason: verdict.reason,
    },
  });
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    process.stdout.write(run(raw));
  } catch (err) {
    process.stderr.write(`lah-guard: cannot read the hook input (${err.message}); blocking the call.\n`);
    process.exitCode = 2;
  }
});
