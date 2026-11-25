"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");
const { isolatedEnv } = require("./git-env.js");

const HAS_GIT = spawnSync("git", ["--version"]).status === 0;

test("isolatedEnv drops every GIT_ variable a hook exports and pins config, locale and identity", () => {
  const env = isolatedEnv({ PATH: "/bin", GIT_DIR: "/real/.git", GIT_WORK_TREE: "/real", GIT_INDEX_FILE: "/real/.git/index", GIT_CONFIG_COUNT: "1" });
  assert.strictEqual(env.PATH, "/bin");
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_CONFIG_COUNT"]) {
    assert.strictEqual(env[key], undefined, key);
  }
  assert.strictEqual(env.GIT_CONFIG_GLOBAL, os.devNull);
  assert.strictEqual(env.GIT_CONFIG_NOSYSTEM, "1");
  assert.strictEqual(env.LC_ALL, "C");
  assert.ok(env.GIT_AUTHOR_NAME && env.GIT_COMMITTER_EMAIL);
});

test("the git-backed tests leave the repository of an enclosing git hook untouched", { skip: HAS_GIT ? false : "git is not on PATH" }, () => {
  const decoy = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-decoy-")));
  try {
    const plain = { cwd: decoy, encoding: /** @type {const} */ ("utf8"), env: isolatedEnv() };
    spawnSync("git", ["init", "-q", "-b", "trunk"], plain);
    spawnSync("git", ["commit", "-q", "--allow-empty", "-m", "decoy"], plain);
    const before = spawnSync("git", ["rev-parse", "HEAD", "--symbolic-full-name", "HEAD"], plain).stdout;
    const hooked = { ...process.env, GIT_DIR: path.join(decoy, ".git") };
    delete hooked.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["--test", path.join(PKG_ROOT, "test", "skill-commands.test.js")], {
      encoding: "utf8",
      env: hooked,
      timeout: 60000,
    });
    assert.match(run.stdout, /ℹ pass 3/, "the nested run really executed the suite (NODE_TEST_CONTEXT would silence it)");
    assert.strictEqual(run.status, 0, run.stdout.slice(-2000));
    assert.strictEqual(spawnSync("git", ["rev-parse", "HEAD", "--symbolic-full-name", "HEAD"], plain).stdout, before, "decoy HEAD and branch unchanged");
    assert.strictEqual(spawnSync("git", ["rev-list", "--all", "--count"], plain).stdout.trim(), "1", "no commit landed in the decoy");
  } finally {
    fs.rmSync(decoy, { recursive: true, force: true });
  }
});

test("every git spawn in the test suite uses isolatedEnv", () => {
  const offenders = fs
    .readdirSync(path.join(PKG_ROOT, "test"))
    .filter((name) => name.endsWith(".test.js") && name !== "git-env.test.js")
    .flatMap((name) => {
      const lines = fs.readFileSync(path.join(PKG_ROOT, "test", name), "utf8").split("\n");
      return lines.flatMap((line, index) => (/spawnSync\("git"/.test(line) && !/isolatedEnv|GIT_ENV/.test(line) ? [`${name}:${index + 1}`] : []));
    });
  assert.deepStrictEqual(offenders, []);
});
