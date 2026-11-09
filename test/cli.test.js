"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { deployLocal, deployGlobal, deployTarget, parseManifest, writeInstruction, PKG_ROOT, version } = require("../bin/cli.js");
const agentsMd = fs.readFileSync(path.join(PKG_ROOT, "AGENTS.md"), "utf8");
const claudeMd = fs.readFileSync(path.join(PKG_ROOT, "CLAUDE.md"), "utf8");

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
      for (const skill of ["testing", "plan-flow", "orchestrate", "review-audit", "commit"]) {
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

test("local deploy preserves a divergent user AGENTS.md: original in .bak, rules in context", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "custom user rules");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    assert.strictEqual(
      fs.readFileSync(path.join(cwd, "AGENTS.md.bak"), "utf8"),
      "custom user rules",
      "user version must survive in .bak",
    );
    const merged = fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8");
    assert.ok(merged.startsWith(agentsMd), "harness rules must lead the deployed file");
    assert.ok(
      merged.includes("<!-- lah:project-rules:start -->\n## Project Rules\n\ncustom user rules\n<!-- lah:project-rules:end -->"),
      "user rules must stay in the agent's context",
    );
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

const WORKFLOW_SKILLS = ["plan-flow", "orchestrate", "review-audit", "commit"];

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

test("workflow skills reference AGENTS.md rules instead of restating them, with no undefined personas", () => {
  for (const name of ["plan-flow", "orchestrate"]) {
    const text = fs.readFileSync(path.join(PKG_ROOT, "skills", name, "SKILL.md"), "utf8");
    assert.doesNotMatch(text, /tony-stark/, `${name}: undefined persona`);
  }
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.doesNotMatch(orchestrate, /After 2 consecutive failed fixes/, "Circuit Breaker restated; reference AGENTS.md");
  assert.match(orchestrate, /git switch -c feature\//, "orchestrate must create the feature branch");
});

const EXTRA_SKILLS = ["impeccable", "humanizer", "diagram-design", "db-migration", "memory"];

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
  for (const name of ["orchestrate", "review-audit"]) {
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
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review-audit", "SKILL.md"), "utf8");
  for (const [name, text] of [["orchestrate", orchestrate], ["review-audit", review]]) {
    assert.match(text, /git diff HEAD \| git hash-object --stdin/, `${name}: hash of the uncommitted diff`);
    assert.doesNotMatch(text, /HEAD\^\{tree\}/, `${name}: HEAD tree misses uncommitted edits`);
  }
  assert.match(orchestrate, /stale/i, "orchestrate: a report for a changed diff is stale");
});

test("review reports WARNING and SUGGESTION once and never triggers work from them", () => {
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review-audit", "SKILL.md"), "utf8");
  assert.match(review, /SUGGESTION/, "review: severity tiers");
  assert.match(review, /never trigger/i, "review: non-blocking findings never trigger fixes");
});

test("review-audit has effort levels, per-axis reviewers, a verification pass and never edits code", () => {
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review-audit", "SKILL.md"), "utf8");
  assert.match(review, /^argument-hint: \[low\|medium\|high\] \[target\]$/m, "review-audit: level argument");
  for (const level of ["low", "medium", "high"]) assert.match(review, new RegExp(`\\*\\*${level}\\*\\*`), `review-audit: ${level} level`);
  assert.ok(!fs.existsSync(path.join(PKG_ROOT, "skills", "review-rubric")), "the rubric lives inside review-audit");
  for (const axis of ["Correctness", "Readability & Bloat", "Architecture & Boundaries", "Safety & Performance"]) {
    assert.match(review, new RegExp(axis), `review-audit: ${axis} axis`);
  }
  assert.match(review, /one reviewer per axis/i, "review-audit: per-axis reviewers");
  assert.match(review, /verif(y|ication) pass/i, "review-audit: findings are re-checked before reporting");
  assert.match(review, /security hotspots?/i, "review-audit: flags hotspots for human review");
  assert.match(review, /sequential/i, "review-audit: hosts without subagents degrade to sequential");
  assert.match(review, /never edit/i, "review-audit: reports only, fixes belong to orchestrate");
});

test("security-audit owns the scan scope; there is no separate code-audit wrapper", () => {
  assert.ok(!fs.existsSync(path.join(PKG_ROOT, "skills", "code-audit")), "code-audit was a shallow wrapper over security-audit");
  const audit = fs.readFileSync(path.join(PKG_ROOT, "skills", "security-audit", "SKILL.md"), "utf8");
  assert.match(audit, /## Scope/, "security-audit: scope section");
  assert.match(audit, /node_modules/, "security-audit: skip list");
});

test("security-audit verifies findings, reports an exploit scenario and keeps its exclusions in a reference", () => {
  const dir = path.join(PKG_ROOT, "skills", "security-audit");
  const audit = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
  assert.match(audit, /Data Exposure/, "security-audit: data exposure vector");
  assert.match(audit, /Exploit Scenario/, "security-audit: exploit scenario field");
  assert.match(audit, /verif(y|ication) pass/i, "security-audit: findings are re-checked");
  assert.match(audit, /confidence/i, "security-audit: confidence threshold");
  assert.match(audit, /`references\/exclusions\.md`/, "security-audit: points at the exclusions");
  const exclusions = fs.readFileSync(path.join(dir, "references", "exclusions.md"), "utf8");
  assert.match(exclusions, /Environment variables and CLI flags are trusted/, "exclusions: trusted inputs");
  assert.match(exclusions, /Denial of service/i, "exclusions: DoS");
});

test("plan-flow never silently replaces a plan that still has pending items", () => {
  const plan = fs.readFileSync(path.join(PKG_ROOT, "skills", "plan-flow", "SKILL.md"), "utf8");
  assert.match(plan, /Active plan gate/, "plan-flow: gate on an unfinished plan");
  assert.match(plan, /`- \[ \]`/, "plan-flow: looks for pending checklist items");
  assert.match(plan, /replace or continue/i, "plan-flow: asks before replacing");
});

test("plan-flow records a clean baseline and pins edge cases, and stays read-only", () => {
  const plan = fs.readFileSync(path.join(PKG_ROOT, "skills", "plan-flow", "SKILL.md"), "utf8");
  const step4 = plan.match(/4\. \*\*Ground truth:\*\*[^\n]*/)?.[0] ?? "";
  assert.match(step4, /Baseline/, "step 4 records the baseline");
  assert.match(step4, /never edits/, "running the tests keeps plan-flow read-only");
  const step6 = plan.match(/6\. \*\*Slice:\*\*[^\n]*/)?.[0] ?? "";
  assert.match(step6, /five edge cases/, "step 6 caps the edge cases");
  assert.match(step6, /test in RED/, "each edge case gets a test in RED");
  const format = plan.slice(plan.indexOf("## Output format"));
  const sliceHeading = format.indexOf("### Slice N");
  assert.ok(format.indexOf("**Baseline:**") > -1 && format.indexOf("**Baseline:**") < sliceHeading, "Baseline sits under Architecture & Context");
  assert.ok(format.indexOf("**Edge cases") > sliceHeading, "Edge cases sit under the slice");
});

test("orchestrate ends every slice with a fixed report table", () => {
  const text = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.match(text, /## Slice report/, "orchestrate: report section");
  assert.match(text, /\| Slice \| Files \| RED \| GREEN \| Deviations from plan \| Diff hash \|/, "orchestrate: report columns");
  assert.match(text, /exact test summary line/i, "orchestrate: RED and GREEN quote the runner");
});

const RETIRED_MARKERS = {
  review: "description: Risk-based audit of uncommitted changes against quality gates before committing. Invoke explicitly.",
  "audit-code": "description: Deep static security audit of a path or the whole workspace. Invoke explicitly.",
  "code-review": "description: Fast, multi-axis technical code review targeting SonarQube quality gates (Bugs, Code Smells), architectural debt, and diff hygiene.",
};
const LEGACY_SKILL_DIRS = [".claude/skills", ".agents/skills", ".commandcode/skills"];
const LEGACY_COMMANDS = [".opencode/commands/review.md", ".opencode/commands/audit-code.md"];

/** Lays out what a 1.x install left behind: the retired skills and OpenCode commands. */
function seedLegacy(root) {
  for (const dir of LEGACY_SKILL_DIRS) {
    for (const [name, marker] of Object.entries(RETIRED_MARKERS)) {
      const skill = path.join(root, dir, name);
      fs.mkdirSync(skill, { recursive: true });
      fs.writeFileSync(path.join(skill, "SKILL.md"), `---\nname: ${name}\n${marker}\n---\n`);
    }
  }
  fs.mkdirSync(path.join(root, ".opencode", "commands"), { recursive: true });
  for (const file of LEGACY_COMMANDS) {
    const name = path.basename(file, ".md");
    fs.writeFileSync(path.join(root, file), `---\n${RETIRED_MARKERS[name]}\n---\n`);
  }
}

/** @returns {string[]} every path a 1.x install could have left behind */
function legacyPaths() {
  return [...LEGACY_SKILL_DIRS.flatMap((dir) => Object.keys(RETIRED_MARKERS).map((name) => `${dir}/${name}`)), ...LEGACY_COMMANDS];
}

/** Runs both installers in local mode over the given trees. */
function installBoth(payload, viaSh, viaCli, profile = []) {
  const sh = spawnSync("bash", [path.join(payload, "install.sh"), "--local", "--all", ...profile], {
    cwd: viaSh,
    env: { ...process.env, HOME: viaSh, LAH_SOURCE: payload },
    encoding: "utf8",
  });
  const cli = spawnSync(process.execPath, [path.join(payload, "bin", "cli.js"), "--local", ...profile], {
    env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli },
    cwd: viaCli,
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 0, sh.stderr);
  assert.strictEqual(cli.status, 0, cli.stderr);
}

test("installers retire the skills and commands removed from the package, identically", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  seedLegacy(viaSh);
  seedLegacy(viaCli);
  installBoth(PKG_ROOT, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    for (const rel of legacyPaths()) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} must be retired`);
  }
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
});

test("a skill that reuses a retired name but is not the shipped one is kept", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    seedLegacy(root);
    fs.writeFileSync(path.join(root, ".claude", "skills", "review", "SKILL.md"), "---\nname: review\ndescription: my own review\n---\n");
  }
  installBoth(PKG_ROOT, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    assert.match(fs.readFileSync(path.join(root, ".claude", "skills", "review", "SKILL.md"), "utf8"), /my own review/);
    assert.ok(!fs.existsSync(path.join(root, ".claude", "skills", "audit-code")), "the shipped one is still retired");
  }
});

test("retiring is idempotent and the core profile retires too", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  seedLegacy(viaSh);
  seedLegacy(viaCli);
  installBoth(PKG_ROOT, viaSh, viaCli, ["--profile", "core"]);
  const first = snapshot(viaCli);
  installBoth(PKG_ROOT, viaSh, viaCli, ["--profile", "core"]);
  assert.deepStrictEqual(snapshot(viaCli), first);
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
  for (const rel of legacyPaths()) assert.ok(!fs.existsSync(path.join(viaCli, rel)), `${rel} must be retired`);
});

test("a retired name that the package ships again is never deleted", () => {
  const payload = copyPayload();
  const reborn = "---\nname: review\n" + RETIRED_MARKERS.review + "\n---\nreborn\n";
  fs.mkdirSync(path.join(payload, "skills", "review"), { recursive: true });
  fs.writeFileSync(path.join(payload, "skills", "review", "SKILL.md"), reborn);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  seedLegacy(viaSh);
  seedLegacy(viaCli);
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    assert.strictEqual(fs.readFileSync(path.join(root, ".claude", "skills", "review", "SKILL.md"), "utf8"), reborn);
  }
});

test("a retired entry that climbs out of its directory is ignored", () => {
  const payload = copyPayload();
  const file = path.join(payload, "retired.tsv");
  fs.appendFileSync(file, `skills/../victim.txt\t${RETIRED_MARKERS.review}\n`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude", "victim.txt"), RETIRED_MARKERS.review + "\n");
  }
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) assert.ok(fs.existsSync(path.join(root, ".claude", "victim.txt")), "outside the skills directory");
});

/** Seeds a user file under the deployed .claude tree, with a blank line like any real SKILL.md. */
function seedUserSkill(root, rel, content) {
  const file = path.join(root, ".claude", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test("a retired.tsv row without a marker never deletes a user skill", () => {
  const payload = copyPayload();
  fs.appendFileSync(path.join(payload, "retired.tsv"), "skills/no-tab\nskills/trailing-tab\t\n");
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    for (const name of ["no-tab", "trailing-tab"]) seedUserSkill(root, `skills/${name}/SKILL.md`, `name: ${name}\n\nmine\n`);
  }
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    for (const name of ["no-tab", "trailing-tab"]) assert.ok(fs.existsSync(path.join(root, ".claude", "skills", name)), `${name} must survive`);
  }
});

test("a retired.tsv entry that names the deployed directory itself is ignored", () => {
  const payload = copyPayload();
  fs.appendFileSync(path.join(payload, "retired.tsv"), `skills/\t${RETIRED_MARKERS.review}\nskills/.\t${RETIRED_MARKERS.review}\n`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    seedUserSkill(root, "skills/SKILL.md", RETIRED_MARKERS.review + "\n");
    seedUserSkill(root, "skills/keep/SKILL.md", "keep\n");
  }
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    assert.ok(fs.existsSync(path.join(root, ".claude", "skills", "keep", "SKILL.md")), "the skills directory must survive");
  }
});

test("retired.tsv is read the same way by both installers: last line without newline, extra tabs", () => {
  const payload = copyPayload();
  const file = path.join(payload, "retired.tsv");
  fs.appendFileSync(file, `skills/double-tab\t\t${RETIRED_MARKERS.review}`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    seedLegacy(root);
    seedUserSkill(root, "skills/double-tab/SKILL.md", RETIRED_MARKERS.review + "\n");
  }
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    assert.ok(fs.existsSync(path.join(root, ".claude", "skills", "double-tab")), "a row with extra tabs is skipped");
  }
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
  fs.writeFileSync(file, fs.readFileSync(path.join(PKG_ROOT, "retired.tsv"), "utf8").trimEnd());
  const sh2 = tmpDir();
  const cli2 = tmpDir();
  seedLegacy(sh2);
  seedLegacy(cli2);
  installBoth(payload, sh2, cli2);
  for (const root of [sh2, cli2]) {
    for (const rel of legacyPaths()) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} must be retired even without a final newline`);
  }
});

