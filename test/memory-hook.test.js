"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const HOOK = path.join(PKG_ROOT, "guard", "claude", "lah-memory", "memory-stop.js");

/** @returns {string} a fresh temp directory */
function tmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-hook-")));
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, args) {
  const res = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  assert.strictEqual(res.status, 0, `git ${args.join(" ")}: ${res.stderr}`);
}

/** @returns {string} a git repository with one commit */
function repo() {
  const dir = tmpDir();
  git(dir, ["init", "-q"]);
  fs.writeFileSync(path.join(dir, "seed.txt"), "seed");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", "seed"]);
  return dir;
}

const crypto = require("node:crypto");

/** @type {Map<string, string>} repo or directory -> the state directory its hook runs write to */
const STATE_DIRS = new Map();

/** @param {string} cwd @returns {string} the state directory the hook uses for runs in cwd (created lazily by the hook) */
function stateDir(cwd) {
  if (!STATE_DIRS.has(cwd)) STATE_DIRS.set(cwd, path.join(tmpDir(), "state"));
  return STATE_DIRS.get(cwd);
}

/** @param {string} cwd @returns {string} where the hook keeps the state of the repository at cwd */
function stateFile(cwd) {
  return path.join(stateDir(cwd), `${crypto.createHash("sha256").update(cwd).digest("hex")}.json`);
}

/**
 * Runs the Stop hook.
 * @param {string} cwd
 * @param {Record<string, unknown> | string} payload JSON body, or a raw string for malformed input
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
function stop(cwd, payload) {
  const input = typeof payload === "string" ? payload : JSON.stringify({ cwd, ...payload });
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, LAH_MEMORY_STATE_DIR: stateDir(cwd) },
  });
}

/** @param {string} stdout @returns {{ decision: string, reason: string }} */
function parseBlock(stdout) {
  return JSON.parse(stdout);
}

test("a dirty repository on the first stop blocks once and asks for a session-summary", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  const res = stop(dir, { session_id: "s1" });
  assert.strictEqual(res.status, 0);
  const out = parseBlock(res.stdout);
  assert.strictEqual(out.decision, "block");
  assert.match(out.reason, /session-summary/);
  assert.match(out.reason, /mem\.js" save session-summary/);
  assert.match(out.reason, /--evidence/);
  assert.match(out.reason, /secret/i);
});

test("the same work does not block twice in one session", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  assert.notStrictEqual(stop(dir, { session_id: "s1" }).stdout, "");
  const again = stop(dir, { session_id: "s1" });
  assert.strictEqual(again.status, 0);
  assert.strictEqual(again.stdout, "");
});

test("new work after a summary blocks again", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "one");
  stop(dir, { session_id: "s1" });
  fs.writeFileSync(path.join(dir, "work.txt"), "two");
  assert.strictEqual(parseBlock(stop(dir, { session_id: "s1" }).stdout).decision, "block");
});

test("a commit after the baseline counts as new work", () => {
  const dir = repo();
  assert.strictEqual(stop(dir, { session_id: "s1" }).stdout, "", "clean tree on the first stop only records a baseline");
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-q", "-m", "work"]);
  assert.strictEqual(parseBlock(stop(dir, { session_id: "s1" }).stdout).decision, "block");
});

test("writing the summary into .memory does not count as new work", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  stop(dir, { session_id: "s1" });
  fs.mkdirSync(path.join(dir, ".memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".memory", "session-summary.md"), "saved");
  assert.strictEqual(stop(dir, { session_id: "s1" }).stdout, "");
});

test("stop_hook_active never blocks and writes no state", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  const res = stop(dir, { session_id: "s1", stop_hook_active: true });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stdout, "");
  assert.strictEqual(fs.existsSync(stateDir(dir)), false);
});

test("sessions are tracked independently", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  stop(dir, { session_id: "s1" });
  assert.strictEqual(parseBlock(stop(dir, { session_id: "s2" }).stdout).decision, "block");
});

test("outside a git repository the hook lets the turn end", () => {
  const dir = tmpDir();
  const res = stop(dir, { session_id: "s1" });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stdout, "");
  assert.strictEqual(fs.existsSync(stateDir(dir)), false);
});

