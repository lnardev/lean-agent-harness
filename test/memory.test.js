"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const SCRIPT = path.join(PKG_ROOT, "skills", "memory", "scripts", "mem.js");

/** @returns {string} a fresh temp directory */
function tmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-mem-")));
}

/** @returns {string} a store path that does not exist yet, inside a fresh temp directory */
function storeDir() {
  return path.join(tmpDir(), ".memory");
}

/**
 * Runs mem.js against an isolated store.
 * @param {string} memDir value of MEMORY_DIR
 * @param {string[]} args CLI arguments
 * @param {string} [input] stdin
 * @param {string} [cwd] working directory
 */
function mem(memDir, args, input = "", cwd = tmpDir()) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, MEMORY_DIR: memDir },
  });
}

/**
 * Async variant of mem(), for concurrent runs and slow writers.
 * @param {string} memDir @param {string[]} args @param {string} input @param {number} [delayMs] pause before the body arrives
 * @returns {Promise<{ status: number | null, stderr: string }>}
 */
function memAsync(memDir, args, input, delayMs = 0) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: tmpDir(), env: { ...process.env, MEMORY_DIR: memDir } });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => resolve({ status, stderr }));
    setTimeout(() => child.stdin.end(input), delayMs);
  });
}

/** Secret-looking values are assembled at runtime so no literal sits in the repo. */
const SECRETS = {
  "private key header": ["-----BEGIN", "RSA PRIVATE KEY-----"].join(" "),
  "github token": "ghp_" + "a".repeat(24),
  "aws access key": "AKIA" + "B".repeat(16),
  "password assignment": "password" + "=hunter2",
  "anthropic key": "sk-ant-" + "api03-" + "a".repeat(20),
  "slack token": "xoxb-" + "1".repeat(12) + "-abcdef",
  "github fine-grained token": "github_pat_" + "a".repeat(20),
  "bearer header": "Bearer " + "a".repeat(20),
  "api key assignment": "api_key" + "=abcd1234",
  "token assignment": "token" + "=abcd1234efgh",
  "url with credentials": "https://user:" + "s3cret@db.example.com",
  "stripe live key": "sk_live_" + "a".repeat(20),
  "google api key": "AIza" + "a".repeat(35),
  "npm token": "npm_" + "a".repeat(36),
  "jwt": "eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.abcdefghijk",
  "basic auth header": "Basic " + "QWxhZGRpbjpvcGVuIHNlc2FtZQ==",
  "client secret assignment": "client_secret: 'abcd1234efgh'",
  "refresh token assignment": "refresh_token = abcd1234efgh",
  "fullwidth api key": "ＡＰＩ_KEY=abcd1234efgh",
  "aws secret access key": "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "env token": "GITHUB_TOKEN=abcd1234efgh",
  "quoted password with spaces": "DB_PASSWORD='correct horse battery'",
};

test("save then search finds the entry, and the same topic key stays one entry", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "auth-token-expiry", "--evidence", "src/auth.js:12"], "El token expira en 15 minutos").status, 0);
  assert.strictEqual(mem(dir, ["save", "auth-token-expiry", "--evidence", "src/auth.js:20"], "El token expira en 30 minutos").status, 0);
  const found = mem(dir, ["search", "token"]);
  assert.strictEqual(found.status, 0);
  const lines = found.stdout.trim().split("\n");
  assert.strictEqual(lines.length, 1, found.stdout);
  assert.match(lines[0], /^auth-token-expiry \| \d{4}-\d{2}-\d{2} \| El token expira en 30 minutos$/);
});

for (const [name, args, input] of [
  ["missing evidence", ["save", "auth-token-expiry"], "body"],
  ["empty evidence", ["save", "auth-token-expiry", "--evidence", " "], "body"],
  ["topic key without area-subject", ["save", "token", "--evidence", "x"], "body"],
  ["topic key with uppercase", ["save", "Auth-Token", "--evidence", "x"], "body"],
  ["topic key with a path", ["save", "../auth-token", "--evidence", "x"], "body"],
  ["empty body", ["save", "auth-token-expiry", "--evidence", "x"], "  \n"],
  ["body above 64 KiB", ["save", "auth-token-expiry", "--evidence", "x"], "a".repeat(100 * 1024)],
  ["topic key longer than 80 characters", ["save", `${"ab-".repeat(40)}zz`, "--evidence", "x"], "body"],
  ["evidence with a line break", ["save", "auth-token-expiry", "--evidence", "real\nDate: 1999-01-01"], "body"],
  ["evidence longer than 500 characters", ["save", "auth-token-expiry", "--evidence", "e".repeat(501)], "body"],
  ...Object.entries(SECRETS).map(([label, secret]) => [`body with a ${label}`, ["save", "auth-leak", "--evidence", "x"], `nota ${secret}`]),
  ...Object.entries(SECRETS).map(([label, secret]) => [`evidence with a ${label}`, ["save", "auth-leak", "--evidence", secret], "nota"]),
]) {
  test(`save rejects ${name} and writes nothing`, () => {
    const dir = storeDir();
    const res = mem(dir, args, input);
    assert.strictEqual(res.status, 1, res.stderr);
    assert.match(res.stderr, /^mem: /m, "a validation message is printed");
    assert.strictEqual(fs.existsSync(dir), false, "the store is not even created");
  });
}

