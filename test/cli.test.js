"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { deployLocal, deployGlobal, deployTarget, parseManifest, PKG_ROOT, version } = require("../bin/cli.js");
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
  assert.ok(Buffer.byteLength(read("AGENTS.md")) <= 3800, "AGENTS.md exceeds 3800 bytes");
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

const EXTRA_SKILLS = ["impeccable", "humanizer", "diagram-design", "db-migration"];

for (const mode of ["local", "global"]) {
  test(`profile core: install.sh and bin/cli.js skip the extra skills identically (${mode})`, () => {
    const viaSh = tmpDir();
    const viaCli = tmpDir();
    const sh = spawnSync(
      "bash",
      [path.join(PKG_ROOT, "install.sh"), `--${mode}`, "--all", "--profile", "core"],
      { cwd: viaSh, env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT }, encoding: "utf8" },
    );
    assert.strictEqual(sh.status, 0, sh.stderr);
    const cli = spawnSync(
      process.execPath,
      [path.join(PKG_ROOT, "bin", "cli.js"), `--${mode}`, "--profile", "core"],
      { env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli }, cwd: viaCli, encoding: "utf8" },
    );
    assert.strictEqual(cli.status, 0, cli.stderr);
    assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
    for (const skill of EXTRA_SKILLS) {
      assert.strictEqual(fs.existsSync(path.join(viaCli, ".claude", "skills", skill)), false, `${skill} must be skipped`);
    }
    for (const skill of ["testing", "plan-flow", "commit", "security-audit", "diagnosing-bugs"]) {
      assert.ok(fs.existsSync(path.join(viaCli, ".claude", "skills", skill, "SKILL.md")), `${skill} must be kept`);
    }
  });
}

test("profile full is the default and an unknown profile is rejected", () => {
  const cwd = tmpDir();
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), ...args], {
      env: { ...process.env, LAH_FAKE_HOME: cwd, LAH_FAKE_CWD: cwd },
      cwd,
      encoding: "utf8",
    });
  assert.strictEqual(run().status, 0);
  for (const skill of EXTRA_SKILLS) assert.ok(fs.existsSync(path.join(cwd, ".claude", "skills", skill)), skill);
  const bad = run("--profile", "huge");
  assert.notStrictEqual(bad.status, 0);
  assert.match(bad.stderr, /Perfil desconocido.*core.*full/s);
});

test("each SKILL.md stays within 3000 bytes and every referenced file ships", () => {
  const root = path.join(PKG_ROOT, "skills");
  for (const d of fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const text = fs.readFileSync(path.join(root, d.name, "SKILL.md"), "utf8");
    assert.ok(Buffer.byteLength(text) <= 3000, `${d.name}: SKILL.md is ${Buffer.byteLength(text)} bytes (max 3000); move detail to references/`);
    for (const [, ref] of text.matchAll(/`(references\/[\w.-]+)`/g)) {
      assert.ok(fs.existsSync(path.join(root, d.name, ref)), `${d.name}: missing ${ref}`);
    }
  }
});

test("workflow skills define risk tiers and fresh-context verification for high risk", () => {
  const skill = (name) => fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
  assert.match(skill("plan-flow"), /\*\*Risk:\*\* low\|high/, "plan-flow must tag each slice with a risk tier");
  for (const name of ["orchestrate", "review"]) {
    assert.match(skill(name), /Risk: high/, `${name}: high-risk path`);
    assert.match(skill(name), /fresh context/i, `${name}: fresh-context verifier`);
  }
  assert.match(skill("orchestrate"), /<command>: <observed result>/, "orchestrate: verifier report format");
  assert.match(agentsMd, /Risk Tier|high-risk/i, "AGENTS.md must name the high-risk items once");
});

test("the 400-line change budget is defined once in orchestrate and enforced at commit", () => {
  const commit = fs.readFileSync(path.join(PKG_ROOT, "skills", "commit", "SKILL.md"), "utf8");
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.match(commit, /400 changed lines/, "commit: enforces the budget");
  assert.match(commit, /Change budget/, "commit: points at the orchestrate rule");
  assert.match(orchestrate, /400 changed lines/, "orchestrate: defines the budget");
  assert.match(orchestrate, /never shrink/i, "orchestrate: no diff shrinking");
});

