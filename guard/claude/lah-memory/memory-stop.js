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
 * Stop fires after every response, so a session is asked at most once per `LAH_MEMORY_INTERVAL_MS`
 * (default 30 minutes) unless HEAD moved: each request costs a full model turn. Work held back by the
 * interval is asked for on the first stop after it passes.
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
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

/** @typedef {{ fingerprint: string, head: string, askedAt: number }} SessionState */
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

/** @returns {number} LAH_MEMORY_INTERVAL_MS when it is a non-negative integer, else the default */
function interval() {
  const raw = process.env.LAH_MEMORY_INTERVAL_MS;
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_INTERVAL_MS;
}

/**
 * @param {string} root git top level
 * @returns {{ fingerprint: string, head: string, dirty: boolean }}
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
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const status = entry.slice(0, 2);
    const file = entry.slice(3);
    // with -z a rename or copy is followed by its source path, which has no status prefix
    const source = /[RC]/.test(status) ? (entries[(i += 1)] ?? "") : "";
    if (isIgnoredPath(file) && (source === "" || isIgnoredPath(source))) continue;
    dirty = true;
    let stamp = "gone";
    try {
      const stat = fs.statSync(path.join(root, file));
      stamp = `${stat.size}:${stat.mtimeMs}`;
    } catch {
      // a deleted file is fingerprinted by its name alone
    }
    hash.update(`\0${status}${file}:${stamp}\0${source}`);
  }
  return { fingerprint: hash.digest("hex"), head, dirty };
}

/** @param {unknown} value @returns {SessionState | undefined} a session's state; a bare string is the previous format */
function sessionState(value) {
  if (typeof value === "string") return { fingerprint: value, head: "", askedAt: 0 };
  if (value === null || typeof value !== "object") return undefined;
  const { fingerprint, head, askedAt } = /** @type {Record<string, unknown>} */ (value);
  if (typeof fingerprint !== "string" || typeof head !== "string" || typeof askedAt !== "number") return undefined;
  return { fingerprint, head, askedAt };
}

/** @param {string} file @returns {Record<string, unknown>} */
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

/** @param {string} dir @param {string} file @param {Record<string, unknown>} state */
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
  const { fingerprint, head, dirty } = workState(root);
  const previous = sessionState(state[sessionId]);
  const now = Date.now();

  let ask = dirty;
  if (previous !== undefined) {
    if (previous.fingerprint === fingerprint) return undefined;
    ask = previous.head !== head || now - previous.askedAt >= interval();
    // held back: keep the last request so the work is asked for once the interval passes
    if (!ask) return undefined;
  }
  delete state[sessionId];
  /** @type {SessionState} */
  const next = { fingerprint, head, askedAt: ask ? now : 0 };
  writeState(dir, file, { ...state, [sessionId]: next });
  return ask ? JSON.stringify({ decision: "block", reason: REASON }) : undefined;
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
