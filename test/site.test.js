"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { PKG_ROOT } = require("../bin/cli.js");

const SITE = path.join(PKG_ROOT, "docs");
const SITE_URL = "https://lnardev.github.io/lean-agent-harness/";
const WORKFLOW = ["plan-flow", "orchestrate", "review-audit", "commit"];
const TOOLS = ["Claude Code", "Pi", "OpenCode", "Codex", "Cursor", "Copilot", "CommandCode"];
const INSTALL = [
  "npx lean-agent-harness",
  "npx lean-agent-harness --global",
  "curl -fsSL https://raw.githubusercontent.com/lnardev/lean-agent-harness/main/install.sh | bash",
];
const EXTERNAL = ["https://github.com/lnardev/lean-agent-harness", "https://www.npmjs.com/package/lean-agent-harness", "https://agentskills.io"];

/** @param {string} file path inside the package @returns {string} its text */
function read(file) {
  return fs.readFileSync(path.join(PKG_ROOT, file), "utf8");
}

/** @returns {string} the landing page */
function page() {
  return read("docs/index.html");
}

/** @returns {string} the text a visitor reads: no tags, single spaces */
function visibleText() {
  return page().replace(/<head>[\s\S]*<\/head>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** @returns {string[]} every skill folder of the package, sorted */
function skillNames() {
  return fs
    .readdirSync(path.join(PKG_ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** @returns {{name: string, extra: boolean, body: string}[]} the skill cards of the page */
function skillCards() {
  return [...page().matchAll(/<article class="skill" data-skill="([a-z-]+)"( data-extra)?>([\s\S]*?)<\/article>/g)].map((found) => ({
    name: found[1],
    extra: Boolean(found[2]),
    body: found[3],
  }));
}

/** @param {RegExp} pattern a global pattern with one group @returns {string[]} the group of every match in the page */
function inPage(pattern) {
  return [...page().matchAll(pattern)].map((found) => found[1]);
}

test("the site has one card per skill folder, each saying what it does and when to use it", () => {
  const cards = skillCards();
  assert.deepStrictEqual(cards.map((card) => card.name).sort(), skillNames());
  for (const card of cards) {
    assert.ok(card.body.includes(`<code>${card.name}</code>`), `${card.name}: shows its name`);
    assert.match(card.body, /<p class="what">[^<]{10,}<\/p>/, card.name);
    assert.match(card.body, /<p class="when">[\s\S]{10,}?<\/p>/, card.name);
  }
});

test("the site marks exactly the profile extras and counts the skills correctly", () => {
  const extras = read("profile-extras.txt").split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const marked = skillCards().filter((card) => card.extra);
  assert.deepStrictEqual(marked.map((card) => card.name).sort(), extras.sort());
  assert.ok(marked.every((card) => card.body.includes('<span class="tag">extra</span>')), "an extra says so");
  const counts = [...visibleText().matchAll(/\b(\d+) skills\b/g)].map((found) => Number(found[1]));
  assert.ok(counts.length > 0, "the page says how many skills there are");
  assert.deepStrictEqual(counts.filter((count) => count !== skillNames().length), []);
});

test("the site names the workflow commands, the tools and the README's install commands", () => {
  for (const name of WORKFLOW) {
    assert.ok(page().includes(`<code>/${name}</code>`), name);
  }
  assert.match(visibleText(), /pull-request[^.]*\.[^.]*never merges/i);
  for (const tool of TOOLS) {
    assert.match(visibleText(), new RegExp(`\\b${tool}\\b`), tool);
  }
  for (const command of INSTALL) {
    assert.ok(read("README.md").includes(command), `README: ${command}`);
    assert.ok(page().includes(`<pre data-copy><code>${command}</code></pre>`), command);
  }
  assert.match(visibleText(), /Node\.js 24/);
});

test("the site has the page basics and working in-page links", () => {
  const html = page();
  assert.match(html, /^<!doctype html>\n<html lang="en">/);
  assert.strictEqual(html.match(/<h1[ >]/g)?.length, 1, "one h1");
  assert.match(html, /<title>[^<]+<\/title>/);
  for (const meta of ['name="description"', 'name="viewport"', 'property="og:title"', 'property="og:description"']) {
    assert.match(html, new RegExp(`<meta ${meta} content="[^"]+">`), meta);
  }
  assert.ok(html.includes('<a class="skip" href="#main">'), "skip link");
  const ids = inPage(/\sid="([^"]+)"/g);
  assert.strictEqual(new Set(ids).size, ids.length, "ids are unique");
  assert.deepStrictEqual(inPage(/href="#([^"]*)"/g).filter((anchor) => !ids.includes(anchor)), []);
});

test("the site loads only its own files, by relative paths that exist", () => {
  const assets = [...inPage(/<script[^>]*\ssrc="([^"]+)"/g), ...inPage(/<link rel="(?:stylesheet|icon)" href="([^"]+)"/g), ...inPage(/<img[^>]*\ssrc="([^"]+)"/g)];
  const files = assets.filter((asset) => !asset.startsWith("data:"));
  assert.ok(files.length >= 2, "a stylesheet and a script");
  assert.deepStrictEqual(files.filter((asset) => /^(\/|[a-z]+:)/i.test(asset) || !fs.existsSync(path.join(SITE, asset))), []);
  assert.doesNotMatch(read("docs/styles.css"), /@import|url\(\s*["']?(https?:|\/\/)/);
  const links = inPage(/<a [^>]*href="([^#"][^"]*)"/g);
  assert.deepStrictEqual(links.filter((link) => !EXTERNAL.some((allowed) => link === allowed || link.startsWith(`${allowed}/`) || link.startsWith(`${allowed}#`))), []);
});

test("the site ships its own fonts, each family with its licence", () => {
  const css = read("docs/styles.css");
  const loaded = [...css.matchAll(/url\("(fonts\/[^"]+\.woff2)"\)/g)].map((found) => found[1]);
  const files = fs.readdirSync(path.join(SITE, "fonts"));
  assert.ok(loaded.length > 0, "the stylesheet loads its fonts");
  assert.deepStrictEqual([...new Set(loaded)].sort(), files.filter((name) => name.endsWith(".woff2")).map((name) => `fonts/${name}`).sort());
  const families = new Set([...css.matchAll(/@font-face \{\s*font-family: "([^"]+)"/g)].map((found) => found[1]));
  const licences = files.filter((name) => /^OFL-[a-z-]+\.txt$/.test(name));
  assert.strictEqual(licences.length, families.size);
  for (const name of licences) assert.match(read(`docs/fonts/${name}`), /SIL Open Font License, Version 1\.1/, name);
});

test("the favicon is the orange mark of the page header", () => {
  const icon = decodeURIComponent(inPage(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)">/g)[0] ?? "");
  const header = page().match(/<a class="brand"[\s\S]*?<\/svg>/)?.[0] ?? "";
  const paths = (/** @type {string} */ svg) => [...svg.matchAll(/ d=["']([^"']+)["']/g)].map((found) => found[1]);
  assert.ok(paths(header).length > 0, "the header has a mark");
  assert.deepStrictEqual(paths(icon), paths(header));
  const orange = read("docs/styles.css").match(/--orange: (#[0-9a-f]{6});/)?.[1];
  assert.ok(orange && icon.includes(`stroke='${orange}'`), "drawn in the page's orange");
  assert.doesNotMatch(icon, /<rect/);
});

test("the site explains the project memory with the commands the script really has", () => {
  const section = page().match(/<section id="memory"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(section, "has a memory section");
  assert.ok(page().includes('<a href="#memory">'), "the header links to it");
  const usage = read("skills/memory/scripts/mem.js").match(/const USAGE = "usage: mem\.js ([^"]+)"/)?.[1] ?? "";
  const commands = usage.split(" | ").map((part) => part.split(" ")[0]);
  const shown = [...section.matchAll(/<dt><code>([a-z]+)<\/code><\/dt>/g)].map((found) => found[1]);
  assert.ok(shown.length >= 4, "shows the commands");
  assert.deepStrictEqual(shown.filter((command) => !commands.includes(command)), []);
  const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const fact of [/extra/, /SQLite/, /\.memory\//, /\.gitignore/, /Node\.js 24/, /best effort/, /Claude Code/, /--memory-hook/, /Example entry/]) {
    assert.match(text, fact);
  }
});

test("the site claims no more than the harness does", () => {
  const text = visibleText();
  assert.match(text, /opt-in guard/i);
  assert.match(text, /not a sandbox/i);
  assert.doesNotMatch(text, /never (holds|stores|leaks) secrets/i);
  const fresh = text.split(/(?<=\.)\s/).filter((sentence) => /fresh context/i.test(sentence));
  assert.ok(fresh.length > 0, "the page mentions the fresh-context review");
  assert.deepStrictEqual(fresh.filter((sentence) => !/high-risk/i.test(sentence)), []);
});

test("the site stays out of the npm package and is served as plain files", () => {
  const shipped = JSON.parse(read("package.json")).files;
  assert.deepStrictEqual(shipped.filter((file) => file.startsWith("docs")), []);
  assert.ok(fs.existsSync(path.join(SITE, ".nojekyll")), "GitHub Pages must not run Jekyll");
  assert.ok(read("README.md").includes(SITE_URL), "the README links to the site");
});

test("the site is dark whatever the system prefers and works on narrow screens", () => {
  const css = read("docs/styles.css");
  assert.match(css, /:root \{\s*color-scheme: dark;/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(page(), /<meta name="color-scheme" content="dark">/);
  assert.match(css, /\npre \{[^}]*overflow-x: auto;/);
});

/**
 * Runs the site script against a minimal document with one command block.
 * @param {{writeText: (text: string) => Promise<void>} | undefined} clipboard
 */
function runScript(clipboard) {
  /** @type {{textContent: string, click?: () => void}[]} */
  const buttons = [];
  /** @type {(() => void)[]} */
  const timers = [];
  const block = { textContent: "npx lean-agent-harness\n", parentElement: { append: (/** @type {any} */ button) => buttons.push(button) } };
  const document = {
    querySelectorAll: () => [block],
    createElement: () => ({
      textContent: "",
      setAttribute: () => {},
      addEventListener(/** @type {string} */ _event, /** @type {() => void} */ handler) {
        this.click = handler;
      },
    }),
  };
  vm.runInNewContext(read("docs/site.js"), { document, navigator: { clipboard }, setTimeout: (/** @type {() => void} */ run) => timers.push(run) });
  return { buttons, timers };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("without JavaScript every command is plain text: the page has no button of its own", () => {
  assert.doesNotMatch(page(), /<button/);
});

test("the copy button copies the command and then resets its label", async () => {
  /** @type {string[]} */
  const copied = [];
  const { buttons, timers } = runScript({ writeText: async (text) => void copied.push(text) });
  assert.deepStrictEqual(buttons.map((button) => button.textContent), ["Copy"]);
  buttons[0].click?.();
  await settle();
  assert.deepStrictEqual([copied, buttons[0].textContent], [["npx lean-agent-harness"], "Copied"]);
  timers.forEach((run) => run());
  assert.strictEqual(buttons[0].textContent, "Copy");
});

test("a denied clipboard asks to select and copy, and no clipboard adds no button", async () => {
  const denied = runScript({ writeText: () => Promise.reject(new Error("denied")) });
  denied.buttons[0].click?.();
  await settle();
  assert.strictEqual(denied.buttons[0].textContent, "Select and copy");
  assert.deepStrictEqual(runScript(undefined).buttons, []);
});