test("verification evidence is a hash of the working diff, so it goes stale on any edit", () => {
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review", "SKILL.md"), "utf8");
  for (const [name, text] of [["orchestrate", orchestrate], ["review", review]]) {
    assert.match(text, /git diff HEAD \| git hash-object --stdin/, `${name}: hash of the uncommitted diff`);
    assert.doesNotMatch(text, /HEAD\^\{tree\}/, `${name}: HEAD tree misses uncommitted edits`);
  }
  assert.match(orchestrate, /stale/i, "orchestrate: a report for a changed diff is stale");
});

test("review reports WARNING and SUGGESTION once and never triggers work from them", () => {
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review", "SKILL.md"), "utf8");
  assert.match(review, /SUGGESTION/, "review: severity tiers");
  assert.match(review, /never trigger/i, "review: non-blocking findings never trigger fixes");
});

/** A fresh copy of the package payload (no .git, no .tasks), so a test can alter it. */
function copyPayload() {
  const payload = tmpDir();
  fs.cpSync(PKG_ROOT, payload, {
    recursive: true,
    filter: (from) => !from.split(path.sep).some((part) => part === ".git" || part === ".tasks"),
  });
  return payload;
}

test("installers never deploy dotfiles, even when the payload carries one (identically)", () => {
  const payload = copyPayload();
  fs.writeFileSync(path.join(payload, "skills", ".DS_Store"), "finder junk");
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  const sh = spawnSync("bash", [path.join(payload, "install.sh"), "--local", "--all", "--profile", "core"], {
    cwd: viaSh,
    env: { ...process.env, HOME: viaSh, LAH_SOURCE: payload },
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 0, sh.stderr);
  const cli = spawnSync(process.execPath, [path.join(payload, "bin", "cli.js"), "--local", "--profile", "core"], {
    env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli },
    cwd: viaCli,
    encoding: "utf8",
  });
  assert.strictEqual(cli.status, 0, cli.stderr);
  const shTree = snapshot(viaSh);
  assert.deepStrictEqual(shTree, snapshot(viaCli));
  const hidden = Object.keys(shTree).filter((rel) => path.basename(rel).startsWith("."));
  assert.deepStrictEqual(hidden, [], "no dotfile may be deployed");
});

test("package is publishable: author, shipped changelog, and an entry for the current version", () => {
  const pkg = require("../package.json");
  assert.match(pkg.author, /\S/, "author");
  assert.ok(pkg.files.includes("CHANGELOG.md"), "CHANGELOG.md must ship in the tarball");
  const changelog = fs.readFileSync(path.join(PKG_ROOT, "CHANGELOG.md"), "utf8");
  assert.match(changelog, new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\]`, "m"), `changelog entry for ${version}`);
});

test("a later divergence never overwrites an earlier backup", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "original user rules");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "edited after first install");
    deployLocal();
  });
  assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md.bak"), "utf8"), "original user rules");
  assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md.bak.1"), "utf8"), "edited after first install");
});

test("installer parity: repeated divergence keeps every backup, identically", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  const runSh = () =>
    spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--local", "--all"], {
      cwd: viaSh,
      env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT },
      encoding: "utf8",
    });
  const runCli = () =>
    spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), "--local"], {
      cwd: viaCli,
      env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli },
      encoding: "utf8",
    });
  for (const dir of [viaSh, viaCli]) fs.writeFileSync(path.join(dir, "AGENTS.md"), "original user rules");
  assert.strictEqual(runSh().status, 0);
  assert.strictEqual(runCli().status, 0);
  for (const dir of [viaSh, viaCli]) fs.writeFileSync(path.join(dir, "AGENTS.md"), "edited after first install");
  assert.strictEqual(runSh().status, 0);
  assert.strictEqual(runCli().status, 0);
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
  for (const dir of [viaSh, viaCli]) {
    assert.strictEqual(fs.readFileSync(path.join(dir, "AGENTS.md.bak"), "utf8"), "original user rules");
    assert.strictEqual(fs.readFileSync(path.join(dir, "AGENTS.md.bak.1"), "utf8"), "edited after first install");
  }
});

test("parseManifest rejects a row with the wrong column count and names its line", () => {
  assert.throws(
    () => parseManifest("# header\nlocal\tcore\tfile\tAGENTS.md\n"),
    /manifest\.tsv line 2: expected 5 or 6 columns, got 4/,
  );
});

/** Packs a copy of the payload as a GitHub-style archive (one top-level folder). */
function packPayload() {
  const stage = tmpDir();
  fs.renameSync(copyPayload(), path.join(stage, "lean-agent-harness-1.2.0"));
  const archive = path.join(tmpDir(), "lah.tar.gz");
  const tar = spawnSync("tar", ["-czf", archive, "-C", stage, "lean-agent-harness-1.2.0"], { encoding: "utf8" });
  assert.strictEqual(tar.status, 0, tar.stderr);
  return {
    url: `file://${archive}`,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex"),
  };
}