test("a retired path that goes through a symlinked directory is never followed", () => {
  const payload = copyPayload();
  fs.appendFileSync(path.join(payload, "retired.tsv"), `skills/sub/victim\t${RETIRED_MARKERS.review}\n`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  const outsides = [tmpDir(), tmpDir()];
  [viaSh, viaCli].forEach((root, i) => {
    fs.mkdirSync(path.join(outsides[i], "victim"), { recursive: true });
    fs.writeFileSync(path.join(outsides[i], "victim", "SKILL.md"), RETIRED_MARKERS.review + "\n");
    fs.mkdirSync(path.join(root, ".claude", "skills"), { recursive: true });
    fs.symlinkSync(outsides[i], path.join(root, ".claude", "skills", "sub"));
  });
  installBoth(payload, viaSh, viaCli);
  for (const outside of outsides) assert.ok(fs.existsSync(path.join(outside, "victim", "SKILL.md")), "the symlink target must survive");
});

test("a deep retired row whose middle component is a regular file is skipped by both installers", () => {
  const payload = copyPayload();
  fs.appendFileSync(path.join(payload, "retired.tsv"), `skills/a/b/c\t${RETIRED_MARKERS.review}\n`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) seedUserSkill(root, "skills/a", "i am a file\n");
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) assert.strictEqual(fs.readFileSync(path.join(root, ".claude", "skills", "a"), "utf8"), "i am a file\n");
});