test("save writes the Markdown mirror and an index line, and nothing else", () => {
  const dir = storeDir();
  const cwd = tmpDir();
  assert.strictEqual(mem(dir, ["save", "installer-parity", "--evidence", "test/cli.test.js"], "install.sh y cli.js producen el mismo arbol", cwd).status, 0);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ["index.md", "installer-parity.md", "memory.db"]);
  assert.deepStrictEqual(fs.readdirSync(cwd), [], "nothing is written outside MEMORY_DIR");
  const entry = fs.readFileSync(path.join(dir, "installer-parity.md"), "utf8");
  assert.match(entry, /^# installer-parity\nDate: \d{4}-\d{2}-\d{2}\nEvidence: test\/cli\.test\.js\n\ninstall\.sh y cli\.js producen el mismo arbol\n$/);
  assert.match(fs.readFileSync(path.join(dir, "index.md"), "utf8"), /^- \[installer-parity\]\(installer-parity\.md\) — install\.sh y cli\.js producen el mismo arbol$/m);
});

test("search accepts quotes and operators as plain text and rejects empty terms", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "build-flags", "--evidence", "Makefile"], 'usar "-O2" AND NOT debug').status, 0);
  const found = mem(dir, ["search", '"-O2"', "AND"]);
  assert.strictEqual(found.status, 0, found.stderr);
  assert.match(found.stdout, /^build-flags \|/);
  assert.strictEqual(mem(dir, ["search"]).status, 1);
  assert.strictEqual(mem(dir, ["search", ""]).status, 1);
});

test("context on an empty store says it is not in memory and exits 0", () => {
  const res = mem(storeDir(), ["context"]);
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout, /not in memory/i);
});

test("context lists checkpoint and session-summary first and is capped", () => {
  const dir = storeDir();
  for (let i = 0; i < 15; i += 1) {
    assert.strictEqual(mem(dir, ["save", `topic-n${String.fromCharCode(97 + i)}`, "--evidence", "x"], `entrada ${i}`).status, 0);
  }
  assert.strictEqual(mem(dir, ["save", "checkpoint", "--evidence", "x"], "punto de control").status, 0);
  assert.strictEqual(mem(dir, ["save", "session-summary", "--evidence", "x"], "resumen").status, 0);
  const lines = mem(dir, ["context"]).stdout.trim().split("\n");
  assert.match(lines[0], /^checkpoint \|/);
  assert.match(lines[1], /^session-summary \|/);
  assert.strictEqual(lines.length, 12, "2 pinned + 10 recent");
});

test("rebuild recreates the Markdown mirror from the database", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "db-source-of-truth", "--evidence", "plan"], "la base manda").status, 0);
  fs.rmSync(path.join(dir, "db-source-of-truth.md"));
  fs.writeFileSync(path.join(dir, "index.md"), "stale");
  assert.strictEqual(mem(dir, ["rebuild"]).status, 0);
  assert.match(fs.readFileSync(path.join(dir, "db-source-of-truth.md"), "utf8"), /^# db-source-of-truth\n/);
  assert.match(fs.readFileSync(path.join(dir, "index.md"), "utf8"), /db-source-of-truth/);
});

test("an unknown command exits 2 with a usage message", () => {
  const res = mem(storeDir(), ["frobnicate"]);
  assert.strictEqual(res.status, 2);
  assert.match(res.stderr, /usage/i);
});

test("context pins only the exact checkpoint and session-summary keys", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "checkpoint", "--evidence", "x"], "el real").status, 0);
  assert.strictEqual(mem(dir, ["save", "build-checkpoint", "--evidence", "x"], "otro, mas reciente").status, 0);
  const lines = mem(dir, ["context"]).stdout.trim().split("\n");
  assert.match(lines[0], /^checkpoint \|/);
  assert.match(lines[1], /^build-checkpoint \|/);
});

