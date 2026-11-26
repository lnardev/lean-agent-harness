"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const SKILLS = path.join(PKG_ROOT, "skills");

/** @param {string} name @returns {string} the SKILL.md of a skill */
function skill(name) {
  return fs.readFileSync(path.join(SKILLS, name, "SKILL.md"), "utf8");
}

/** @param {string} name @returns {string} the SKILL.md body, without the frontmatter */
function body(name) {
  return skill(name).replace(/^---\n[\s\S]*?\n---\n/, "");
}

test("every SKILL.md ends with a newline", () => {
  const missing = fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !skill(entry.name).endsWith("\n"))
    .map((entry) => entry.name);
  assert.deepStrictEqual(missing, []);
});

test("diagnosing-bugs defers to the Circuit Breaker of AGENTS.md instead of restating its revert", () => {
  const text = skill("diagnosing-bugs");
  assert.match(text, /Circuit Breaker from `AGENTS\.md`/);
  assert.doesNotMatch(text, /git checkout --/);
});

test("db-migration covers SQLite, whose ALTER TABLE needs a rebuild for type and constraint changes", () => {
  const text = body("db-migration");
  assert.match(text, /SQLite/);
  assert.match(text, /rebuild/i);
  assert.match(text, /3\.35/, "DROP COLUMN needs SQLite 3.35");
  assert.match(text, /PRAGMA foreign_keys=OFF/, "the rebuild disables foreign keys outside the transaction");
});

test("commit deletes the task file only after the last commit of the plan", () => {
  assert.match(skill("commit"), /after the last commit of the plan, delete `\.tasks\/current\.md`/i);
});

test("memory explains the WARNING line that context prints for a git-tracked store", () => {
  const text = skill("memory");
  assert.match(text, /WARNING: memory\.db is tracked by git/);
  assert.match(text, /unverified/i);
});

test("plan-flow gives each slice acceptance criteria, and a high-risk one its compatibility and release rollback", () => {
  const template = body("plan-flow").split("## Output format")[1];
  const fields = template.slice(template.indexOf("**Risk:**"), template.indexOf("**RED:**"));
  assert.match(fields, /^\* \*\*Acceptance:\*\* .*test or command/m);
  assert.match(fields, /^\* \*\*Compatibility \(high risk\):\*\* .*each has a test passing before and after$/m);
  assert.match(fields, /^\* \*\*Release rollback \(high risk\):\*\* .*or why none can$/m);
});

test("the orchestrate Definition of Done checks acceptance always, compatibility and release rollback at high risk", () => {
  const gate = body("orchestrate").split("## Definition of Done")[1].split("\n## ")[0];
  assert.match(gate, /^\* Every \*\*Acceptance\*\* item holds; high risk: \*\*Compatibility\*\* tests pass, \*\*Release rollback\*\* still fits the diff\.$/m);
});

test("no workflow skill names a bare Rollback field, which would collide with the Slice rollback of AGENTS.md", () => {
  for (const name of ["plan-flow", "orchestrate"]) {
    assert.doesNotMatch(skill(name), /\*\*Rollback/, name);
  }
});

test("the glossary defines acceptance criteria and release rollback", () => {
  const glossary = fs.readFileSync(path.join(PKG_ROOT, "GLOSSARY.md"), "utf8");
  for (const term of ["Acceptance Criteria", "Release Rollback"]) {
    assert.match(glossary, new RegExp(`^\\| \\*\\*${term}\\*\\* \\|`, "m"), term);
  }
});

const FRONTMATTER_KEYS = new Set(["name", "description", "argument-hint", "disable-model-invocation", "license", "metadata"]);
const UNSAFE_START = new Set(["`", "@", "%", "*", ",", "|", ">", "!", "&", "[", "{"]);

/** @returns {string[]} every skill folder name */
function skillNames() {
  return fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Flags frontmatter a strict YAML host could reject or misread.
 * @param {string} text a whole SKILL.md
 * @returns {string[]} one `rule: detail` per issue
 */
function frontmatterIssues(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (block === null) return ["frontmatter: missing"];
  /** @type {string[]} */
  const issues = [];
  for (const line of block[1].split("\n")) {
    if (line.includes("\t")) {
      issues.push(`tab: ${line}`);
      continue;
    }
    const pair = line.match(/^([a-z-]+): (.+)$/);
    if (pair === null) {
      issues.push(`shape: ${line}`);
      continue;
    }
    const [, key, value] = pair;
    if (!FRONTMATTER_KEYS.has(key)) issues.push(`key: ${key}`);
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      if (value.length < 2 || !value.endsWith(quote)) issues.push(`quote: ${key}`);
    } else if (UNSAFE_START.has(quote)) {
      issues.push(`unsafe-start: ${key}`);
    } else if (value.includes(": ") || value.includes(" #")) {
      issues.push(`unsafe-char: ${key}`);
    }
  }
  return issues;
}

