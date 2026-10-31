"use strict";

/**
 * Lean Agent Harness guard for Pi.
 *
 * Enforces the secret and destructive-command rules of AGENTS.md at the tool_call boundary:
 * secret files are denied outright, destructive shell commands need a human answer, and without a
 * UI to answer they are blocked. Rules live in policy.json (installed beside this file).
 *
 * Best effort, not a sandbox: a command built through an interpreter (`python -c`) is not seen.
 */

const path = require("node:path");

const policy = require("./policy.json");

const SEGMENT_SEPARATORS = /&&|\|\||[;|\n]/;
const FILE_TOOLS = new Set(["read", "edit", "write"]);

/**
 * @param {string} pattern glob where `*` stands for any run of characters inside one path segment
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

const secretBasenames = policy.secrets.basenames.map(globToRegExp);
const allowedBasenames = policy.secrets.except.map(globToRegExp);

/** @param {string} word @returns {string} */
function unquote(word) {
  return word.replace(/^['"]+|['"]+$/g, "");
}

/**
 * Words of one shell segment, without leading VAR=value assignments.
 * @param {string} segment
 * @returns {string[]}
 */
function wordsOf(segment) {
  const words = segment.trim().split(/\s+/).filter(Boolean).map(unquote);
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
  return words;
}

/** @param {string} command @returns {string[][]} */
function segmentsOf(command) {
  return command.split(SEGMENT_SEPARATORS).map(wordsOf).filter((words) => words.length > 0);
}

/** @param {string} filePath @returns {boolean} */
function isSecretPath(filePath) {
  const base = path.basename(filePath);
  if (allowedBasenames.some((pattern) => pattern.test(base))) return false;
  if (secretBasenames.some((pattern) => pattern.test(base))) return true;
  return filePath.split("/").some((part) => policy.secrets.directories.includes(part));
}

/** @param {string} command @returns {boolean} */
function readsSecret(command) {
  return segmentsOf(command).some(
    ([first, ...args]) => policy.secrets.readers.includes(first) && args.some(isSecretPath),
  );
}

/**
 * @param {string} command
 * @returns {{decision: "ask" | "deny", reason: string} | undefined} the first policy rule the command hits
 */
function ruleHit(command) {
  for (const words of segmentsOf(command)) {
    for (const rule of policy.shell) {
      const matchesCommand = rule.command.every((token, index) => words[index] === token);
      if (!matchesCommand) continue;
      const rest = words.slice(rule.command.length);
      if (!rule.anyOf || rest.some((word) => rule.anyOf.includes(word))) return rule;
    }
  }
  return undefined;
}

/** @param {string} reason @returns {{block: true, reason: string}} */
const block = (reason) => ({ block: true, reason });

/** @param {{on: Function}} pi */
module.exports = function lahGuard(pi) {
  pi.on("tool_call", async (event, ctx) => {
    const input = event.input || {};

    if (FILE_TOOLS.has(event.toolName)) {
      const target = input.path ?? input.file_path;
      if (typeof target === "string" && isSecretPath(target)) {
        return block(`"${target}" is a secret file: AGENTS.md forbids reading, editing or writing it.`);
      }
      return undefined;
    }

    if (event.toolName !== "bash" || typeof input.command !== "string") return undefined;

    if (readsSecret(input.command)) {
      return block("This command reads a secret file: AGENTS.md forbids it.");
    }

    const hit = ruleHit(input.command);
    if (!hit) return undefined;
    if (hit.decision === "deny") return block(hit.reason);
    if (!ctx.hasUI) return block(`${hit.reason} Blocked: no UI for confirmation.`);
    const confirmed = await ctx.ui.confirm("Confirm command", `${input.command}\n\n${hit.reason}`);
    return confirmed ? undefined : block("Blocked by the user.");
  });
};
