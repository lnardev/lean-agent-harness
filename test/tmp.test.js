"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const TEST_DIR = path.join(PKG_ROOT, "test");
/** Files that create temp directories themselves and already remove them. */
const OWN_CLEANUP = new Set(["git-env.test.js", "skills.test.js", "skill-commands.test.js", "tmp.test.js"]);

test("a test file using the shared helper leaves its TMPDIR empty", () => {
  const isolated = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-tmpcheck-")));
  try {
    const env = { ...process.env, TMPDIR: isolated, TMP: isolated, TEMP: isolated };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["--test", path.join(TEST_DIR, "diagram-design.test.js")], { encoding: "utf8", env, timeout: 60000 });
    assert.match(run.stdout, /^ℹ fail 0$/m, run.stdout.slice(-1500));
    assert.doesNotMatch(run.stdout, /^ℹ pass 0$/m, "the nested run executed its tests");
    assert.deepStrictEqual(fs.readdirSync(isolated), []);
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});

test("test files create temp directories only through test/tmp.js", () => {
  const offenders = fs
    .readdirSync(TEST_DIR)
    .filter((name) => name.endsWith(".test.js") && !OWN_CLEANUP.has(name))
    .filter((name) => /mkdtemp/.test(fs.readFileSync(path.join(TEST_DIR, name), "utf8")));
  assert.deepStrictEqual(offenders, []);
});