/** @param {string} text @returns {string} text without fenced code blocks */
function withoutFences(text) {
  return text.replace(/^```[\s\S]*?^```/gm, "");
}

/**
 * Lists links in a skill that point outside its folder: a per-skill install copies only that folder.
 * @param {string} dir a skill folder
 * @returns {string[]} `file: target` per escaping link
 */
function escapingLinks(dir) {
  const refs = path.join(dir, "references");
  const files = ["SKILL.md", ...(fs.existsSync(refs) ? fs.readdirSync(refs).map((name) => path.join("references", name)) : [])];
  /** @type {string[]} */
  const escaping = [];
  for (const file of files.filter((name) => name.endsWith(".md"))) {
    const text = withoutFences(fs.readFileSync(path.join(dir, file), "utf8"));
    const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]).filter((target) => !/^(https?:|mailto:|#)/.test(target));
    for (const target of links) {
      const resolved = path.resolve(path.dirname(path.join(dir, file)), target.split("#")[0]);
      if (path.relative(dir, resolved).startsWith("..")) escaping.push(`${file}: ${target}`);
    }
  }
  return escaping;
}

test("frontmatterIssues flags YAML a strict host rejects or misreads", () => {
  const doc = (/** @type {string} */ lines) => `---\n${lines}\n---\nbody\n`;
  assert.deepStrictEqual(frontmatterIssues(doc("name: x\ndescription: fine text. Use when y.")), []);
  assert.deepStrictEqual(frontmatterIssues(doc('argument-hint: "[low|high] [target]"')), []);
  assert.deepStrictEqual(frontmatterIssues("no frontmatter"), ["frontmatter: missing"]);
  assert.deepStrictEqual(frontmatterIssues(doc("argument-hint: [low|high] [target]")), ["unsafe-start: argument-hint"]);
  assert.deepStrictEqual(frontmatterIssues(doc("description: `plan-flow` helper")), ["unsafe-start: description"]);
  assert.deepStrictEqual(frontmatterIssues(doc("description: note: this breaks")), ["unsafe-char: description"]);
  assert.deepStrictEqual(frontmatterIssues(doc('description: "open')), ["quote: description"]);
  assert.deepStrictEqual(frontmatterIssues(doc("\tname: x")), ["tab: \tname: x"]);
  assert.deepStrictEqual(frontmatterIssues(doc("model: opus")), ["key: model"]);
});

test("every SKILL.md frontmatter is strict-YAML safe", () => {
  const issues = skillNames().flatMap((name) => frontmatterIssues(skill(name)).map((issue) => `${name}: ${issue}`));
  assert.deepStrictEqual(issues, []);
});

test("every SKILL.md frontmatter parses with a strict YAML parser when Ruby is available", (t) => {
  const probe = spawnSync("ruby", ["-ryaml", "-e", "0"], { encoding: "utf8", timeout: 30000 });
  if (probe.error !== undefined || probe.status !== 0) {
    t.skip("ruby with yaml is not on PATH");
    return;
  }
  const script = 'ARGV.each { |f| fm = File.read(f)[/\\A---\\n(.*?)\\n---\\n/m, 1]; h = YAML.safe_load(fm); h.each { |k, v| abort("#{f}: #{k} is not a string") unless v.is_a?(String) || v == true || v.is_a?(Hash) } }';
  const files = skillNames().map((name) => path.join(SKILLS, name, "SKILL.md"));
  const res = spawnSync("ruby", ["-ryaml", "-e", script, ...files], { encoding: "utf8", timeout: 30000 });
  assert.strictEqual(res.status, 0, res.stderr);
});

test("model-invoked skills say when to use them; explicit-only skills say so", () => {
  const wrong = skillNames().filter((name) => {
    const text = skill(name);
    const description = text.match(/^description: (.*)$/m)?.[1] ?? "";
    const explicit = /^disable-model-invocation: true$/m.test(text);
    return explicit ? !/Invoke explicitly/.test(description) : !/Use when /.test(description);
  });
  assert.deepStrictEqual(wrong, []);
});

test("escapingLinks flags links that leave the skill folder and ignores fenced examples", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lah-skill-"));
  fs.mkdirSync(path.join(dir, "references"));
  fs.writeFileSync(path.join(dir, "SKILL.md"), "See [a](references/a.md), [web](https://x.dev) and [up](../other/SKILL.md).\n```\n[fenced](../ignored.md)\n```\nPath traversal (`../`) is prose.\n");
  fs.writeFileSync(path.join(dir, "references", "a.md"), "[back](../SKILL.md) [out](../../escape.md)\n");
  try {
    assert.deepStrictEqual(escapingLinks(dir), ["SKILL.md: ../other/SKILL.md", "references/a.md: ../../escape.md"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no skill links outside its own folder", () => {
  assert.deepStrictEqual(skillNames().flatMap((name) => escapingLinks(path.join(SKILLS, name)).map((link) => `${name}: ${link}`)), []);
});
