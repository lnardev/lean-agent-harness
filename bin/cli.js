#!/usr/bin/env node
"use strict";

/**
 * Lean Agent Harness — deployment CLI (npx).
 *
 * Manifest-driven installer: every supported environment is declared once in a
 * declarative table and deployed by a single engine. No per-platform copy-paste.
 *
 * Modes:
 *   (default) deploy into the current project
 *   --global  deploy into the user home (~/.claude, ~/.pi, ~/.config/opencode, ...)
 *
 * Flags: --help | -h | --version | -v | --global | -g
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const { version } = require("../package.json");

const PKG_ROOT = path.resolve(__dirname, "..");

/**
 * @typedef {Object} Target
 * @property {string} name        Human-readable label
 * @property {string} base        Destination base directory
 * @property {string[]} dirs      Package directories to mirror (agents/skills/commands)
 * @property {string[]} files     Instruction files; "SRC" or "SRC->DESTNAME" (relative to package root)
 */

/** @param {string} base @param {string[]} dirs @param {string[]} files @returns {Target} */
const target = (name, base, dirs, files) => ({ name, base, dirs, files });

/** Shared bundle shapes. */
const dirsCore = ["agents", "skills", "commands"];
const dirsClaude = ["commands", "skills"];

/** Declarative deployment manifest. */
const TARGETS = {
  local() {
    const cwd = process.env.LAH_FAKE_CWD || process.cwd();
    const proj = (rel) => path.join(cwd, rel);
    return [
      target("Claude Code", proj(".claude"), dirsClaude, ["AGENTS.md", "CLAUDE.md", "GLOSSARY.md"]),
      target("Core", cwd, dirsCore, ["AGENTS.md", "CLAUDE.md", "GLOSSARY.md"]),
      target("Pi", proj(".pi/agent"), dirsCore, ["AGENTS.md", "GLOSSARY.md"]),
      target("CommandCode", proj(".commandcode"), dirsCore, ["AGENTS.md"]),
      target("OpenCode", proj(".opencode"), dirsCore, ["AGENTS.md"]),
      target("Cursor", proj(".cursor/rules"), [], ["AGENTS.md->agents.mdc"]),
      target("Codex", proj(".codex"), [], ["AGENTS.md", "AGENTS.md->instructions.md"]),
      target("Copilot", proj(".copilot"), dirsCore, ["AGENTS.md", "AGENTS.md->copilot-instructions.md"]),
      target("Copilot (.github)", proj(".github"), [], ["AGENTS.md->copilot-instructions.md"]),
    ];
  },
  global(home) {
    const u = (rel) => path.join(home, rel);
    return [
      target("Claude Code", u(".claude"), dirsClaude, ["AGENTS.md", "CLAUDE.md", "GLOSSARY.md"]),
      target("Pi", u(".pi/agent"), dirsCore, ["AGENTS.md", "GLOSSARY.md"]),
      target("CommandCode", u(".commandcode"), dirsCore, ["AGENTS.md"]),
      target("OpenCode", u(".config/opencode"), dirsCore, ["AGENTS.md"]),
      target("Codex", u(".codex"), [], ["AGENTS.md", "AGENTS.md->instructions.md"]),
      target("Copilot", u(".copilot"), dirsCore, ["AGENTS.md", "AGENTS.md->copilot-instructions.md"]),
    ];
  },
};

const c = process.stdout.isTTY
  ? { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", cyan: "\x1b[36m", dim: "\x1b[2m" }
  : { reset: "", bold: "", green: "", cyan: "", dim: "" };

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, force: true });
}

/**
 * Write an instruction file. If the destination exists and differs from the
 * package payload, the user's file is preserved as "<name>.bak" first.
 * @param {string} srcPath @param {string} destPath
 */
function writeInstruction(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    const current = fs.readFileSync(destPath, "utf8");
    if (current !== fs.readFileSync(srcPath, "utf8")) {
      fs.copyFileSync(destPath, `${destPath}.bak`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      // Missing destination is fine, but an unreadable file must not be
      // silently overwritten without its backup.
      throw err;
    }
  }
  fs.copyFileSync(srcPath, destPath);
}

/** @param {Target} t @returns {boolean} success */
function deployTarget(t) {
  try {
    for (const dir of t.dirs) copyDir(path.join(PKG_ROOT, dir), path.join(t.base, dir));
    for (const spec of t.files) {
      const [src, dest = src] = spec.split("->");
      writeInstruction(path.join(PKG_ROOT, src), path.join(t.base, dest));
    }
    const label = t.base.replace(process.env.LAH_FAKE_HOME || os.homedir(), "~");
    console.log(`  ${c.green}✔${c.reset} ${label} (${t.name})`);
    return true;
  } catch (err) {
    console.error(`  ${c.bold}\x1b[31m✖${c.reset} ${t.name}: ${err.message}`);
    return false;
  }
}

/** @param {Target[]} targets @returns {{ok: number, failed: number}} */
function deployAll(targets) {
  let ok = 0;
  let failed = 0;
  for (const t of targets) (deployTarget(t) ? ok++ : failed++);
  return { ok, failed };
}

function deployLocal() {
  console.log(`\nModo: ${c.bold}Local${c.reset} (${c.dim}${process.env.LAH_FAKE_CWD || process.cwd()}${c.reset})`);
  return deployAll(TARGETS.local());
}

function deployGlobal() {
  const home = process.env.LAH_FAKE_HOME || os.homedir();
  console.log(`\nModo: ${c.bold}Global${c.reset} (${c.dim}${home}${c.reset})`);
  return deployAll(TARGETS.global(home));
}

const HELP = `Lean Agent Harness v${version}
Despliegue multi-plataforma de reglas, comandos y skills para agentes de código.

Uso:
  npx lean-agent-harness            Instalar en el proyecto actual (local)
  npx lean-agent-harness --global   Instalar en el home del usuario (~/.claude, ...)
  lean | lah                        Alias si se instaló globalmente

Flags:
  -g, --global    Desplegar en carpetas de usuario
  -h, --help      Mostrar esta ayuda
  -v, --version   Mostrar versión

Entornos: Claude Code · Pi · CommandCode · OpenCode · Cursor · Codex · Copilot
`;

/** @returns {number} exit code */
function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(version);
    return 0;
  }
  if (argv.some((a) => !["--global", "-g", "--local", "-l"].includes(a))) {
    console.error(`Flag desconocido: ${argv.join(" ")}\n\n${HELP}`);
    return 1;
  }
  const { failed } = argv.includes("--global") || argv.includes("-g")
    ? deployGlobal()
    : deployLocal();
  if (failed > 0) return 1;
  console.log(`\n${c.green}${c.bold}Done!${c.reset} Arnés desplegado correctamente.\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { TARGETS, deployTarget, deployLocal, deployGlobal, writeInstruction, PKG_ROOT, version };