test("rows with an empty path segment or a marker that differs only by spaces delete nothing", () => {
  const payload = copyPayload();
  fs.appendFileSync(path.join(payload, "retired.tsv"), `skills//x\t${RETIRED_MARKERS.review}\nskills/spaced\t  ${RETIRED_MARKERS.review}\n`);
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const root of [viaSh, viaCli]) {
    for (const name of ["x", "spaced"]) seedUserSkill(root, `skills/${name}/SKILL.md`, RETIRED_MARKERS.review + "\n");
  }
  installBoth(payload, viaSh, viaCli);
  for (const root of [viaSh, viaCli]) {
    for (const name of ["x", "spaced"]) assert.ok(fs.existsSync(path.join(root, ".claude", "skills", name)), `${name} must survive`);
  }
});

test("retired.tsv ships in the npm tarball", () => {
  const { files } = require("../package.json");
  assert.ok(files.includes("retired.tsv"), 'package.json "files" must list retired.tsv');
});

test("the glossary and the manifest point at retired.tsv", () => {
  for (const file of ["GLOSSARY.md", "manifest.tsv"]) {
    assert.match(fs.readFileSync(path.join(PKG_ROOT, file), "utf8"), /retired\.tsv/, `${file} must name retired.tsv`);
  }
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

test("merge: a divergent user AGENTS.md survives in context as a Project Rules section", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "my own project rules\n");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    const merged = fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8");
    assert.ok(merged.startsWith(agentsMd), "harness rules must lead the deployed file");
    assert.ok(
      merged.includes("<!-- lah:project-rules:start -->\n## Project Rules\n\nmy own project rules\n<!-- lah:project-rules:end -->"),
      "user rules must stay in the agent's context",
    );
    assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md.bak"), "utf8"), "my own project rules\n");
  });
});

test("merge: reinstalling the same payload over a merged file changes nothing and adds no backup", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "my own project rules\n");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    const before = fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8");
    deployLocal();
    assert.strictEqual(fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8"), before);
    assert.strictEqual(fs.existsSync(path.join(cwd, "AGENTS.md.bak.1")), false);
  });
});

test("merge: a payload upgrade replaces only the harness part and keeps the user section", () => {
  const dir = tmpDir();
  const src = path.join(dir, "AGENTS.md");
  const dest = path.join(dir, "dest.md");
  fs.writeFileSync(src, "harness rules v1\n");
  fs.writeFileSync(dest, "user rules\n");
  writeInstruction(src, dest, "merge");
  fs.writeFileSync(src, "harness rules v2\n");
  writeInstruction(src, dest, "merge");
  const merged = fs.readFileSync(dest, "utf8");
  assert.ok(merged.startsWith("harness rules v2\n"));
  assert.ok(merged.includes("## Project Rules\n\nuser rules\n<!-- lah:project-rules:end -->"));
  assert.doesNotMatch(merged, /harness rules v1/);
});

test("merge: a harness-generated file is replaced bare, never absorbed as project rules", () => {
  const dir = tmpDir();
  const src = path.join(dir, "AGENTS.md");
  const dest = path.join(dir, "dest.md");
  fs.writeFileSync(src, "harness rules v2\n");
  const generated = [
    "<!-- Managed by lean-agent-harness -->\nharness rules v1\n",
    "harness rules v1\nSingle source of truth for all coding agents.\n",
  ];
  for (const old of generated) {
    fs.writeFileSync(dest, old);
    writeInstruction(src, dest, "merge");
    assert.strictEqual(fs.readFileSync(dest, "utf8"), "harness rules v2\n", JSON.stringify(old));
  }
});