test("a corrupt state file is treated as empty and rewritten", () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  fs.mkdirSync(stateDir(dir), { recursive: true });
  fs.writeFileSync(stateFile(dir), "{not json");
  const res = stop(dir, { session_id: "s1" });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(parseBlock(res.stdout).decision, "block");
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(stateFile(dir), "utf8")));
});

test("the state directory and file are private", { skip: process.platform === "win32" }, () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  stop(dir, { session_id: "s1" });
  assert.strictEqual(fs.statSync(stateDir(dir)).mode & 0o777, 0o700);
  assert.strictEqual(fs.statSync(stateFile(dir)).mode & 0o777, 0o600);
});

test("the hook never creates anything inside the repository", () => {
  for (const dirty of [false, true]) {
    const dir = repo();
    if (dirty) fs.writeFileSync(path.join(dir, "work.txt"), "change");
    stop(dir, { session_id: "s1" });
    stop(dir, { session_id: "s1" });
    assert.strictEqual(fs.existsSync(path.join(dir, ".memory")), false, dirty ? "dirty repo" : "clean repo");
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), dirty ? [".git", "seed.txt", "work.txt"] : [".git", "seed.txt"]);
  }
});

test("repositories keep separate state even in one state directory", () => {
  const a = repo();
  const b = repo();
  fs.writeFileSync(path.join(a, "work.txt"), "change");
  fs.writeFileSync(path.join(b, "work.txt"), "change");
  const shared = path.join(tmpDir(), "state");
  const run = (cwd) => spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ cwd, session_id: "s1" }),
    encoding: "utf8",
    env: { ...process.env, LAH_MEMORY_STATE_DIR: shared },
  }).stdout;
  assert.notStrictEqual(run(a), "");
  assert.notStrictEqual(run(b), "", "the second repository is not silenced by the first");
  assert.strictEqual(run(a), "");
});

for (const [label, payload] of [
  ["empty stdin", ""],
  ["malformed JSON", "{oops"],
  ["a payload without session_id", "{}"],
]) {
  test(`${label} fails open: exit 0, no output`, () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, "work.txt"), "change");
    const res = stop(dir, payload);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stdout, "");
  });
}

const CLI = path.join(PKG_ROOT, "bin", "cli.js");
const STOP_COMMAND = 'node "$HOME/.claude/hooks/lah-memory/memory-stop.js"';
const START_COMMAND = 'node "$HOME/.claude/skills/memory/scripts/mem.js" context';

/** @param {string[]} args @param {string} home */
function runCli(args, home) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: home,
    env: { ...process.env, LAH_FAKE_HOME: home, LAH_FAKE_CWD: home },
    encoding: "utf8",
  });
}

/** @param {string} home @returns {any} */
const readSettings = (home) => JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8"));

/** @param {any} settings @param {string} event @param {string} command @returns {number} */
const entriesFor = (settings, event, command) =>
  (settings.hooks?.[event] ?? []).filter((entry) => entry.hooks.some((hook) => hook.command === command)).length;

test("--global --memory-hook deploys the Stop hook and registers SessionStart and Stop; without it nothing", () => {
  const plain = tmpDir();
  assert.strictEqual(runCli(["--global"], plain).status, 0);
  assert.strictEqual(fs.existsSync(path.join(plain, ".claude", "hooks", "lah-memory")), false);
  assert.strictEqual(fs.existsSync(path.join(plain, ".claude", "settings.json")), false);

  const home = tmpDir();
  const res = runCli(["--global", "--memory-hook"], home);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(home, ".claude", "hooks", "lah-memory", "memory-stop.js")));
  assert.ok(fs.existsSync(path.join(home, ".claude", "skills", "memory", "scripts", "mem.js")));
  const settings = readSettings(home);
  assert.strictEqual(entriesFor(settings, "Stop", STOP_COMMAND), 1);
  assert.strictEqual(entriesFor(settings, "SessionStart", START_COMMAND), 1);
});

