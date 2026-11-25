"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
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
