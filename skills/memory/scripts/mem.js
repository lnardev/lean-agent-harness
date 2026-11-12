#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * @typedef {{ topic_key: string, updated_at: string, evidence: string, body: string }} Entry
 * @typedef {import("node:sqlite").DatabaseSync} Db
 */

const USAGE = "usage: mem.js save <area-subject> --evidence <text> < body | search <terms> | context | forget <area-subject> | rebuild";
const TOPIC_KEY = /^(checkpoint|(?=.{1,80}$)[a-z0-9]+(-[a-z0-9]+)+)$/;
const MAX_EVIDENCE = 500;
const DEFAULT_BUSY_TIMEOUT_MS = 5000;
const MAX_BUSY_TIMEOUT_MS = 60000;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIR_MODE = 0o700;
const OPEN_PRIVATE = fs.constants.O_WRONLY | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW ?? 0);
const MAX_BODY_BYTES = 64 * 1024;
const STDIN_CHUNK_BYTES = 16 * 1024;
const STDIN_RETRY_MS = 10;
const STDIN_MAX_WAIT_MS = 30000;
const CONTEXT_RECENT = 10;
const SEARCH_LIMIT = 5;
const HOOK_LENGTH = 100;
const PINNED_LINES = 8;
const PINNED_LINE_LENGTH = 200;
const PINNED_KEYS = ["checkpoint", "session-summary"];
const NOT_IN_MEMORY = "not in memory";

