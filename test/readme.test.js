"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { PKG_ROOT, parseManifest } = require("../bin/cli.js");
const { createMatcher } = require("../guard/core.js");

const README = fs.readFileSync(path.join(PKG_ROOT, "README.md"), "utf8");
const WORKFLOW = ["plan-flow", "orchestrate", "review-audit", "commit"];
const TOOLS = ["Claude Code", "Pi", "OpenCode", "Codex", "Cursor", "Copilot", "CommandCode"];
/** Which tool blocks must list the destinations of each manifest target (`core` is the project root). */
const TARGET_TOOLS = {
  claude: ["Claude Code"],
  agents: ["Pi", "OpenCode", "Codex", "Cursor", "Copilot"],
  pi: ["Pi"],
  opencode: ["OpenCode"],
  codex: ["Codex"],
  copilot: ["Copilot"],
  commandcode: ["CommandCode"],
};

/** @param {string} file path inside the package @returns {string} its text */
function read(file) {
  return fs.readFileSync(path.join(PKG_ROOT, file), "utf8");
}

/** @param {string} title @returns {string} the text under a `## title` heading, up to the next `## ` */
function section(title) {
  const heading = `\n## ${title}\n`;
  const start = README.indexOf(heading);
  assert.notStrictEqual(start, -1, `missing section: ${title}`);
  return README.slice(start + heading.length).split("\n## ")[0];
}

/** @param {string} title @returns {string} the body of the collapsible block with that summary */
function collapsible(title) {
  const summary = `<summary><b>${title}</b></summary>`;
  const start = README.indexOf(summary);
  assert.notStrictEqual(start, -1, `missing block: ${title}`);
  return README.slice(start + summary.length).split("</details>")[0];
}

/** @returns {ReturnType<typeof parseManifest>} the project and user rows of the manifest */
function installRows() {
  const rows = parseManifest(read("manifest.tsv")).filter((row) => row.scope === "local" || row.scope === "global");
  assert.ok(rows.length > 0, "the manifest has project and user rows");
  return rows;
}

/** @param {string} text @returns {string[]} its backticked paths without a trailing slash, sorted */
function quotedPaths(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((found) => found[1].replace(/\/$/, "")).sort();
}

test("the README opens with a lifecycle diagram naming the four workflow commands", () => {
  const intro = README.split("\n## ")[0];
  const diagram = intro.match(/```text\n([\s\S]*?)\n```/);
  assert.ok(diagram, "a text diagram comes before the first section");
  for (const name of WORKFLOW) {
    assert.ok(diagram[1].includes(`/${name}`), name);
  }
});

test("the command table has one row per workflow command", () => {
  const commands = section("Commands");
  for (const name of WORKFLOW) {
    assert.match(commands, new RegExp(`^\\| [^|]+\\| \`/${name}[^\`]*\` \\|`, "m"), name);
  }
});

