#!/usr/bin/env node
"use strict";

/**
 * Lean Agent Harness memory hook for Claude Code (Stop event).
 *
 * A hook cannot write the summary: it has no model. When the work in the repository changed since the
 * last time this session was asked, it blocks the stop once and tells the agent to save a
 * `session-summary` through the memory skill. The work fingerprint is HEAD plus the path, size and
 * mtime of every changed file, ignoring `.memory/` so saving the summary is not new work.
 *
 * State lives outside the repository, in `~/.claude/hooks/lah-memory/state/<sha256 of the git root>.json`
 * (`LAH_MEMORY_STATE_DIR` relocates it), keyed by session id: the hook never writes into a project.
 * This hook is not a safety control: anything it cannot read or write lets the turn end (fail open).
 */

const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MAX_SESSIONS = 20;
const SKILL_SCRIPT = "$HOME/.claude/skills/memory/scripts/mem.js";

const REASON = [
  "Before ending, save this conversation to memory (once):",
  `node "${SKILL_SCRIPT}" save session-summary --evidence "<file path, commit hash or command output>"`,
  "with the goal, discoveries, what is done, next steps and files touched on stdin (1-5 lines).",
  "Never include secrets: .env values, tokens, keys, passwords, personal data.",
].join("\n");

/** @param {string} cwd @param {string[]} args @returns {string} */
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** @param {string} p @returns {boolean} */
function isIgnoredPath(p) {
  return p === ".memory" || p.startsWith(".memory/");
}

/**
 * @param {string} root git top level
 * @returns {{ fingerprint: string, dirty: boolean }}
 */
function workState(root) {
  let head = "none";
  try {
    head = git(root, ["rev-parse", "HEAD"]).trim();
  } catch {
    // an empty repository has no HEAD yet
  }
  const entries = git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]).split("\0").filter(Boolean);
  const hash = crypto.createHash("sha256").update(head);
  let dirty = false;
  for (const entry of entries) {
    const file = entry.slice(3);
    if (isIgnoredPath(file)) continue;
    dirty = true;
    let stamp = "gone";
    try {
      const stat = fs.statSync(path.join(root, file));
      stamp = `${stat.size}:${stat.mtimeMs}`;
    } catch {
      // a deleted file is fingerprinted by its name alone
    }
    hash.update(`\0${entry.slice(0, 2)}${file}:${stamp}`);
  }
  return { fingerprint: hash.digest("hex"), dirty };
}

/** @param {string} file @returns {Record<string, string>} */
function readState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** @returns {string} the directory holding one state file per repository */
function stateDir() {
  return process.env.LAH_MEMORY_STATE_DIR || path.join(os.homedir(), ".claude", "hooks", "lah-memory", "state");
}

/** @param {string} dir @param {string} file @param {Record<string, string>} state */
function writeState(dir, file, state) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keep = Object.fromEntries(Object.entries(state).slice(-MAX_SESSIONS));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(keep), { mode: 0o600, flag: "wx" });
  fs.renameSync(tmp, file);
}

/** @param {string} raw stdin @returns {string | undefined} the JSON to print, when the stop must be blocked */
function decide(raw) {
  const input = JSON.parse(raw);
  if (input.stop_hook_active === true) return undefined;
  const sessionId = input.session_id;
  if (typeof sessionId !== "string" || sessionId === "" || typeof input.cwd !== "string") return undefined;

  const root = git(input.cwd, ["rev-parse", "--show-toplevel"]).trim();
  const dir = stateDir();
  const file = path.join(dir, `${crypto.createHash("sha256").update(root).digest("hex")}.json`);
  const state = readState(file);
  const { fingerprint, dirty } = workState(root);

  const known = Object.hasOwn(state, sessionId);
  const changed = known ? state[sessionId] !== fingerprint : dirty;
  delete state[sessionId];
  writeState(dir, file, { ...state, [sessionId]: fingerprint });
  return changed ? JSON.stringify({ decision: "block", reason: REASON }) : undefined;
}

if (require.main === module) {
  try {
    const out = decide(fs.readFileSync(0, "utf8"));
    if (out) process.stdout.write(out);
  } catch {
    // fail open: not a git repository, unreadable input or an unwritable state file
  }
}

module.exports = { decide };
