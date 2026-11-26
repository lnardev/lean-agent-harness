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

/** @returns {string[]} the skills that --profile core omits, sorted */
function profileExtras() {
  return read("profile-extras.txt")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .sort();
}

/** @returns {string[]} every skill folder of the package, sorted */
function skillNames() {
  return fs
    .readdirSync(path.join(PKG_ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * @param {string} text a section with skill tables
 * @returns {{name: string, folder: string, extra: boolean, cells: string[]}[]} one entry per skill row
 */
function skillRows(text) {
  return [...text.matchAll(/^\| \[`([a-z-]+)`\]\(skills\/([a-z-]+)\/SKILL\.md\)( \(extra\))? \|(.*)\|$/gm)].map((found) => ({
    name: found[1],
    folder: found[2],
    extra: Boolean(found[3]),
    cells: found[4].split("|").map((cell) => cell.trim()),
  }));
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
  const listed = README.match(/<summary><b>Profiles<\/b><\/summary>\n\n[^\n]*?\(([^)]*)\)/);
  assert.ok(listed, "the Profiles block opens by listing the skipped skills in parentheses");
  const names = [...listed[1].matchAll(/`([^`]+)`/g)].map((found) => found[1]);
  assert.deepStrictEqual(names.sort(), profileExtras());
});

test("every relative link of the README points to a file of the package", () => {
  const targets = [...README.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)/g)].map((found) => found[1]);
  assert.ok(targets.length > 0, "the README links to its files");
  assert.deepStrictEqual(targets.filter((target) => !fs.existsSync(path.join(PKG_ROOT, target))), []);
});

test("the skill catalog links every skill of the package once, with what it does and when to use it", () => {
  const rows = skillRows(section("Skills"));
  assert.deepStrictEqual(rows.map((row) => row.name).sort(), skillNames());
  for (const row of rows) {
    assert.strictEqual(row.folder, row.name, "the link points to the skill it names");
    assert.strictEqual(row.cells.length, 2, `${row.name}: two cells after the name`);
    assert.ok(row.cells.every(Boolean), `${row.name}: no empty cell`);
  }
});

test("the catalog separates workflow skills and marks exactly the profile extras", () => {
  const [workflow, domain] = section("Skills").split("\n### Domain\n");
  assert.ok(domain, "has a Domain group after the Workflow group");
  const explicit = skillNames().filter((name) => /^disable-model-invocation: true$/m.test(read(`skills/${name}/SKILL.md`)));
  assert.deepStrictEqual(skillRows(workflow).map((row) => row.name).sort(), explicit);
  const marked = skillRows(section("Skills")).filter((row) => row.extra).map((row) => row.name);
  assert.deepStrictEqual(marked.sort(), profileExtras());
});

test("the skill anatomy shows every subfolder that a skill uses", () => {
  const diagram = section("How it works").match(/```text\n([\s\S]*?)\n```/);
  assert.ok(diagram, "How it works has an anatomy diagram");
  const subfolders = skillNames().flatMap((name) =>
    fs.readdirSync(path.join(PKG_ROOT, "skills", name), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );
  assert.ok(diagram[1].includes("SKILL.md"));
  assert.deepStrictEqual([...new Set(subfolders)].filter((folder) => !diagram[1].includes(`${folder}/`)), []);
});

test("the project structure lists existing paths and covers everything the package ships", () => {
  const listed = [...section("Project structure").matchAll(/^\| `([^`]+)` \|/gm)].map((found) => found[1]);
  assert.ok(listed.length > 0, "the structure table has rows");
  assert.deepStrictEqual(listed.filter((entry) => !fs.existsSync(path.join(PKG_ROOT, entry))), []);
  const selfEvident = new Set(["README.md", "CHANGELOG.md", "LICENSE"]);
  const shipped = JSON.parse(read("package.json")).files.filter((file) => !selfEvident.has(file));
  const uncovered = shipped.filter((file) => !listed.some((entry) => file === entry || (entry.endsWith("/") && file.startsWith(entry))));
  assert.deepStrictEqual(uncovered, []);
});

test("every in-page link of the README points to a heading", () => {
  const slugs = [...README.matchAll(/^#{1,4} (.+)$/gm)].map((found) =>
    found[1].toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-"),
  );
  const anchors = [...README.matchAll(/\]\(#([^)]*)\)/g)].map((found) => found[1]);
  assert.ok(anchors.length > 0, "the README links to its sections");
  assert.deepStrictEqual(anchors.filter((anchor) => !slugs.includes(anchor)), []);
});

test("the release steps keep their commands", () => {
  const releasing = section("Releasing");
  for (const command of [
    'git tag "v$V" && git push origin "v$V"',
    `awk -v v="$V" 'index($0,"## ["v"]")==1{f=1;next} /^## \\[/{if(f)exit} f' CHANGELOG.md > "/tmp/notes-$V.md"`,
    'gh release create "v$V" --verify-tag --title "v$V" --notes-file "/tmp/notes-$V.md" --latest',
  ]) {
    assert.ok(releasing.includes(command), command);
  }
});
