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

test("local deploy writes root instructions once and skills in each native location", () => {
  const cwd = tmpDir();
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    const at = (...p) => path.join(cwd, ...p);
    assert.strictEqual(fs.readFileSync(at("AGENTS.md"), "utf8"), agentsMd);
    assert.ok(fs.existsSync(at("CLAUDE.md")));
    assert.ok(fs.existsSync(at("GLOSSARY.md")));
    for (const root of [".claude", ".agents"]) {
      for (const skill of ["testing", "plan-flow", "orchestrate", "review", "audit-code", "commit"]) {
        assert.ok(fs.existsSync(at(root, "skills", skill, "SKILL.md")), `${root}/skills/${skill}`);
      }
    }
    assert.ok(fs.existsSync(at(".opencode", "commands", "plan-flow.md")));
  });
});

test("local deploy has no duplicated instructions and no legacy command/agent dirs", () => {
  const cwd = tmpDir();
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    for (const dup of [".claude/AGENTS.md", ".pi", ".cursor", ".codex", ".copilot", ".github", ".claude/commands", ".claude/agents", "skills", "commands", "agents"]) {
      assert.strictEqual(fs.existsSync(path.join(cwd, dup)), false, `${dup} must not be deployed`);
    }
  });
});

test("GLOSSARY.md is a seed: an existing project glossary is never overwritten", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "GLOSSARY.md"), "my domain terms");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    assert.strictEqual(fs.readFileSync(path.join(cwd, "GLOSSARY.md"), "utf8"), "my domain terms");
    assert.strictEqual(fs.existsSync(path.join(cwd, "GLOSSARY.md.bak")), false);
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

test("global deploy populates native user-home layouts", () => {
  const home = tmpDir();
  withEnv({ LAH_FAKE_HOME: home }, () => {
    deployGlobal();
    const at = (...p) => path.join(home, ...p);
    assert.strictEqual(fs.readFileSync(at(".pi", "agent", "AGENTS.md"), "utf8"), agentsMd);
    assert.strictEqual(fs.readFileSync(at(".codex", "AGENTS.md"), "utf8"), agentsMd);
    assert.strictEqual(fs.readFileSync(at(".config", "opencode", "AGENTS.md"), "utf8"), agentsMd);
    assert.ok(fs.existsSync(at(".copilot", "copilot-instructions.md")));
    assert.ok(fs.existsSync(at(".claude", "CLAUDE.md")));
    assert.ok(fs.existsSync(at(".claude", "skills", "plan-flow", "SKILL.md")));
    assert.ok(fs.existsSync(at(".agents", "skills", "plan-flow", "SKILL.md")));
    assert.ok(fs.existsSync(at(".config", "opencode", "commands", "commit.md")));
    assert.strictEqual(fs.existsSync(at(".codex", "prompts")), false, "Codex custom prompts are deprecated");
  });
});

test("deployTarget reports failure on an unwritable base instead of crashing", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "afile"), "x");
  const ok = deployTarget({
    name: "Broken",
    base: path.join(cwd, "afile", "nested"),
    entries: [{ kind: "dir", src: "skills", dest: "skills", mode: "" }],
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

/** @param {string} root @returns {Record<string,string>} relative path -> content */
function snapshot(root) {
  /** @type {Record<string,string>} */
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out[path.relative(root, full)] = fs.readFileSync(full, "utf8");
    }
  };
  walk(root);
  return out;
}

for (const mode of ["local", "global"]) {
  test(`installer parity: install.sh and bin/cli.js produce identical ${mode} trees`, () => {
    const viaSh = tmpDir();
    const viaCli = tmpDir();
    const sh = spawnSync(
      "bash",
      [path.join(PKG_ROOT, "install.sh"), `--${mode}`, "--all"],
      { cwd: viaSh, env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT }, encoding: "utf8" },
    );
    assert.strictEqual(sh.status, 0, sh.stderr);
    const cli = spawnSync(
      process.execPath,
      [path.join(PKG_ROOT, "bin", "cli.js"), `--${mode}`],
      { env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli }, cwd: viaCli, encoding: "utf8" },
    );
    assert.strictEqual(cli.status, 0, cli.stderr);
    assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
  });
}