/** The CLAUDE.md stub exactly as the v1.3.2 installer deployed it (before any harness marker existed). */
const V132_CLAUDE_MD = [
  "# Claude Code Project Configuration",
  "",
  "Single source of truth is defined in `AGENTS.md`. All directives, subagents, skills, and lifecycle commands apply here.",
  "",
  "Read and adhere strictly to:",
  "@AGENTS.md",
  "",
  "## Fast Command Reference",
  "- `/plan-flow <task>`: Read-only architecture analysis & ODD milestone checklist.",
  "- `/orchestrate <task>`: Step-by-step implementation, RED-GREEN loop, and DoD validation.",
  "- `/review-audit [target]`: Risk-based git diff audit against SonarQube quality gates.",
  "- `/commit [hint]`: Quality gate verification and atomic Conventional Commit.",
].join("\n");

test("merge: a CLAUDE.md deployed by a previous release is upgraded bare, never absorbed", () => {
  const dir = tmpDir();
  const src = path.join(dir, "CLAUDE.md");
  const dest = path.join(dir, "dest.md");
  fs.writeFileSync(src, "new stub\n");
  fs.writeFileSync(dest, V132_CLAUDE_MD);
  writeInstruction(src, dest, "merge");
  assert.strictEqual(fs.readFileSync(dest, "utf8"), "new stub\n", "the 1.x stub must not become project rules");
});

test("merge: a divergent user CLAUDE.md keeps its rules in context too", () => {
  const cwd = tmpDir();
  fs.writeFileSync(path.join(cwd, "CLAUDE.md"), "my claude rules\n");
  withEnv({ LAH_FAKE_CWD: cwd }, () => {
    deployLocal();
    const merged = fs.readFileSync(path.join(cwd, "CLAUDE.md"), "utf8");
    assert.ok(merged.startsWith(claudeMd), "harness stub must lead the deployed file");
    assert.ok(merged.includes("## Project Rules\n\nmy claude rules\n"));
    assert.strictEqual(fs.readFileSync(path.join(cwd, "CLAUDE.md.bak"), "utf8"), "my claude rules\n");
  });
});

test("plain file rows never absorb: a divergent dest is backed up and replaced", () => {
  const dir = tmpDir();
  const src = path.join(dir, "src.rules");
  const dest = path.join(dir, "lah.rules");
  fs.writeFileSync(src, "new rules\n");
  fs.writeFileSync(dest, "old edited rules\n");
  writeInstruction(src, dest, "");
  assert.strictEqual(fs.readFileSync(dest, "utf8"), "new rules\n");
  assert.strictEqual(fs.readFileSync(`${dest}.bak`, "utf8"), "old edited rules\n");
});

test("every AGENTS.md/CLAUDE.md manifest row deploys in merge mode", () => {
  const rows = parseManifest(fs.readFileSync(path.join(PKG_ROOT, "manifest.tsv"), "utf8"));
  const stubs = rows.filter((r) => r.entry.kind === "file" && /(?:^|\/)(AGENTS|CLAUDE)\.md$/.test(r.entry.src));
  assert.strictEqual(stubs.length, 9, "two local rows plus seven global user-home rows");
  for (const r of stubs) {
    assert.strictEqual(r.entry.mode, "merge", `${r.scope}/${r.target}: ${r.entry.src}`);
  }
});

test("installer parity: both installers merge a pre-existing user AGENTS.md identically", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  for (const dir of [viaSh, viaCli]) {
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "\nmy own rules\nwith two lines\n");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), V132_CLAUDE_MD); // harness-mark arm, both engines
  }
  const shBin = fs.existsSync("/bin/bash") ? "/bin/bash" : "bash"; // stock macOS bash 3.2 must pass too
  const sh = spawnSync(
    shBin,
    [path.join(PKG_ROOT, "install.sh"), "--local", "--all"],
    { cwd: viaSh, env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT }, encoding: "utf8" },
  );
  assert.strictEqual(sh.status, 0, sh.stderr);
  const cli = spawnSync(
    process.execPath,
    [path.join(PKG_ROOT, "bin", "cli.js"), "--local"],
    { env: { ...process.env, LAH_FAKE_HOME: viaCli, LAH_FAKE_CWD: viaCli }, cwd: viaCli, encoding: "utf8" },
  );
  assert.strictEqual(cli.status, 0, cli.stderr);
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
  const merged = snapshot(viaCli)["AGENTS.md"];
  assert.ok(merged.includes("## Project Rules\n\nmy own rules\nwith two lines"), "leading blank line trimmed, interior lines kept");
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
  const review = fs.readFileSync(path.join(PKG_ROOT, "skills", "review-audit", "SKILL.md"), "utf8");
  assert.match(review, /git diff <base>\.\.\.HEAD/);
  assert.match(review, /empty/i, "review: say why git diff HEAD is not enough");
});

test("the dependency rule blocks new packages but allows installing the declared ones", () => {
  assert.match(agentsMd, /Dependencies:\*\* No new packages .*unless the approved plan lists them.*`npm ci`/);
});

/** The Pi guard's tool_call handler, captured through a fake extension API. */
function loadPiGuard() {
  const handlers = [];
  require("../guard/pi/lah-guard/index.js")({ on: (event, handler) => handlers.push({ event, handler }) });
  return handlers.find((entry) => entry.event === "tool_call").handler;
}

const NO_UI = { hasUI: false };
const confirmWith = (answer) => ({ hasUI: true, ui: { confirm: async () => answer } });

const GUARD_DENIED = [
  ["bash", { command: "cat .env" }],
  ["bash", { command: "cat config/.env.production" }],
  ["bash", { command: "grep KEY ~/.ssh/id_rsa" }],
  ["bash", { command: "ls && cat .env" }],
  ["read", { path: "/proj/.env" }],
  ["read", { path: "server.pem" }],
  ["write", { path: ".env.local" }],
  ["edit", { path: "/home/u/.ssh/config" }],
  ["read", { path: "/p/.ENV" }],
  ["bash", { command: "cat KEY.PEM" }],
];