/** @param {string} home @param {Record<string,string>} env */
function runShDownload(home, env) {
  return spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--local", "--all"], {
    cwd: home,
    env: { ...process.env, HOME: home, LAH_SOURCE: "", ...env },
    encoding: "utf8",
  });
}

test("install.sh installs a downloaded archive only when its SHA-256 matches", () => {
  const { url, sha256 } = packPayload();
  const good = tmpDir();
  const ok = runShDownload(good, { LAH_ARCHIVE_URL: url, LAH_SHA256: sha256 });
  assert.strictEqual(ok.status, 0, ok.stderr);
  assert.ok(fs.existsSync(path.join(good, "AGENTS.md")));

  const bad = tmpDir();
  const mismatch = runShDownload(bad, { LAH_ARCHIVE_URL: url, LAH_SHA256: "0".repeat(64) });
  assert.notStrictEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Checksum SHA-256/);
  assert.strictEqual(fs.existsSync(path.join(bad, "AGENTS.md")), false, "nothing deployed on mismatch");
});

test("install.sh says when a download is installed without checksum verification", () => {
  const { url } = packPayload();
  const res = runShDownload(tmpDir(), { LAH_ARCHIVE_URL: url });
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /sin verificar el checksum/);
});

test("install.sh rejects a LAH_VERSION that is not a plain semver before downloading", () => {
  const res = runShDownload(tmpDir(), { LAH_VERSION: "1.2.0/../../x" });
  assert.strictEqual(res.status, 64);
  assert.match(res.stderr, /LAH_VERSION/);
});

test("AGENTS.md lets requests that need no file, code or command skip the engineering workflow", () => {
  assert.match(agentsMd, /\*\*Scope:\*\* .*no file, code or command.*direct answer/i);
});

test("GLOSSARY.md registers every LAH_ variable the installers read and the .bak.N backup naming", () => {
  const glossary = fs.readFileSync(path.join(PKG_ROOT, "GLOSSARY.md"), "utf8");
  const sources = ["install.sh", path.join("bin", "cli.js")]
    .map((file) => fs.readFileSync(path.join(PKG_ROOT, file), "utf8"))
    .join("\n");
  for (const name of new Set(sources.match(/\bLAH_[A-Z0-9_]+\b/g))) {
    assert.ok(glossary.includes(name), `${name} is missing from GLOSSARY.md`);
  }
  assert.match(glossary, /\.bak\.N/);
});

test("workflow skills never require a skill that --profile core omits", () => {
  const extras = fs
    .readFileSync(path.join(PKG_ROOT, "profile-extras.txt"), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  const skill = (name) => fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
  for (const line of skill("plan-flow").split("\n")) {
    for (const name of extras.filter((extra) => line.includes(`\`${extra}\``))) {
      assert.match(line, /if installed/i, `plan-flow names ${name} without marking it optional`);
    }
  }
  assert.match(skill("orchestrate"), /skip any that are not installed/i);
});

test("rollback only reverts files that were clean when the slice began", () => {
  assert.match(agentsMd, /Circuit Breaker:.*only files clean at slice start/);
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.match(orchestrate, /git status --short/);
  assert.match(orchestrate, /commit or stash/i);
});

test("review hashes the branch diff when the work is already committed, so the hash is never vacuous", () => {
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review", "SKILL.md"), "utf8");
  assert.match(review, /git diff <base>\.\.\.HEAD/);
  assert.match(review, /empty/i, "review: say why git diff HEAD is not enough");
});
