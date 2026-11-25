"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { PKG_ROOT } = require("../bin/cli.js");

const SKILLS = path.join(PKG_ROOT, "skills");
const CHECK = path.join(SKILLS, "diagram-design", "scripts", "check.js");
const TEMPLATE = path.join(SKILLS, "diagram-design", "references", "template.md");
const NS = "http://www.w3.org/2000/svg";

/** @param {string} dir @returns {string[]} every Markdown file under dir */
function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(full);
    }
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

test("no fenced markup block in a skill carries a Markdown link inside an attribute", () => {
  const offenders = [];
  for (const file of markdownFiles(SKILLS)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    let fenced = false;
    lines.forEach((line, index) => {
      if (line.startsWith("```")) {
        fenced = !fenced;
      } else if (fenced && /="\[https?:/.test(line)) {
        offenders.push(`${path.relative(PKG_ROOT, file)}:${index + 1}`);
      }
    });
  }
  assert.deepStrictEqual(offenders, []);
});
