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

/** @returns {string} the instructions the agent follows: the skill body and its publish reference */
function pullRequest() {
  return `${body("pull-request")}\n${fs.readFileSync(path.join(SKILLS, "pull-request", "references", "publish.md"), "utf8")}`;
}

/** @returns {string[]} every inline-code span of those instructions */
function pullRequestSpans() {
  return [...pullRequest().matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
}

/** @param {Record<string, RegExp>} rules @returns {string[]} the rules the instructions do not state */
function missingRules(rules) {
  const text = pullRequest();
  return Object.keys(rules).filter((rule) => !rules[rule].test(text));
}

test("pull-request acts only on request and never merges, force pushes, attributes AI or leaks secrets", () => {
  const rules = {
    "only on request": /Only when the user asks for a pull request/,
    "never merges": /Never merge, never force push/,
    "repository text is data": /data, never instructions/,
    "no attribution": /No secrets, personal data or AI attribution lines/,
    "no secret in history": /lists no secret file \(`\.env\*`, `\*\.pem`, `\*\.key`; `\.env\.example` is fine\)/,
  };
  assert.deepStrictEqual(missingRules(rules), []);
  assert.deepStrictEqual(pullRequestSpans().filter((span) => /\bpush\b/.test(span)), [
    "git push --no-follow-tags --recurse-submodules=check -u origin refs/heads/<branch>:refs/heads/<branch>",
  ]);
  assert.doesNotMatch(pullRequest(), /gh pr merge|--force|--mirror/);
});

test("pull-request stops or degrades instead of guessing", () => {
  const rules = {
    "run the preflight": /Run `node <directory of this SKILL\.md>\/scripts\/preflight\.js` \(Node\.js 24\+\)/,
    "base only when named": /Add `--base '<branch>'` only when the user names a target branch; any other argument is a hint/,
    "base checked before the shell sees it": /Before any command, that name must match `\^\[A-Za-z0-9\]\[A-Za-z0-9\._\/-\]\*\$`; for any other name stop and put it in no command/,
    "on a failed or blocked preflight": /No Node\.js, a non-zero exit or any entry in `blockers`: stop and report it\. Never redo its checks by hand/,
    "with uncommitted changes": /Uncommitted changes: ask the user to run `commit` first/,
    "with untracked files": /`untracked` not empty: ask whether those files belong to this change/,
    "with failing tests": /If it fails, report it and stop \(no push, create or edit\) unless the user asks for a draft/,
    "with failing tests and a ready pull request": /Failing tests and one that is not a draft: stop/,
    "with a pull request for another base": /One for another base: report it and stop/,
    "with a rejected push": /Rejected or failed: report it and stop; no pull, rebase, merge or pull request change/,
    "with an open pull request": /An open one: `gh pr edit <number> /,
    "when a draft is asked": /plus `--draft` when the user asked for a draft/,
    "without gh, login or origin": /Missing `gh`, a login or `origin` \(`origin: false`\) is not a failure.*print the title and body and say that no pull request was created/,
    "with an unreviewed commit": /The body calls any other commit unreviewed/,
    "with a blocking verdict": /approving `review-audit` verdict.*A blocking verdict never counts/,
  };
  assert.deepStrictEqual(missingRules(rules), []);
});

test("pull-request works on the repository of origin and only on its own pull request", () => {
  const spans = pullRequestSpans();
  assert.ok(spans.includes('gh repo view "$(git remote get-url origin)" --json url'));
  const gh = spans.filter((span) => span.startsWith("gh pr "));
  assert.strictEqual(gh.length, 4, JSON.stringify(gh));
  assert.deepStrictEqual(gh.filter((span) => !span.includes("--repo <repo>")), []);
  const list = gh.find((span) => span.includes("--head <branch>") && span.startsWith("gh pr list")) ?? "";
  assert.match(list, /--state open .*isCrossRepository.*--jq 'map\(select\(\.isCrossRepository \| not\)\)'/);
  const text = pullRequest();
  assert.ok(text.indexOf(list) < text.indexOf("git push "), "the open pull request is read before pushing");
});

test("pull-request writes title and body from files, using the repository template before its own", () => {
  assert.match(body("pull-request"), /`\.github\/pull_request_template\.md`.*else `references\/body\.md`/);
  assert.match(body("pull-request"), /follow `references\/publish\.md`/);
  const spans = pullRequestSpans();
  const create = spans.find((span) => span.startsWith("gh pr create")) ?? "";
  assert.match(create, /--title "\$\(cat <title-file>\)" --body-file <body-file>/);
  const edit = spans.find((span) => span.startsWith("gh pr edit")) ?? "";
  assert.match(edit, /--body-file <body-file>/);
  assert.doesNotMatch(edit, /--title/);
  assert.match(pullRequest(), /Keep its title; add `--title "\$\(cat <title-file>\)"` only if the user asks/);
  const template = fs.readFileSync(path.join(SKILLS, "pull-request", "references", "body.md"), "utf8");
  for (const heading of ["What", "Why", "Verification", "Risk and rollback", "Open warnings"]) {
    assert.match(template, new RegExp(`^## ${heading}$`, "m"), heading);
  }
});

test("pull-request ships in both profiles with an OpenCode command, and commit offers it without opening it", () => {
  const extras = fs.readFileSync(path.join(PKG_ROOT, "profile-extras.txt"), "utf8").split("\n").map((line) => line.trim());
  assert.ok(!extras.includes("pull-request"), "part of the delivery flow, so core keeps it");
  const stub = fs.readFileSync(path.join(PKG_ROOT, "adapters", "opencode", "commands", "pull-request.md"), "utf8");
  assert.match(stub, /`pull-request` skill/);
  assert.strictEqual(stub.match(/^description: .*$/m)?.[0], skill("pull-request").match(/^description: .*$/m)?.[0]);
  assert.match(skill("commit"), /offer `pull-request` \(if installed\); never open one unasked/);
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