const WORKFLOW_SKILLS = ["plan-flow", "orchestrate", "review", "audit-code", "commit"];

test("every skill has name (matching its folder) and description frontmatter", () => {
  const root = path.join(PKG_ROOT, "skills");
  for (const d of fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const text = fs.readFileSync(path.join(root, d.name, "SKILL.md"), "utf8");
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${d.name}: frontmatter`);
    assert.match(fm[1], new RegExp(`^name: ${d.name}$`, "m"), `${d.name}: name`);
    assert.match(fm[1], /^description: .{20,}$/m, `${d.name}: description`);
  }
});

test("workflow skills are explicit-only so they cost no standing tokens", () => {
  for (const name of WORKFLOW_SKILLS) {
    const text = fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
    assert.match(text, /^disable-model-invocation: true$/m, name);
    const codexPolicy = fs.readFileSync(path.join(PKG_ROOT, "skills", name, "agents", "openai.yaml"), "utf8");
    assert.match(codexPolicy, /allow_implicit_invocation: false/, `${name}: Codex policy`);
  }
});

test("each workflow skill has an OpenCode command stub pointing at it", () => {
  for (const name of WORKFLOW_SKILLS) {
    const stub = fs.readFileSync(path.join(PKG_ROOT, "adapters", "opencode", "commands", `${name}.md`), "utf8");
    assert.match(stub, new RegExp(`\\\`${name}\\\` skill`), name);
  }
});

test("shared instructions never hardcode skill file paths and legacy dirs are gone", () => {
  assert.doesNotMatch(agentsMd, /skills\/[<\w-]+\/SKILL\.md/);
  assert.strictEqual(fs.existsSync(path.join(PKG_ROOT, "commands")), false);
  assert.strictEqual(fs.existsSync(path.join(PKG_ROOT, "agents")), false);
});

test("token budget: standing context stays small", () => {
  const read = (...p) => fs.readFileSync(path.join(PKG_ROOT, ...p), "utf8").replace(/\r/g, "");
  assert.ok(Buffer.byteLength(read("AGENTS.md")) <= 3600, "AGENTS.md exceeds 3600 bytes");
  assert.ok(Buffer.byteLength(read("templates", "GLOSSARY.md")) <= 1500, "seeded GLOSSARY.md exceeds 1500 bytes");
  for (const d of fs.readdirSync(path.join(PKG_ROOT, "skills"), { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const fm = read("skills", d.name, "SKILL.md").match(/^---\n([\s\S]*?)\n---\n/)[1];
    if (/^disable-model-invocation: true$/m.test(fm)) continue;
    const description = fm.match(/^description: (.*)$/m)[1];
    assert.ok(description.length <= 160, `${d.name}: description is ${description.length} chars (max 160)`);
  }
});

test("only skills referenced by a workflow skill may be explicit-only besides workflows", () => {
  const text = fs.readFileSync(path.join(PKG_ROOT, "skills", "code-review", "SKILL.md"), "utf8");
  assert.match(text, /^disable-model-invocation: true$/m, "code-review is only reached through review");
});

test("workflow skills reference AGENTS.md rules instead of restating them, with no undefined personas", () => {
  for (const name of ["plan-flow", "orchestrate"]) {
    const text = fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
    assert.doesNotMatch(text, /tony-stark/, `${name}: undefined persona`);
  }
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.doesNotMatch(orchestrate, /After 2 consecutive failed fixes/, "Circuit Breaker restated; reference AGENTS.md");
  assert.match(orchestrate, /git switch -c feature\//, "orchestrate must create the feature branch");
});