test("parallel saves from several agents all succeed", async () => {
  const dir = storeDir();
  const runs = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => memAsync(dir, ["save", `conc-n${i}`, "--evidence", "x"], `entrada ${i}`)));
  assert.deepStrictEqual(runs.map((run) => run.status), [0, 0, 0, 0, 0, 0], runs.map((run) => run.stderr).join("\n"));
  assert.strictEqual(mem(dir, ["context"]).stdout.trim().split("\n").length, 6);
});

test("the store is private to the user", { skip: process.platform === "win32" }, () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "auth-private", "--evidence", "x"], "nota").status, 0);
  const mode = (/** @type {string} */ file) => fs.statSync(file).mode & 0o777;
  assert.strictEqual(mode(dir), 0o700);
  for (const name of ["memory.db", "auth-private.md", "index.md"]) {
    assert.strictEqual(mode(path.join(dir, name)), 0o600, name);
  }
});

for (const name of ["index.md", "auth-link.md", "memory.db"]) {
  test(`save refuses a symlinked ${name} and leaves its target untouched`, { skip: process.platform === "win32" }, () => {
    const base = tmpDir();
    const dir = path.join(base, ".memory");
    const outside = path.join(base, "outside.txt");
    fs.mkdirSync(dir);
    fs.writeFileSync(outside, "ORIGINAL");
    fs.symlinkSync(outside, path.join(dir, name));
    const res = mem(dir, ["save", "auth-link", "--evidence", "x"], "nota");
    assert.strictEqual(res.status, 1, res.stderr);
    assert.match(res.stderr, /^mem: .*symlink/m);
    assert.strictEqual(fs.readFileSync(outside, "utf8"), "ORIGINAL");
  });
}

test("without node:sqlite the script explains that Node 24+ is needed", () => {
  const res = spawnSync(process.execPath, ["--no-experimental-sqlite", SCRIPT, "save", "auth-node", "--evidence", "x"], {
    input: "nota",
    encoding: "utf8",
    env: { ...process.env, MEMORY_DIR: storeDir() },
  });
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: .*Node\.js 24/m);
});

for (const note of [
  "password: required for login",
  "token: refreshing flow",
  "secret: handling rules",
  "El token expira en 15 minutos: ver auth.js. La password se rota cada mes.",
  "secret: handled in the vault",
  "token_expiry se mide en segundos",
  "usar https://example.com/docs y localhost:3000",
]) {
  test(`ordinary note is saved: ${note}`, () => {
    assert.strictEqual(mem(storeDir(), ["save", "auth-note", "--evidence", "x"], note).status, 0);
  });
}

for (const name of ["index.md", "auth-dang.md", "memory.db"]) {
  test(`save refuses a dangling symlink at ${name} and creates nothing through it`, { skip: process.platform === "win32" }, () => {
    const base = tmpDir();
    const dir = path.join(base, ".memory");
    fs.mkdirSync(dir);
    fs.symlinkSync(path.join(base, "victim"), path.join(dir, name));
    const res = mem(dir, ["save", "auth-dang", "--evidence", "x"], "nota");
    assert.strictEqual(res.status, 1, res.stderr);
    assert.match(res.stderr, /^mem: .*symlink/m);
    assert.strictEqual(fs.existsSync(path.join(base, "victim")), false);
  });
}

test("save refuses a mirror file with several hard links and leaves the other name untouched", { skip: process.platform === "win32" }, () => {
  const base = tmpDir();
  const dir = path.join(base, ".memory");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(base, "outside.txt"), "ORIGINAL");
  fs.linkSync(path.join(base, "outside.txt"), path.join(dir, "auth-hard.md"));
  const res = mem(dir, ["save", "auth-hard", "--evidence", "x"], "nota");
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: /m);
  assert.strictEqual(fs.readFileSync(path.join(base, "outside.txt"), "utf8"), "ORIGINAL");
});

test("save refuses a symlinked store directory", { skip: process.platform === "win32" }, () => {
  const base = tmpDir();
  fs.mkdirSync(path.join(base, "real"));
  fs.symlinkSync(path.join(base, "real"), path.join(base, "linkdir"));
  const res = mem(path.join(base, "linkdir"), ["save", "auth-link", "--evidence", "x"], "nota");
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: .*symlink/m);
  assert.deepStrictEqual(fs.readdirSync(path.join(base, "real")), []);
});