test("quick start gives the install commands up front and one collapsible block per tool", () => {
  const quickStart = section("Quick start");
  const upFront = quickStart.split("\n### ")[0];
  assert.match(upFront, /^npx lean-agent-harness +#/m);
  assert.match(upFront, /^npx lean-agent-harness --global +#/m);
  for (const tool of TOOLS) {
    assert.ok(quickStart.includes(`<summary><b>${tool}</b></summary>`), tool);
  }
});

test("each tool block lists exactly the project and user destinations of the manifest", () => {
  const rows = installRows();
  const unmapped = rows.filter((row) => row.target !== "core" && !TARGET_TOOLS[row.target]).map((row) => row.target);
  assert.deepStrictEqual(unmapped, [], "every manifest target belongs to a tool block");
  const scopes = [["local", "Project", ""], ["global", "User (`--global`)", "~/"]];
  for (const tool of TOOLS) {
    for (const [scope, label, home] of scopes) {
      const prefix = `| ${label} | `;
      const line = collapsible(tool).split("\n").find((candidate) => candidate.startsWith(prefix));
      assert.ok(line, `${tool}: ${label} row`);
      const expected = rows
        .filter((row) => row.scope === scope && TARGET_TOOLS[row.target]?.includes(tool))
        .map((row) => home + row.entry.dest);
      assert.deepStrictEqual(quotedPaths(line.slice(prefix.length)), expected.sort(), `${tool}: ${label}`);
    }
  }
});

test("quick start names the root files a project install writes", () => {
  const paragraph = section("Quick start").split("\n").find((line) => line.startsWith("A project install writes"));
  assert.ok(paragraph, "the project install paragraph");
  for (const row of installRows().filter((candidate) => candidate.target === "core")) {
    assert.ok(paragraph.includes(`\`${row.entry.dest}\``), row.entry.dest);
  }
});

test("tool blocks never show an opt-in flag without --global, which both installers require", () => {
  for (const tool of TOOLS) {
    const rest = collapsible(tool).replace(/--global --(guard|memory-hook)/g, "");
    assert.doesNotMatch(rest, /--(guard|memory-hook)/, tool);
  }
});

test("the Cursor block says a global install adds no rule file and auto detection skips it", () => {
  const cursor = collapsible("Cursor");
  assert.match(cursor, /no rule file/);
  assert.match(cursor, /`install\.sh --auto` does not detect `~\/\.cursor`/);
});

test("the Guard block claims only what the guard code protects", () => {
  const guard = collapsible("Guard (opt-in)");
  const policy = JSON.parse(read("guard/policy.json"));
  const { isSecretPath, ruleHit } = createMatcher(policy);
  for (const name of [...policy.secrets.basenames, ...policy.secrets.except]) {
    assert.ok(guard.includes(`\`${name}\``), name);
  }
  for (const directory of policy.secrets.directories) {
    assert.ok(guard.includes(`\`${directory}/\``), directory);
  }
  assert.match(guard, /OpenCode denies reading and editing them, but not a shell command/);
  assert.match(guard, /Codex rules do not protect secrets/);
  const codexRules = read("guard/codex/lah.rules");
  assert.deepStrictEqual(policy.secrets.basenames.filter((name) => codexRules.includes(name)), []);
  assert.match(guard, /`\.envrc` is not matched/);
  assert.strictEqual(isSecretPath(".envrc"), false);
  const missed = guard.match(/such as ([^.]*?) are not seen/);
  assert.ok(missed, "names commands the guard does not see");
  const commands = [...missed[1].matchAll(/`([^`]+)`/g)].map((found) => found[1]);
  assert.ok(commands.length > 0, "gives examples");
  assert.deepStrictEqual(commands.filter((command) => ruleHit(command)), []);
});

test("every details block closes and renders its Markdown", () => {
  const lines = README.split("\n");
  const count = (tag) => lines.filter((line) => line === tag).length;
  assert.ok(count("<details>") > 0, "has collapsible blocks");
  assert.strictEqual(count("<details>"), count("</details>"));
  const glued = lines.filter((line, at) => line.startsWith("<summary>") && lines[at + 1] !== "");
  assert.deepStrictEqual(glued, [], "GitHub needs a blank line after the summary");
});

test("text diagrams fit in 80 columns", () => {
  const wide = [...README.matchAll(/```text\n([\s\S]*?)\n```/g)]
    .flatMap((block) => block[1].split("\n"))
    .filter((line) => [...line].length > 80);
  assert.deepStrictEqual(wide, []);
});

test("the core profile list matches profile-extras.txt", () => {
  const extras = fs
    .readFileSync(path.join(PKG_ROOT, "profile-extras.txt"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const listed = README.match(/<summary><b>Profiles<\/b><\/summary>\n\n[^\n]*?\(([^)]*)\)/);
  assert.ok(listed, "the Profiles block opens by listing the skipped skills in parentheses");
  const names = [...listed[1].matchAll(/`([^`]+)`/g)].map((found) => found[1]);
  assert.deepStrictEqual(names.sort(), extras.sort());
});

test("every relative link of the README points to a file of the package", () => {
  const targets = [...README.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)/g)].map((found) => found[1]);
  assert.ok(targets.length > 0, "the README links to its files");
  assert.deepStrictEqual(targets.filter((target) => !fs.existsSync(path.join(PKG_ROOT, target))), []);
});
