"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const { isolatedEnv } = require("./git-env.js");

/** Isolated from inherited GIT_* variables, the user's git config, hooks and signing, with a fixed identity. */
const GIT_ENV = isolatedEnv();
const SPAWN_TIMEOUT_MS = 30000;
/** @type {string[]} temp repositories removed after the suite */
const CREATED = [];
test.after(() => {
  for (const dir of CREATED) fs.rmSync(dir, { recursive: true, force: true });
});
const HAS_GIT = spawnSync("git", ["--version"], { env: GIT_ENV }).status === 0;
const SKIP = HAS_GIT ? false : "git is not on PATH";

/** @param {string} name @returns {string} the SKILL.md of a skill */
function skill(name) {
  return fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
}

/**
 * Returns the one inline-code span of a skill that starts with a prefix, so the test runs the documented text.
 * @param {string} name skill folder
 * @param {string} prefix start of the command
 * @returns {string} the command exactly as documented
 */
function documented(name, prefix) {
  const spans = [...skill(name).matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((span) => span.startsWith(prefix));
  assert.strictEqual(new Set(spans).size, 1, `${name} documents exactly one \`${prefix}…\` command, found ${JSON.stringify(spans)}`);
  return spans[0];
}

/** A throwaway repository with one committed file. */
class Repo {
  constructor() {
    this.root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-git-")));
    CREATED.push(this.root);
    this.git("init", "-q", "-b", "main");
    this.write("a.txt", "one\ntwo\n");
    this.git("add", "a.txt");
    this.git("commit", "-q", "-m", "base");
  }

  /** @param {...string} args @returns {string} stdout */
  git(...args) {
    const res = spawnSync("git", args, { cwd: this.root, env: GIT_ENV, encoding: "utf8", timeout: SPAWN_TIMEOUT_MS });
    assert.strictEqual(res.status, 0, `git ${args.join(" ")}: ${res.stderr}`);
    return res.stdout;
  }

  /** @param {string} file @param {string} content */
  write(file, content) {
    fs.writeFileSync(path.join(this.root, file), content);
  }

  /** @param {string} command a documented shell pipeline, run verbatim @returns {string} trimmed stdout */
  sh(command) {
    const res = spawnSync("sh", ["-c", command], { cwd: this.root, env: GIT_ENV, encoding: "utf8", timeout: SPAWN_TIMEOUT_MS });
    assert.strictEqual(res.status, 0, `${command}: ${res.stderr}`);
    return res.stdout.trim();
  }
}

test("review-audit's diff hash is stable, moves on every edit, and sees new files only after git add -N", { skip: SKIP }, () => {
  const hash = documented("review-audit", "git diff HEAD |");
  assert.match(documented("review-audit", "git add -N"), /^git add -N </);
  const repo = new Repo();
  const clean = repo.sh(hash);
  assert.strictEqual(repo.sh(hash), clean, "same tree, same hash");
  repo.write("a.txt", "one\nTWO\n");
  const edited = repo.sh(hash);
  assert.notStrictEqual(edited, clean, "an edit to a tracked file moves the hash");
  repo.write("new.txt", "fresh\n");
  assert.strictEqual(repo.sh(hash), edited, "an untracked file is invisible without -N");
  repo.git("add", "-N", "new.txt");
  const intended = repo.sh(hash);
  assert.notStrictEqual(intended, edited, "git add -N brings the new file into the hash");
  repo.write("new.txt", "changed\n");
  assert.notStrictEqual(repo.sh(hash), intended, "an edit to an intent-added file moves the hash");
});

test("review-audit hashes the branch diff once the work is committed, since git diff HEAD is then empty", { skip: SKIP }, () => {
  const hash = documented("review-audit", "git diff HEAD |");
  const branchDiff = documented("review-audit", "git diff <base>...HEAD");
  const repo = new Repo();
  repo.git("switch", "-q", "-c", "feature/x");
  repo.write("a.txt", "one\nTWO\n");
  repo.git("commit", "-q", "-am", "work");
  assert.strictEqual(repo.git("diff", "HEAD"), "", "committed work leaves git diff HEAD empty");
  const emptyHash = repo.sh(hash);
  const branchHash = repo.sh(`${branchDiff.replace("<base>", "main")} | git hash-object --stdin`);
  assert.notStrictEqual(branchHash, emptyHash, "the branch diff carries the work");
  assert.match(repo.git("diff", "main...HEAD"), /\+TWO/);
});

test("commit's staged stat line reports insertions and deletions, including a deletion-only change", { skip: SKIP }, () => {
  const stat = documented("commit", "git diff --cached --stat");
  const repo = new Repo();
  repo.write("a.txt", "one\nTWO\nthree\n");
  repo.git("add", "a.txt");
  const last = (repo.sh(stat).split("\n").at(-1) ?? "").trim();
  assert.match(last, /^1 file changed, 2 insertions\(\+\), 1 deletion\(-\)$/);
  repo.git("commit", "-q", "-m", "edit");
  repo.git("rm", "-q", "a.txt");
  assert.match((repo.sh(stat).split("\n").at(-1) ?? "").trim(), /^1 file changed, 3 deletions\(-\)$/);
});