const GUARD_ALLOWED = [
  ["bash", { command: "ls -la" }],
  ["bash", { command: "cat .env.example" }],
  ["bash", { command: "echo .env >> .gitignore" }],
  ["bash", { command: "git push origin main" }],
  ["bash", { command: "rm file.txt" }],
  ["read", { path: ".env.example" }],
  ["edit", { path: "src/app.js" }],
  ["grep", { pattern: "token" }],
];

const GUARD_ASKED = [
  "rm -rf build",
  "git reset --hard HEAD~1",
  "git push origin main --force",
  "ls && sudo make install",
  "FOO=1 rm -fr /tmp/x",
  "/bin/rm -rf build",
  "SUDO make install",
];

test("pi guard denies secret files outright, even when the user would confirm", async () => {
  const guard = loadPiGuard();
  for (const [tool, input] of GUARD_DENIED) {
    const result = await guard({ toolName: tool, input }, confirmWith(true));
    assert.strictEqual(result && result.block, true, `${tool} ${JSON.stringify(input)} must be denied`);
  }
});

test("pi guard lets ordinary calls through", async () => {
  const guard = loadPiGuard();
  for (const [tool, input] of GUARD_ALLOWED) {
    assert.strictEqual(await guard({ toolName: tool, input }, NO_UI), undefined, `${tool} ${JSON.stringify(input)}`);
  }
});

test("pi guard asks before destructive commands and blocks them when nobody can answer", async () => {
  const guard = loadPiGuard();
  for (const command of GUARD_ASKED) {
    const event = { toolName: "bash", input: { command } };
    const headless = await guard(event, NO_UI);
    assert.strictEqual(headless && headless.block, true, `${command}: blocked without a UI`);
    assert.match(headless.reason, /no UI/);
    const declined = await guard(event, confirmWith(false));
    assert.strictEqual(declined && declined.block, true, `${command}: blocked when declined`);
    assert.strictEqual(await guard(event, confirmWith(true)), undefined, `${command}: allowed when confirmed`);
  }
});

test("guard policy rules are well formed", () => {
  const policy = require("../guard/policy.json");
  assert.ok(policy.secrets.basenames.length > 0);
  for (const rule of policy.shell) {
    assert.ok(Array.isArray(rule.command) && rule.command.length > 0, "command tokens");
    assert.ok(["ask", "deny"].includes(rule.decision), `decision for ${rule.command.join(" ")}`);
    assert.match(rule.reason, /\S/, `reason for ${rule.command.join(" ")}`);
  }
});

test("the Codex rules file is generated from the policy and keeps the policy decisions", () => {
  const { renderCodex } = require("../guard/build.js");
  const policy = require("../guard/policy.json");
  const committed = fs.readFileSync(path.join(PKG_ROOT, "guard", "codex", "lah.rules"), "utf8");
  assert.strictEqual(committed, renderCodex(policy), "run `node guard/build.js` to regenerate guard/codex/lah.rules");
  assert.match(committed, /pattern = \["git", "push", "--force"\],\n\s+decision = "prompt"/);
  assert.match(committed, /pattern = \["sudo"\]/);
});

test("the Pi extension reads a copy of the policy that is identical to guard/policy.json", () => {
  const read = (...parts) => fs.readFileSync(path.join(PKG_ROOT, ...parts), "utf8");
  assert.strictEqual(read("guard", "pi", "lah-guard", "policy.json"), read("guard", "policy.json"), "run `node guard/build.js`");
});

test("the Pi extension and the Claude Code hook ship the shared matcher, identical to guard/core.js", () => {
  const read = (...parts) => fs.readFileSync(path.join(PKG_ROOT, ...parts), "utf8");
  for (const dir of [["pi", "lah-guard"], ["claude", "lah-guard"]]) {
    assert.strictEqual(read("guard", ...dir, "core.js"), read("guard", "core.js"), `run \`node guard/build.js\` (${dir.join("/")})`);
    assert.strictEqual(read("guard", ...dir, "policy.json"), read("guard", "policy.json"), `run \`node guard/build.js\` (${dir.join("/")})`);
  }
});

const CLAUDE_HOOK = path.join(PKG_ROOT, "guard", "claude", "lah-guard", "index.js");

/** @param {unknown} payload @returns {import("node:child_process").SpawnSyncReturns<string>} */
function runClaudeHook(payload) {
  return spawnSync(process.execPath, [CLAUDE_HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });
}

/** @param {string} toolName @param {Record<string, unknown>} toolInput */
function claudeVerdict(toolName, toolInput) {
  const res = runClaudeHook({ hook_event_name: "PreToolUse", tool_name: toolName, tool_input: toolInput });
  assert.strictEqual(res.status, 0, res.stderr);
  return res.stdout.trim() === "" ? undefined : JSON.parse(res.stdout).hookSpecificOutput;
}

const CLAUDE_DENIED = [
  ["Bash", { command: "cat .env" }],
  ["Bash", { command: "ls && cat config/.env.production" }],
  ["Bash", { command: "grep KEY ~/.ssh/id_rsa" }],
  ["Read", { file_path: "/proj/.env" }],
  ["Read", { file_path: "server.pem" }],
  ["Write", { file_path: ".env.local" }],
  ["Edit", { file_path: "/home/u/.ssh/config" }],
  ["MultiEdit", { file_path: "/proj/.env" }],
  ["NotebookEdit", { notebook_path: "/home/u/.ssh/nb.ipynb" }],
  ["Grep", { pattern: "KEY", path: "/proj/.env" }],
  ["Grep", { pattern: "KEY", glob: ".env" }],
  ["Read", { file_path: "/p/.ENV" }],
  ["Read", { file_path: "SERVER.PEM" }],
  ["Read", { file_path: "/home/u/.SSH/config" }],
  ["Bash", { command: "cat .Env.Local" }],
  ["Bash", { command: "CAT .ENV" }],
  ["Bash", { command: "/bin/cat .env" }],
  ["Bash", { command: "cat {.env,notes.txt}" }],
  ["Grep", { pattern: "KEY", glob: "*.{env,pem}" }],
  ["Bash", { command: "cat {$&,.env}" }],
];

const CLAUDE_ALLOWED = [
  ["Bash", { command: "ls -la" }],
  ["Bash", { command: "cat .env.example" }],
  ["Bash", { command: "git push origin main" }],
  ["Bash", { command: "rm file.txt" }],
  ["Read", { file_path: ".env.example" }],
  ["Edit", { file_path: "src/app.js" }],
  ["Grep", { pattern: "token" }],
  ["Grep", { pattern: "token", path: "src", glob: "*.js" }],
  ["Grep", { pattern: "KEY", path: ".env.example" }],
  ["Grep", { pattern: "token", glob: "*.{js,ts}" }],
  ["Bash", { command: "/bin/ls -la" }],
  ["Bash", { command: "cat src/{a,b}.js" }],
  ["Bash", { command: "cat {$&,notes.txt}" }],
];

