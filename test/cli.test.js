"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { deployLocal, deployGlobal, deployTarget, PKG_ROOT, version } = require("../bin/cli.js");
const agentsMd = fs.readFileSync(path.join(PKG_ROOT, "AGENTS.md"), "utf8");

/** @param {Record<string,string>} env vars to set during fn @param {() => void} fn */
function withEnv(env, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function tmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lah-test-")));
}

test("local deploy writes core files, mirrored dirs and platform aliases", () => {
  const cwd = tmpDir();
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8"), agentsMd);
    assert.ok(fs.existsSync(path.join(cwd, "skills", "code-review", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(cwd, "agents", "planner.md")));
    assert.strictEqual(
      fs.readFileSync(path.join(cwd, ".cursor", "rules", "agents.mdc"), "utf8"),
      agentsMd,
    );
    assert.strictEqual(
      fs.readFileSync(path.join(cwd, ".github", "copilot-instructions.md"), "utf8"),
      agentsMd,
    );
    assert.strictEqual(
      fs.readFileSync(path.join(cwd, ".codex", "instructions.md"), "utf8"),
      agentsMd,
    );
    assert.ok(fs.existsSync(path.join(cwd, ".claude", "commands", "orchestrate.md")));
    assert.ok(fs.existsSync(path.join(cwd, ".pi", "agent", "AGENTS.md")));
  });
});

test("local deploy preserves user instructions as .bak when overwriting a divergent file", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "custom user rules");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    assert.strictEqual(
      fs.readFileSync(path.join(cwd, "AGENTS.md.bak"), "utf8"),
      "custom user rules",
      "user version must survive in .bak",
    );
    assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8"), agentsMd);
  });
});

test("local deploy does not create .bak when the destination already matches", () => {
  const cwd = tmpDir();
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    deployLocal(); // second run: identical payload, no divergence
    assert.strictEqual(fs.existsSync(path.join(cwd, "AGENTS.md.bak")), false);
  });
});

test("global deploy populates user-home targets (pi, codex, opencode, claude)", () => {
  const home = tmpDir();
  withEnv({ LAH_FAKE_HOME: home }, () => {
    deployGlobal();
    assert.strictEqual(fs.readFileSync(path.join(home, ".pi", "agent", "AGENTS.md"), "utf8"), agentsMd);
    assert.ok(fs.existsSync(path.join(home, ".pi", "agent", "agents", "orchestrator.md")));
    assert.strictEqual(
      fs.readFileSync(path.join(home, ".codex", "instructions.md"), "utf8"),
      agentsMd,
    );
    assert.ok(fs.existsSync(path.join(home, ".config", "opencode", "skills")));
    assert.ok(fs.existsSync(path.join(home, ".claude", "commands", "commit.md")));
    assert.ok(fs.existsSync(path.join(home, ".copilot", "copilot-instructions.md")));
  });
});

test("deployTarget reports failure on an unwritable base instead of crashing", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "afile"), "x");
  const ok = deployTarget({
    name: "Broken",
    base: path.join(cwd, "afile", "nested"),
    dirs: ["skills"],
    files: ["AGENTS.md"],
  });
  assert.strictEqual(ok, false);
});

test("CLI --version prints the package version", () => {
  const res = spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), "--version"], {
    encoding: "utf8",
  });
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+$/);
  assert.strictEqual(res.stdout.trim(), version);
});

test("CLI --help exits 0 and lists environments", () => {
  const res = spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), "--help"], {
    encoding: "utf8",
  });
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout, /Claude Code/);
});

test("CLI rejects unknown flags with exit code 1", () => {
  const res = spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), "--bogus-flag"], {
    encoding: "utf8",
  });
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /Flag desconocido/);
});