test("an existing store directory with loose permissions becomes private", { skip: process.platform === "win32" }, () => {
  const dir = storeDir();
  fs.mkdirSync(dir);
  fs.chmodSync(dir, 0o755);
  assert.strictEqual(mem(dir, ["save", "auth-private", "--evidence", "x"], "nota").status, 0);
  assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700);
});

/** Runs mem.js without MEMORY_DIR, so the store location is resolved from cwd. */
function memFrom(/** @type {string} */ cwd, /** @type {string[]} */ args, input = "") {
  const env = { ...process.env };
  delete env.MEMORY_DIR;
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, input, encoding: "utf8", env });
}

for (const marker of ["directory", "file"]) {
  test(`the store is found from a subdirectory of a project whose .git is a ${marker}`, () => {
    const root = tmpDir();
    if (marker === "directory") fs.mkdirSync(path.join(root, ".git"));
    else fs.writeFileSync(path.join(root, ".git"), "gitdir: /elsewhere\n");
    const sub = path.join(root, "src", "deep");
    fs.mkdirSync(sub, { recursive: true });
    assert.strictEqual(memFrom(sub, ["save", "auth-root", "--evidence", "x"], "desde src").status, 0);
    assert.ok(fs.existsSync(path.join(root, ".memory", "memory.db")), "store at the project root");
    assert.strictEqual(fs.existsSync(path.join(sub, ".memory")), false, "no nested store");
    assert.match(memFrom(root, ["context"]).stdout, /^auth-root \|/);
    assert.match(memFrom(sub, ["context"]).stdout, /^auth-root \|/);
  });
}

test("an existing .memory wins over a nearer-to-root .git, and without either the cwd is used", () => {
  const root = tmpDir();
  fs.mkdirSync(path.join(root, ".memory"));
  const sub = path.join(root, "pkg");
  fs.mkdirSync(sub);
  assert.strictEqual(memFrom(sub, ["save", "auth-pkg", "--evidence", "x"], "nota").status, 0);
  assert.ok(fs.existsSync(path.join(root, ".memory", "memory.db")));
  const bare = tmpDir();
  assert.strictEqual(memFrom(bare, ["save", "auth-bare", "--evidence", "x"], "nota").status, 0);
  assert.ok(fs.existsSync(path.join(bare, ".memory", "memory.db")));
});

test("a body written slowly through a pipe is still saved", async () => {
  const dir = storeDir();
  const run = await memAsync(dir, ["save", "auth-slow", "--evidence", "x"], "llego tarde", 300);
  assert.strictEqual(run.status, 0, run.stderr);
  assert.match(mem(dir, ["context"]).stdout, /^auth-slow \| \d{4}-\d{2}-\d{2} \| llego tarde$/m);
});

test("a lock held past the timeout reports that memory is busy", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "auth-first", "--evidence", "x"], "nota").status, 0);
  const { DatabaseSync } = require("node:sqlite");
  const holder = new DatabaseSync(path.join(dir, "memory.db"));
  holder.exec("begin immediate");
  try {
    const res = spawnSync(process.execPath, [SCRIPT, "save", "auth-second", "--evidence", "x"], {
      input: "nota",
      encoding: "utf8",
      env: { ...process.env, MEMORY_DIR: dir, MEMORY_BUSY_TIMEOUT_MS: "200" },
    });
    assert.strictEqual(res.status, 1, res.stderr);
    assert.match(res.stderr, /^mem: memory is busy; retry$/m);
  } finally {
    holder.exec("rollback");
    holder.close();
  }
});

test("a .memory above the git root is never adopted", () => {
  const home = tmpDir();
  fs.mkdirSync(path.join(home, ".memory"));
  const proj = path.join(home, "proj");
  fs.mkdirSync(path.join(proj, ".git"), { recursive: true });
  const sub = path.join(proj, "sub");
  fs.mkdirSync(sub);
  assert.strictEqual(memFrom(sub, ["save", "auth-x", "--evidence", "x"], "nota").status, 0);
  assert.ok(fs.existsSync(path.join(proj, ".memory", "memory.db")), "the store is at the git root");
  assert.deepStrictEqual(fs.readdirSync(path.join(home, ".memory")), [], "the ancestor store is left alone");
});

test("a .memory that is a regular file is reported, not thrown", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, ".memory"), "");
  const res = mem(path.join(root, ".memory"), ["save", "auth-y", "--evidence", "x"], "nota");
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: .*not a directory/m);
});