test("claude hook denies secret files, with a reason, for every file tool and for shell readers", () => {
  for (const [tool, input] of CLAUDE_DENIED) {
    const verdict = claudeVerdict(tool, input);
    assert.ok(verdict, `${tool} ${JSON.stringify(input)} must be denied`);
    assert.strictEqual(verdict.hookEventName, "PreToolUse");
    assert.strictEqual(verdict.permissionDecision, "deny", `${tool} ${JSON.stringify(input)}`);
    assert.match(verdict.permissionDecisionReason, /AGENTS\.md/);
  }
});

test("claude hook stays silent on ordinary calls", () => {
  for (const [tool, input] of CLAUDE_ALLOWED) {
    assert.strictEqual(claudeVerdict(tool, input), undefined, `${tool} ${JSON.stringify(input)}`);
  }
});

test("claude hook asks, natively, before destructive commands", () => {
  for (const command of GUARD_ASKED) {
    const verdict = claudeVerdict("Bash", { command });
    assert.ok(verdict, `${command} must be asked`);
    assert.strictEqual(verdict.permissionDecision, "ask", command);
    assert.match(verdict.permissionDecisionReason, /confirmation|sudo/i, command);
  }
});

test("a brace pattern with too many variants is refused quickly instead of expanding exponentially", () => {
  const { createMatcher } = require("../guard/core.js");
  const matcher = createMatcher(require("../guard/policy.json"));
  const started = Date.now();
  assert.strictEqual(matcher.readsSecret(`cat ${"{a,b}".repeat(30)}`), true);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
  assert.strictEqual(matcher.readsSecret(`cat ${"{a,b}".repeat(4)}`), false, "a small expansion is still allowed");
});

test("claude hook fails safe: input it cannot read blocks the call instead of letting it through", () => {
  for (const garbage of ["", "not json", "[]", JSON.stringify({ tool_name: "Bash" })]) {
    const res = runClaudeHook(garbage);
    assert.strictEqual(res.status, 2, `exit code for ${JSON.stringify(garbage)}`);
    assert.match(res.stderr, /lah-guard/);
  }
});

/** @param {string[]} args @param {string} home */
function runCliGuard(args, home) {
  return spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), ...args], {
    cwd: home,
    env: { ...process.env, LAH_FAKE_HOME: home, LAH_FAKE_CWD: home },
    encoding: "utf8",
  });
}

const GUARD_FILES = [
  [".pi", "agent", "extensions", "lah-guard", "index.js"],
  [".pi", "agent", "extensions", "lah-guard", "policy.json"],
  [".codex", "rules", "lah.rules"],
  [".claude", "hooks", "lah-guard", "index.js"],
  [".claude", "hooks", "lah-guard", "core.js"],
  [".claude", "hooks", "lah-guard", "policy.json"],
  [".claude", "settings.json"],
  [".config", "opencode", "opencode.json"],
];

test("--global --guard deploys the Pi extension, the Codex rules and the Claude Code hook; without it nothing is deployed", () => {
  const plain = tmpDir();
  assert.strictEqual(runCliGuard(["--global"], plain).status, 0);
  for (const file of GUARD_FILES) assert.strictEqual(fs.existsSync(path.join(plain, ...file)), false, `${file.join("/")} without --guard`);

  const guarded = tmpDir();
  const res = runCliGuard(["--global", "--guard"], guarded);
  assert.strictEqual(res.status, 0, res.stderr);
  for (const file of GUARD_FILES) assert.ok(fs.existsSync(path.join(guarded, ...file)), `${file.join("/")} with --guard`);
  assert.deepStrictEqual(
    fs.readFileSync(path.join(guarded, ".pi", "agent", "extensions", "lah-guard", "policy.json"), "utf8"),
    fs.readFileSync(path.join(PKG_ROOT, "guard", "policy.json"), "utf8"),
  );
});

const CLAUDE_HOOK_COMMAND = 'node "$HOME/.claude/hooks/lah-guard/index.js"';

/** @param {string} home @returns {any} */
const readClaudeSettings = (home) => JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8"));

/** @param {any} settings @returns {number} how many PreToolUse entries run the lah guard */
const lahEntries = (settings) =>
  (settings.hooks?.PreToolUse ?? []).filter((entry) => entry.hooks.some((hook) => hook.command === CLAUDE_HOOK_COMMAND)).length;

test("--global --guard registers the hook in a fresh ~/.claude/settings.json and the installed hook works", () => {
  const home = tmpDir();
  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  const settings = readClaudeSettings(home);
  assert.strictEqual(lahEntries(settings), 1);
  assert.strictEqual(settings.hooks.PreToolUse[0].matcher, "Read|Edit|Write|MultiEdit|NotebookEdit|Grep|Bash");
  const res = spawnSync(process.execPath, [path.join(home, ".claude", "hooks", "lah-guard", "index.js")], {
    input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: ".env" } }),
    encoding: "utf8",
  });
  assert.strictEqual(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("--guard merges into an existing settings.json: keeps everything, backs it up, and is idempotent", () => {
  const home = tmpDir();
  const settingsPath = path.join(home, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const original = {
    model: "opus",
    permissions: { allow: ["Bash(npm test)"] },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }], Stop: [{ hooks: [] }] },
  };
  fs.writeFileSync(settingsPath, JSON.stringify(original, null, 2));

  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  const merged = readClaudeSettings(home);
  assert.strictEqual(merged.model, "opus");
  assert.deepStrictEqual(merged.permissions, original.permissions);
  assert.deepStrictEqual(merged.hooks.Stop, original.hooks.Stop);
  assert.deepStrictEqual(merged.hooks.PreToolUse[0], original.hooks.PreToolUse[0]);
  assert.strictEqual(lahEntries(merged), 1);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(`${settingsPath}.bak`, "utf8")), original);

  const before = fs.readFileSync(settingsPath, "utf8");
  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  assert.strictEqual(fs.readFileSync(settingsPath, "utf8"), before, "second run must not change settings.json");
  assert.strictEqual(fs.existsSync(`${settingsPath}.bak.1`), false, "second run must not create another backup");
});