test("--memory-hook is idempotent and keeps the guard hook of --guard", () => {
  const home = tmpDir();
  assert.strictEqual(runCli(["--global", "--guard", "--memory-hook"], home).status, 0);
  assert.strictEqual(runCli(["--global", "--guard", "--memory-hook"], home).status, 0);
  const settings = readSettings(home);
  assert.strictEqual(entriesFor(settings, "Stop", STOP_COMMAND), 1);
  assert.strictEqual(entriesFor(settings, "SessionStart", START_COMMAND), 1);
  assert.strictEqual(settings.hooks.PreToolUse.length, 1);
});

test("--memory-hook requires --global", () => {
  const dir = tmpDir();
  const res = runCli(["--memory-hook"], dir);
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /--memory-hook requiere --global/);
  assert.strictEqual(fs.existsSync(path.join(dir, ".claude")), false);
});

test("--memory-hook refuses --profile core, which omits the memory skill", () => {
  const home = tmpDir();
  const res = runCli(["--global", "--memory-hook", "--profile", "core"], home);
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /memory/);
  assert.strictEqual(fs.existsSync(path.join(home, ".claude")), false);
});

test("install.sh --global --memory-hook deploys the same files as the CLI", () => {
  const viaSh = tmpDir();
  const sh = spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--global", "--all", "--memory-hook"], {
    cwd: viaSh,
    env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT },
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 0, sh.stderr);
  const viaCli = tmpDir();
  assert.strictEqual(runCli(["--global", "--memory-hook"], viaCli).status, 0);
  const pick = (home) => ({
    settings: readSettings(home),
    stop: fs.readFileSync(path.join(home, ".claude", "hooks", "lah-memory", "memory-stop.js"), "utf8"),
  });
  assert.deepStrictEqual(pick(viaSh), pick(viaCli));
});

test("install.sh refuses --memory-hook without --global and with --profile core", () => {
  for (const args of [["--local", "--memory-hook"], ["--global", "--memory-hook", "--profile", "core"]]) {
    const dir = tmpDir();
    const sh = spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), ...args, "--all"], {
      cwd: dir,
      env: { ...process.env, HOME: dir, LAH_SOURCE: PKG_ROOT },
      encoding: "utf8",
    });
    assert.notStrictEqual(sh.status, 0, args.join(" "));
    assert.match(sh.stderr, /--memory-hook/);
  }
});

test("a .memory that is a symlink does not matter: one block, then the turn ends", { skip: process.platform === "win32" }, () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, "work.txt"), "change");
  const target = tmpDir();
  fs.symlinkSync(target, path.join(dir, ".memory"));
  assert.strictEqual(parseBlock(stop(dir, { session_id: "s1" }).stdout).decision, "block");
  assert.strictEqual(stop(dir, { session_id: "s1" }).stdout, "");
  assert.deepStrictEqual(fs.readdirSync(target), [], "nothing is written through the link");
});

test("install.sh names the flag that needs node", () => {
  for (const [flag, label] of [["--memory-hook", "--memory-hook"], ["--guard", "--guard"]]) {
    const dir = tmpDir();
    const sh = spawnSync("/bin/bash", [path.join(PKG_ROOT, "install.sh"), "--global", "--all", flag], {
      cwd: dir,
      env: { PATH: "/nonexistent", HOME: dir, LAH_SOURCE: PKG_ROOT },
      encoding: "utf8",
    });
    assert.strictEqual(sh.status, 1, flag);
    assert.match(sh.stderr, new RegExp(`^${label} necesita node`), flag);
  }
});

test("install.sh --auto --memory-hook also deploys the memory skill the hooks call", () => {
  const home = tmpDir();
  fs.mkdirSync(path.join(home, ".codex"));
  const sh = spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--global", "--auto", "--memory-hook"], {
    cwd: home,
    env: { ...process.env, HOME: home, LAH_SOURCE: PKG_ROOT },
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 0, sh.stderr);
  assert.ok(fs.existsSync(path.join(home, ".claude", "skills", "memory", "scripts", "mem.js")));
  assert.ok(fs.existsSync(path.join(home, ".claude", "hooks", "lah-memory", "memory-stop.js")));
});