/** Obvious secret shapes; best effort, not a guarantee. */
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{36})/,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/,
  /\bBasic\s+(?=[A-Za-z0-9+/]*[0-9=+/])[A-Za-z0-9+/]{16,}={0,2}/,
  /\bpass(?:word|wd)\s*=\s*\S+/i,
  // A secret-named variable (API_KEY, AWS_SECRET_ACCESS_KEY, GITHUB_TOKEN, ...) assigned a value that has a digit...
  /(?:api[_ -]?key|secret|token|pass(?:word|wd)|pwd|accountkey)(?:_[A-Za-z0-9]+)*\s*[=:]\s*["']?(?=[A-Za-z0-9_+/.=-]*\d)[A-Za-z0-9_+/.=-]{8,}/i,
  // ...or a quoted value of any shape, which may hold spaces (DB_PASSWORD='correct horse battery').
  /(?:api[_ -]?key|secret|token|pass(?:word|wd)|pwd|accountkey)(?:_[A-Za-z0-9]+)*\s*[=:]\s*(["'])[^"'\n]{8,}\1/i,
  /:\/\/[^\s:@/]+:[^\s@/]+@/,
];

class UserError extends Error {}

/** @param {string} text */
function out(text) {
  process.stdout.write(`${text}\n`);
}

/** @param {string} message */
function fail(message) {
  process.stderr.write(`mem: ${message}\n`);
}

/**
 * MEMORY_DIR, else `.memory/` in the nearest directory that has one or is a git root (a `.memory/` above the
 * git root is never adopted), else `.memory/` in the cwd.
 * @returns {string} the store directory
 */
function memoryDir() {
  if (process.env.MEMORY_DIR) return process.env.MEMORY_DIR;
  const start = process.cwd();
  for (let dir = start; ; dir = path.dirname(dir)) {
    const store = path.join(dir, ".memory");
    if (fs.existsSync(store) || fs.existsSync(path.join(dir, ".git"))) return store;
    if (path.dirname(dir) === dir) return path.join(start, ".memory");
  }
}

/** @returns {number} MEMORY_BUSY_TIMEOUT_MS when it is an integer within bounds, else the default */
function busyTimeout() {
  const raw = process.env.MEMORY_BUSY_TIMEOUT_MS;
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(value) && value >= 0 && value <= MAX_BUSY_TIMEOUT_MS ? value : DEFAULT_BUSY_TIMEOUT_MS;
}

/** @param {string} text @param {string} label */
function rejectSecrets(text, label) {
  const normalized = text.normalize("NFKC");
  if (SECRET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new UserError(`${label} looks like a secret; never store secrets`);
  }
}

/** @param {string} body @returns {string} first non-empty line, shortened */
function hook(body) {
  const first = body.split("\n").find((line) => line.trim() !== "") ?? "";
  return first.trim().slice(0, HOOK_LENGTH);
}

/** @param {Pick<Entry, "topic_key" | "updated_at" | "body">} entry @returns {string} */
function summaryLine(entry) {
  return `${entry.topic_key} | ${entry.updated_at.slice(0, 10)} | ${hook(entry.body)}`;
}

/** @param {Pick<Entry, "topic_key" | "updated_at" | "body">} entry @returns {string} the summary line, then the rest of the body indented and capped */
function pinnedBlock(entry) {
  const rest = entry.body
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(1, PINNED_LINES)
    .map((line) => `  ${line.trim().slice(0, PINNED_LINE_LENGTH)}`);
  return [summaryLine(entry), ...rest].join("\n");
}

/** @returns {typeof import("node:sqlite")} */
function loadSqlite() {
  try {
    return require("node:sqlite");
  } catch {
    throw new UserError("memory needs Node.js 24+ (node:sqlite is not available)");
  }
}

/** @param {string} file @returns {fs.Stats | undefined} link-aware stats, undefined when the path (or a parent) is absent */
function lstatOrUndefined(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

/** @param {string} file @throws {UserError} when the path is a symlink (even a dangling one), which a write would follow */
function assertNotSymlink(file) {
  if (lstatOrUndefined(file)?.isSymbolicLink()) {
    throw new UserError(`${path.basename(file)} is a symlink; refusing to write through it`);
  }
}

/** @param {number} fd @param {string} file @throws {UserError} when the file has other names, which a write would also change */
function assertSingleLink(fd, file) {
  if (fs.fstatSync(fd).nlink > 1) throw new UserError(`${path.basename(file)} has several hard links; refusing to write it`);
}

/** Writes without following links and without truncating a file that has other names. @param {string} file @param {string} text */
function writePrivate(file, text) {
  assertNotSymlink(file);
  const fd = fs.openSync(file, OPEN_PRIVATE, PRIVATE_FILE_MODE);
  try {
    assertSingleLink(fd, file);
    fs.fchmodSync(fd, PRIVATE_FILE_MODE);
    fs.ftruncateSync(fd);
    fs.writeSync(fd, text);
  } finally {
    fs.closeSync(fd);
  }
}

/** Creates the store directory, or takes over an existing one, as private. @param {string} dir */
function preparePrivateDir(dir) {
  const existing = lstatOrUndefined(dir);
  if (existing?.isSymbolicLink()) {
    throw new UserError(`${path.basename(dir)} is a symlink; refusing to use it as the store`);
  }
  if (existing !== undefined && !existing.isDirectory()) {
    throw new UserError(`${path.basename(dir)} is not a directory; remove it or set MEMORY_DIR`);
  }
  fs.mkdirSync(dir, { recursive: true, mode: PRIVATE_DIR_MODE });
  if (process.getuid !== undefined && fs.statSync(dir).uid !== process.getuid()) {
    throw new UserError(`${path.basename(dir)} belongs to another user`);
  }
  fs.chmodSync(dir, PRIVATE_DIR_MODE);
}

/** @param {string} dir @returns {Db} */
function openStore(dir) {
  const { DatabaseSync } = loadSqlite();
  preparePrivateDir(dir);
  const dbFile = path.join(dir, "memory.db");
  assertNotSymlink(dbFile);
  const fd = fs.openSync(dbFile, OPEN_PRIVATE, PRIVATE_FILE_MODE);
  try {
    assertSingleLink(fd, dbFile);
  } finally {
    fs.closeSync(fd);
  }
  const db = new DatabaseSync(dbFile);
  db.exec(`pragma busy_timeout = ${busyTimeout()}`);
  db.exec(
    "create table if not exists entries(topic_key text primary key, updated_at text not null, evidence text not null, body text not null);" +
      "create virtual table if not exists search using fts5(topic_key, body);",
  );
  fs.chmodSync(dbFile, PRIVATE_FILE_MODE);
  return db;
}

/** Checks every symlink target before writing any; a hard-linked file is only detected while writing. @param {string} dir @param {Db} db */
function writeMirror(dir, db) {
  const entries = /** @type {Entry[]} */ (db.prepare("select * from entries order by topic_key").all());
  const files = entries.map((entry) => ({
    file: path.join(dir, `${entry.topic_key}.md`),
    text: `# ${entry.topic_key}\nDate: ${entry.updated_at.slice(0, 10)}\nEvidence: ${entry.evidence}\n\n${entry.body}\n`,
  }));
  const lines = entries.map((entry) => `- [${entry.topic_key}](${entry.topic_key}.md) — ${hook(entry.body)}`);
  files.push({ file: path.join(dir, "index.md"), text: lines.length ? `${lines.join("\n")}\n` : "" });
  for (const { file } of files) assertNotSymlink(file);
  for (const { file, text } of files) writePrivate(file, text);
}

/** @param {string | undefined} key @returns {string} the key @throws {UserError} when it is not a valid topic key */
function topicKey(key) {
  if (key === undefined || !TOPIC_KEY.test(key)) throw new UserError("topic key must be lowercase area-subject, e.g. auth-token-expiry");
  return key;
}

/** @param {string[]} args @returns {{ key: string, evidence: string }} */
function parseSave(args) {
  const key = topicKey(args[0]);
  const flag = args.indexOf("--evidence");
  const evidence = flag === -1 ? "" : (args[flag + 1] ?? "").trim();
  if (evidence === "") throw new UserError("--evidence is required: a file path, commit hash or command output");
  if (/[\r\n]/.test(evidence) || evidence.length > MAX_EVIDENCE) {
    throw new UserError(`--evidence must be one line of at most ${MAX_EVIDENCE} characters`);
  }
  return { key, evidence };
}

/** @returns {Buffer} stdin, read in chunks: a pipe may be slow (EAGAIN) and must not be unbounded */
function readStdin() {
  /** @type {Buffer[]} */
  const chunks = [];
  const chunk = Buffer.alloc(STDIN_CHUNK_BYTES);
  const pause = new Int32Array(new SharedArrayBuffer(4));
  let total = 0;
  let waited = 0;
  for (;;) {
    let bytes;
    try {
      bytes = fs.readSync(0, chunk, 0, chunk.length, null);
    } catch (error) {
      const code = /** @type {NodeJS.ErrnoException} */ (error).code;
      if (code === "EOF") break;
      if (code !== "EAGAIN" || waited >= STDIN_MAX_WAIT_MS) throw new UserError(`cannot read the body from stdin (${code})`);
      Atomics.wait(pause, 0, 0, STDIN_RETRY_MS);
      waited += STDIN_RETRY_MS;
      continue;
    }
    if (bytes === 0) break;
    total += bytes;
    if (total > MAX_BODY_BYTES) throw new UserError(`the body is too large (max ${MAX_BODY_BYTES} bytes)`);
    chunks.push(Buffer.from(chunk.subarray(0, bytes)));
  }
  return Buffer.concat(chunks);
}

/** @returns {string} the body read from stdin */
function readBody() {
  if (process.stdin.isTTY) throw new UserError("the body must be piped through stdin");
  const body = readStdin().toString("utf8").trim();
  if (body === "") throw new UserError("the body is empty");
  return body;
}

/** @param {Db} db @param {string} key @param {string} evidence @param {string} body */
function upsert(db, key, evidence, body) {
  db.exec("begin immediate");
  try {
    db.prepare(
      "insert into entries values(?, ?, ?, ?) on conflict(topic_key) do update set updated_at = excluded.updated_at, evidence = excluded.evidence, body = excluded.body",
    ).run(key, new Date().toISOString(), evidence, body);
    db.prepare("delete from search where topic_key = ?").run(key);
    db.prepare("insert into search values(?, ?)").run(key, body);
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

/** @param {string[]} args */
function save(args) {
  const { key, evidence } = parseSave(args);
  const body = readBody();
  rejectSecrets(evidence, "evidence");
  rejectSecrets(body, "body");
  const dir = memoryDir();
  for (const name of [`${key}.md`, "index.md"]) assertNotSymlink(path.join(dir, name));
  const db = openStore(dir);
  try {
    upsert(db, key, evidence, body);
    writeMirror(dir, db);
  } finally {
    db.close();
  }
}

/** @param {(db: Db) => void} run runs only when a store exists */
function withExistingStore(run) {
  const dir = memoryDir();
  if (!fs.existsSync(path.join(dir, "memory.db"))) {
    out(NOT_IN_MEMORY);
    return;
  }
  const db = openStore(dir);
  try {
    run(db);
  } finally {
    db.close();
  }
}

/** @param {string} term @returns {string} an FTS5 phrase, so operators stay plain text */
function quoteTerm(term) {
  return `"${term.replaceAll('"', '""')}"`;
}

/** @param {string[]} terms */
function search(terms) {
  if (terms.length === 0 || terms.some((term) => term.trim() === "")) throw new UserError("search needs at least one non-empty term");
  const phrases = terms.map(quoteTerm);
  withExistingStore((db) => {
    const query = db.prepare(
      "select entries.* from search join entries on entries.topic_key = search.topic_key where search match ? order by bm25(search) limit ?",
    );
    const all = /** @type {Entry[]} */ (query.all(phrases.join(" "), SEARCH_LIMIT));
    const rows = all.length || phrases.length === 1 ? all : /** @type {Entry[]} */ (query.all(phrases.join(" OR "), SEARCH_LIMIT));
    out(rows.length ? rows.map(summaryLine).join("\n") : NOT_IN_MEMORY);
  });
}

/** @param {Db} db @param {string} key @returns {Entry | undefined} */
function entryByKey(db, key) {
  return /** @type {Entry | undefined} */ (db.prepare("select * from entries where topic_key = ?").get(key));
}

function context() {
  withExistingStore((db) => {
    const pinned = PINNED_KEYS.map((key) => entryByKey(db, key)).filter((entry) => entry !== undefined);
    const recent = /** @type {Entry[]} */ (
      db
        .prepare("select * from entries where topic_key not in (?, ?) order by updated_at desc, topic_key limit ?")
        .all(...PINNED_KEYS, CONTEXT_RECENT)
    );
    const lines = [...pinned.map(pinnedBlock), ...recent.map(summaryLine)];
    out(lines.length ? lines.join("\n") : NOT_IN_MEMORY);
  });
}

/** @param {string[]} args */
function forget(args) {
  const key = topicKey(args[0]);
  const dir = memoryDir();
  const file = path.join(dir, `${key}.md`);
  withExistingStore((db) => {
    if (entryByKey(db, key) === undefined) {
      out(NOT_IN_MEMORY);
      return;
    }
    assertNotSymlink(file);
    db.exec("begin immediate");
    try {
      db.prepare("delete from entries where topic_key = ?").run(key);
      db.prepare("delete from search where topic_key = ?").run(key);
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
    fs.rmSync(file, { force: true });
    writeMirror(dir, db);
  });
}

function rebuild() {
  const dir = memoryDir();
  withExistingStore((db) => writeMirror(dir, db));
}

/** @param {string[]} argv */
function main(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case "save":
      return save(args);
    case "search":
      return search(args);
    case "context":
      return context();
    case "forget":
      return forget(args);
    case "rebuild":
      return rebuild();
    default:
      process.exitCode = 2;
      fail(USAGE);
  }
}

/** @param {unknown} error @returns {UserError | undefined} a one-line message for expected failures, undefined for bugs */
function explain(error) {
  if (error instanceof UserError) return error;
  if (!(error instanceof Error)) return undefined;
  if (/database is locked/i.test(error.message)) return new UserError("memory is busy; retry");
  const { code, path: target } = /** @type {NodeJS.ErrnoException} */ (error);
  if (typeof code === "string" && /^E[A-Z]+$/.test(code)) return new UserError(`${code}: ${target ?? error.message}`);
  return undefined;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const known = explain(error);
  if (known === undefined) throw error;
  process.exitCode = 1;
  fail(known.message);
}