test("--guard refuses a settings.json that is valid JSON but not an object, with a clear message", () => {
  for (const content of ["null", "[]", "42"]) {
    const home = tmpDir();
    const settingsPath = path.join(home, ".claude", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, content);
    const res = runCliGuard(["--global", "--guard"], home);
    assert.strictEqual(res.status, 1, content);
    assert.match(res.stderr, /settings\.json is not a JSON object/, content);
    assert.strictEqual(fs.readFileSync(settingsPath, "utf8"), content);
    assert.strictEqual(fs.existsSync(`${settingsPath}.bak`), false, content);
  }
});

test("--guard refuses to touch a settings.json that is not valid JSON", () => {
  const home = tmpDir();
  const settingsPath = path.join(home, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, "{ not json");
  const res = runCliGuard(["--global", "--guard"], home);
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /settings\.json/);
  assert.strictEqual(fs.readFileSync(settingsPath, "utf8"), "{ not json");
  assert.strictEqual(fs.existsSync(`${settingsPath}.bak`), false);
});

test("the OpenCode permissions are rendered from the policy: secrets denied with the example allowed last, commands asked in every flag position", () => {
  const { renderOpenCode } = require("../guard/build.js");
  const { permission } = renderOpenCode(require("../guard/policy.json"));
  assert.deepStrictEqual(Object.keys(permission), ["read", "edit", "bash"]);
  for (const tool of ["read", "edit"]) {
    const rules = permission[tool];
    for (const pattern of ["*.env", "*.env.*", "*.pem", "*.key", "*id_rsa", "*/.ssh/*"]) {
      assert.strictEqual(rules[pattern], "deny", `${tool} ${pattern}`);
    }
    assert.strictEqual(rules["*.env.example"], "allow");
    const order = Object.keys(rules);
    assert.ok(order.indexOf("*.env.example") > order.indexOf("*.env.*"), "the last matching rule wins, so the exception goes after the denies");
  }
  assert.deepStrictEqual(permission.edit, permission.read);
  for (const pattern of ["rm -rf *", "rm * -r", "rm * -r *", "git reset --hard", "git reset --hard *", "git push --force", "git push * --force", "sudo", "sudo *"]) {
    assert.strictEqual(permission.bash[pattern], "ask", pattern);
  }
  assert.ok(Object.values(permission.bash).every((decision) => decision === "ask" || decision === "deny"));
});

test("the committed OpenCode permission file is generated from the policy", () => {
  const { renderOpenCode } = require("../guard/build.js");
  const committed = fs.readFileSync(path.join(PKG_ROOT, "guard", "opencode", "permission.json"), "utf8");
  assert.strictEqual(committed, `${JSON.stringify(renderOpenCode(require("../guard/policy.json")), null, 2)}\n`, "run `node guard/build.js`");
});

/** @param {string} home @returns {string} */
const opencodeConfigPath = (home) => path.join(home, ".config", "opencode", "opencode.json");

/** @param {string} home @param {unknown} content */
function writeOpencodeConfig(home, content) {
  fs.mkdirSync(path.dirname(opencodeConfigPath(home)), { recursive: true });
  fs.writeFileSync(opencodeConfigPath(home), typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

test("--global --guard creates ~/.config/opencode/opencode.json with the permissions", () => {
  const home = tmpDir();
  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  const { permission } = JSON.parse(fs.readFileSync(opencodeConfigPath(home), "utf8"));
  assert.strictEqual(permission.read["*.env"], "deny");
  assert.strictEqual(permission.bash["rm -rf *"], "ask");
});

test("--guard merges the OpenCode permissions: keeps the user's rules, ours win, a text permission becomes an object", () => {
  const home = tmpDir();
  const original = {
    model: "anthropic/x",
    permission: { "*": "ask", bash: { "npm *": "allow", "git push --force": "allow", "git *": "allow" }, read: "allow" },
  };
  writeOpencodeConfig(home, original);
  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  const merged = JSON.parse(fs.readFileSync(opencodeConfigPath(home), "utf8"));
  assert.strictEqual(merged.model, "anthropic/x");
  assert.strictEqual(merged.permission["*"], "ask");
  assert.strictEqual(merged.permission.bash["npm *"], "allow");
  const order = Object.keys(merged.permission.bash);
  assert.strictEqual(merged.permission.bash["git push --force"], "ask", "our rule replaces the user's allow");
  assert.ok(order.indexOf("git push --force") > order.indexOf("git *"), "ours come last so they win");
  assert.strictEqual(merged.permission.read["*"], "allow", "read: \"allow\" becomes {\"*\": \"allow\"}");
  assert.strictEqual(merged.permission.read["*.env"], "deny");
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(`${opencodeConfigPath(home)}.bak`, "utf8")), original);

  const before = fs.readFileSync(opencodeConfigPath(home), "utf8");
  assert.strictEqual(runCliGuard(["--global", "--guard"], home).status, 0);
  assert.strictEqual(fs.readFileSync(opencodeConfigPath(home), "utf8"), before, "second run must not change opencode.json");
  assert.strictEqual(fs.existsSync(`${opencodeConfigPath(home)}.bak.1`), false, "second run must not create another backup");
});

test("--guard refuses an opencode.json that is not a valid JSON object, and leaves it untouched", () => {
  for (const content of ["{ not json", "[]", "null"]) {
    const home = tmpDir();
    writeOpencodeConfig(home, content);
    const res = runCliGuard(["--global", "--guard"], home);
    assert.strictEqual(res.status, 1, content);
    assert.match(res.stderr, /opencode\.json/, content);
    assert.strictEqual(fs.readFileSync(opencodeConfigPath(home), "utf8"), content);
    assert.strictEqual(fs.existsSync(`${opencodeConfigPath(home)}.bak`), false, content);
  }
});

test("--guard without --global is rejected: project extensions only load after the project is trusted", () => {
  const cli = runCliGuard(["--guard"], tmpDir());
  assert.strictEqual(cli.status, 1);
  assert.match(cli.stderr, /--guard requiere --global/);
  const sh = spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--local", "--all", "--guard"], {
    cwd: tmpDir(),
    env: { ...process.env, LAH_SOURCE: PKG_ROOT },
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 64);
  assert.match(sh.stderr, /--guard requiere --global/);
});