test("a file-system error is reported as a one-line message", () => {
  const dir = storeDir();
  fs.mkdirSync(path.join(dir, "memory.db"), { recursive: true });
  const res = mem(dir, ["save", "auth-z", "--evidence", "x"], "nota");
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: EISDIR: /m);
  assert.doesNotMatch(res.stderr, /\n\s+at /, "no stack trace");
});

test("save refuses a memory.db with several hard links", { skip: process.platform === "win32" }, () => {
  const base = tmpDir();
  const dir = path.join(base, ".memory");
  assert.strictEqual(mem(dir, ["save", "auth-first", "--evidence", "x"], "nota").status, 0);
  fs.linkSync(path.join(dir, "memory.db"), path.join(base, "alias.db"));
  const res = mem(dir, ["save", "auth-second", "--evidence", "x"], "nota");
  assert.strictEqual(res.status, 1, res.stderr);
  assert.match(res.stderr, /^mem: .*hard links/m);
});

for (const value of ["-5", "abc", "1e9", ""]) {
  test(`an invalid MEMORY_BUSY_TIMEOUT_MS (${JSON.stringify(value)}) falls back to the default`, () => {
    const res = spawnSync(process.execPath, [SCRIPT, "save", "auth-timeout", "--evidence", "x"], {
      input: "nota",
      encoding: "utf8",
      env: { ...process.env, MEMORY_DIR: storeDir(), MEMORY_BUSY_TIMEOUT_MS: value },
    });
    assert.strictEqual(res.status, 0, res.stderr);
  });
}

test("context prints the whole body of checkpoint and session-summary, capped, and one line for the rest", () => {
  const dir = storeDir();
  const summary = ["Goal: memoria", "Done: hook", "Next: forget", "Files: mem.js", ...Array.from({ length: 10 }, (_, i) => `extra ${i}`)].join("\n");
  assert.strictEqual(mem(dir, ["save", "session-summary", "--evidence", "x"], summary).status, 0);
  assert.strictEqual(mem(dir, ["save", "auth-token-expiry", "--evidence", "x"], "linea uno\nlinea dos").status, 0);
  const out = mem(dir, ["context"]).stdout;
  assert.match(out, /^session-summary \| \d{4}-\d{2}-\d{2} \| Goal: memoria\n {2}Done: hook\n {2}Next: forget\n {2}Files: mem\.js\n/);
  assert.doesNotMatch(out, /extra 7/, "the pinned body is capped");
  assert.match(out, /^auth-token-expiry \| \d{4}-\d{2}-\d{2} \| linea uno$/m);
  assert.doesNotMatch(out, /linea dos/, "other entries keep one line");
});

test("search falls back to any term when no entry has all of them", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "auth-token-expiry", "--evidence", "x"], "El token expira en 15 minutos").status, 0);
  assert.strictEqual(mem(dir, ["save", "build-flags", "--evidence", "x"], "compilar con O2").status, 0);
  const found = mem(dir, ["search", "token", "caducidad"]);
  assert.strictEqual(found.status, 0, found.stderr);
  assert.strictEqual(found.stdout.trim(), found.stdout.trim().split("\n")[0]);
  assert.match(found.stdout, /^auth-token-expiry \|/);
  assert.match(mem(dir, ["search", "nada", "caducidad"]).stdout, /^not in memory$/m);
});

test("forget removes the entry, its search row and its mirror file", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "auth-token-expiry", "--evidence", "x"], "El token expira").status, 0);
  assert.strictEqual(mem(dir, ["save", "build-flags", "--evidence", "x"], "compilar con O2").status, 0);
  const res = mem(dir, ["forget", "auth-token-expiry"]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(mem(dir, ["search", "token"]).stdout, /^not in memory$/m);
  assert.doesNotMatch(mem(dir, ["context"]).stdout, /auth-token-expiry/);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ["build-flags.md", "index.md", "memory.db"]);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "index.md"), "utf8"), /auth-token-expiry/);
});

test("forget of an unknown key says not in memory; a malformed key is refused", () => {
  const dir = storeDir();
  assert.strictEqual(mem(dir, ["save", "build-flags", "--evidence", "x"], "compilar").status, 0);
  const missing = mem(dir, ["forget", "auth-nothing"]);
  assert.strictEqual(missing.status, 0);
  assert.match(missing.stdout, /^not in memory$/m);
  const bad = mem(dir, ["forget", "../build-flags"]);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stderr, /^mem: /m);
  assert.ok(fs.existsSync(path.join(dir, "build-flags.md")));
});