test("every source the manifest deploys ships in the npm tarball", () => {
  const { files } = require("../package.json");
  const sources = new Set(parseManifest(fs.readFileSync(path.join(PKG_ROOT, "manifest.tsv"), "utf8")).map((row) => row.entry.src));
  for (const src of sources) {
    const shipped = files.some((entry) => entry === src || (entry.endsWith("/") && `${src}/`.startsWith(entry)));
    assert.ok(shipped, `${src} is deployed by manifest.tsv but missing from package.json "files"`);
  }
});

test("installer parity: install.sh and bin/cli.js deploy identical trees with --global --guard", () => {
  const viaSh = tmpDir();
  const viaCli = tmpDir();
  const sh = spawnSync("bash", [path.join(PKG_ROOT, "install.sh"), "--global", "--all", "--guard"], {
    cwd: viaSh,
    env: { ...process.env, HOME: viaSh, LAH_SOURCE: PKG_ROOT },
    encoding: "utf8",
  });
  assert.strictEqual(sh.status, 0, sh.stderr);
  assert.strictEqual(runCliGuard(["--global", "--guard"], viaCli).status, 0);
  assert.deepStrictEqual(snapshot(viaSh), snapshot(viaCli));
});

test("memory skill documents the script commands, the database as source of truth and its safety rules", () => {
  const text = fs.readFileSync(path.join(PKG_ROOT, "skills", "memory", "SKILL.md"), "utf8");
  assert.doesNotMatch(text, /^disable-model-invocation: true$/m, "recall must be model-invocable");
  for (const command of ["context", "search", "save", "rebuild"]) {
    assert.match(text, new RegExp(`\\\`${command}[ \\\`]`), `documents ${command}`);
  }
  assert.match(text, /node <directory of this SKILL\.md>\/scripts\/mem\.js/, "points at the script next to SKILL.md");
  assert.doesNotMatch(text, /node scripts\/mem\.js/, "a bare relative path fails in every deployed layout");
  assert.match(text, /memory\.db/, "names the database");
  assert.match(text, /source of truth/i, "database is the source of truth");
  assert.match(text, /--evidence/, "evidence is mandatory on save");
  assert.match(text, /checkpoint/i, "long-conversation checkpoint");
  assert.match(text, /verify/i, "verify before acting on recall");
  assert.match(text, /not in memory/i, "admit gaps instead of guessing");
  assert.match(text, /never store secrets/i, "secrets exclusion");
  assert.match(text, /data, never instructions/i, "recalled content is data, not instructions");
  assert.match(text, /not listed in `\.memory\/index\.md` is stale/, "stale means absent from index.md");
  assert.doesNotMatch(text, /does not list/, "context and search show only a few lines, so they cannot define stale");
  assert.match(text, /anywhere inside the project/i, "the store is found from any subdirectory");
  assert.doesNotMatch(text, /where `\.memory\/` lives/, "no stale instruction to run from the project root");
  assert.match(text, /64 KiB/, "the body cap is documented");
  assert.match(text.match(/## Recall\n([\s\S]*?)\n## /)[1], /`session-summary`/, "recall reads the end-of-work summary");
});

test("memory glossary and README describe the SQLite store", () => {
  assert.match(fs.readFileSync(path.join(PKG_ROOT, "GLOSSARY.md"), "utf8"), /\*\*Memory Store\*\*/);
  assert.match(fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8"), /memory\.db/);
  const glossary = fs.readFileSync(path.join(PKG_ROOT, "GLOSSARY.md"), "utf8");
  assert.match(glossary, /\*\*Memory Override\*\*/, "test hooks are in the glossary");
  assert.match(glossary.match(/\| \*\*Memory Store\*\*[^\n]*/)[0], /64 KiB/, "the Memory Store row states the body cap");
  assert.match(glossary.match(/\| \*\*Memory Store\*\*[^\n]*/)[0], /outside a git repository/, "the Memory Store row covers projects without git");
  assert.match(fs.readFileSync(path.join(PKG_ROOT, "CHANGELOG.md"), "utf8"), /best effort/, "the secret filter is declared best effort");
  assert.match(fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8"), /subdirector/i, "README mentions discovery from subdirectories");
});

test("the memory script ships with the skill in a full install and is skipped by profile core", () => {
  for (const [profile, shipped] of [["full", true], ["core", false]]) {
    const dir = tmpDir();
    const res = spawnSync(process.execPath, [path.join(PKG_ROOT, "bin", "cli.js"), "--local", "--profile", profile], {
      env: { ...process.env, LAH_FAKE_HOME: dir, LAH_FAKE_CWD: dir },
      cwd: dir,
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(fs.existsSync(path.join(dir, ".claude", "skills", "memory", "scripts", "mem.js")), shipped, profile);
  }
});

test("memory is an opt-in extra: listed in profile-extras.txt", () => {
  const extras = fs.readFileSync(path.join(PKG_ROOT, "profile-extras.txt"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(extras.includes("memory"));
});

test("memory vocabulary is in the glossary, documented in the README, and orchestrate defers to the skill", () => {
  const glossary = fs.readFileSync(path.join(PKG_ROOT, "GLOSSARY.md"), "utf8");
  assert.match(glossary, /\*\*Memory Entry\*\*/);
  assert.match(glossary, /\*\*Topic Key\*\*/);
  const readme = fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8");
  assert.match(readme, /`memory`/, "README documents the memory skill");
  const orchestrate = fs.readFileSync(path.join(PKG_ROOT, "skills", "orchestrate", "SKILL.md"), "utf8");
  assert.match(orchestrate, /`memory` skill/, "orchestrate saves the summary through the memory skill");
  assert.doesNotMatch(orchestrate, /Evidence:/, "entry format lives only in the memory skill");
});

test("Node minimum is the supported LTS floor and is documented", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
  assert.strictEqual(pkg.engines.node, ">=24.0.0");
  const readme = fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8");
  assert.match(readme, /Node\.js 24/, "README states the requirement");
  assert.match(fs.readFileSync(path.join(PKG_ROOT, "CHANGELOG.md"), "utf8"), /Node\.js 24/, "CHANGELOG announces the new minimum");
});

test("release metadata agrees: package version, install example and latest changelog heading", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
  const readme = fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8");
  const changelog = fs.readFileSync(path.join(PKG_ROOT, "CHANGELOG.md"), "utf8");
  assert.strictEqual(pkg.version, changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)[1], "package.json carries the version of the latest changelog release");
  assert.ok(readme.includes(`LAH_VERSION=${pkg.version} `), "the pinned-install example uses the current version");
  assert.match(changelog, /^## \[Unreleased\]\n/m, "the changelog keeps an Unreleased section");
});
