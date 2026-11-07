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
 * Flags: --help | -h | --version | -v | --global | -g | --local | -l | --guard (with --global)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const { version } = require("../package.json");
const { mergeHook } = require("../guard/claude/merge-settings.js");
const { mergePermission } = require("../guard/opencode/merge-permission.js");

const PKG_ROOT = path.resolve(__dirname, "..");

/**
 * @typedef {Object} Entry
 * @property {"file"|"dir"|"settings-hook"|"opencode-permission"} kind
 *           file = instruction file (.bak on divergence); dir = mirrored directory;
 *           settings-hook = merge a hook into a Claude Code settings.json;
 *           opencode-permission = merge permission rules into an OpenCode opencode.json
 * @property {string} src         Path relative to the package root
 * @property {string} dest        Path relative to the target base
 * @property {string} mode        "" | "if-missing" (file kind: never overwrite an existing dest)
 *           | "merge" (file kind: back up a divergent dest and merge its rules into the
 *           deployed file as a "Project Rules" section)
 *
 * @typedef {Object} Target
 * @property {string} name        Human-readable label
 * @property {string} base        Destination base directory (project root or home)
 * @property {Entry[]} entries
 */

const LABELS = {
  core: "Core",
  claude: "Claude Code",
  agents: "Agent Skills (.agents: Pi · OpenCode · Codex · Copilot · Cursor)",
  pi: "Pi",
  opencode: "OpenCode",
  codex: "Codex",
  copilot: "Copilot",
  commandcode: "CommandCode",
  "pi-guard": "Pi guard",
  "claude-guard": "Claude Code guard",
  "opencode-guard": "OpenCode guard",
  "codex-guard": "Codex guard",
};

/**
 * Parse manifest.tsv (shared with install.sh).
 * @param {string} text
 * @returns {{scope: string, target: string, entry: Entry}[]}
 */
function parseManifest(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() !== "" && !line.startsWith("#"))
    .map(({ line, lineNumber }) => {
      const columns = line.split("\t");
      if (columns.length !== 5 && columns.length !== 6) {
        throw new Error(`manifest.tsv line ${lineNumber}: expected 5 or 6 columns, got ${columns.length}`);
      }
      const [scope, target, kind, src, dest, mode = ""] = columns;
      return {
        scope,
        target,
        entry: {
          kind,
          src,
          dest,
          mode: mode.trim(),
        },
      };
    });
}

/**
 * @param {string} scope
 * @param {string} base
 * @returns {Target[]}
 */
function targetsFor(scope, base) {
  const rows = parseManifest(fs.readFileSync(path.join(PKG_ROOT, "manifest.tsv"), "utf8"));
  /** @type {Map<string, Target>} */
  const byId = new Map();
  for (const row of rows.filter((r) => r.scope === scope)) {
    if (!byId.has(row.target)) {
      byId.set(row.target, { name: LABELS[row.target] || row.target, base, entries: [] });
    }
    byId.get(row.target).entries.push(row.entry);
  }
  return [...byId.values()];
}

/** Declarative deployment manifest, resolved against the current environment. */
const TARGETS = {
  local: () => targetsFor("local", process.env.LAH_FAKE_CWD || process.cwd()),
  global: (home) => targetsFor("global", home),
  "global-guard": (home) => targetsFor("global-guard", home),
};

const c = process.stdout.isTTY
  ? { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", cyan: "\x1b[36m", dim: "\x1b[2m" }
  : { reset: "", bold: "", green: "", cyan: "", dim: "" };

const PROFILES = ["core", "full"];

/**
 * Skill folders omitted by the "core" profile (profile-extras.txt, shared with install.sh).
 * @param {string} profile
 * @returns {Set<string>}
 */
function excludedSkills(profile) {
  if (profile !== "core") return new Set();
  const text = fs.readFileSync(path.join(PKG_ROOT, "profile-extras.txt"), "utf8");
  return new Set(
    text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#")),
  );
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {Set<string>} [exclude] top-level entries of src to skip (dotfiles are always skipped)
 */
function copyDir(src, dest, exclude = new Set()) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (from) => {
      if (path.dirname(from) !== src) return true;
      const name = path.basename(from);
      return !name.startsWith(".") && !exclude.has(name);
    },
  });
}

/**
 * First free backup name: "<name>.bak", then "<name>.bak.1", "<name>.bak.2", ...
 * Existing backups are never overwritten.
 *
 * @param {string} destPath
 * @returns {string}
 */
function backupPath(destPath) {
  let candidate = `${destPath}.bak`;
  for (let n = 1; fs.existsSync(candidate); n++) candidate = `${destPath}.bak.${n}`;
  return candidate;
}

/** Merge mode: markers delimiting the user's rules inside a deployed instruction file. */
const MERGE_START = "<!-- lah:project-rules:start -->";
const MERGE_END = "<!-- lah:project-rules:end -->";
const MERGE_HEADING = "## Project Rules\n\n";
/** Strings identifying a file the harness itself deployed (any version): replaced bare, never absorbed. */
const HARNESS_MARKS = [
  "lean-agent-harness",
  "Single source of truth for all coding agents",
  "# Claude Code Project Configuration",
];

/**
 * The user's section inside a managed instruction file (between the markers, trimmed),
 * or null when the file carries no markers.
 * @param {string} text
 * @returns {string | null}
 */
function sectionOf(text) {
  const at = text.indexOf(MERGE_START);
  if (at === -1) return null;
  let body = text.slice(at + MERGE_START.length);
  const end = body.indexOf(MERGE_END);
  if (end !== -1) body = body.slice(0, end);
  return body.trim();
}

/**
 * Write an instruction file. A destination that differs from the package payload is
 * preserved as "<name>.bak" (or the next free "<name>.bak.N") first. With mode
 * "if-missing" an existing destination is left untouched (seed files). With mode
 * "merge" the divergent destination's rules also survive in context: a user file is
 * merged as a "Project Rules" section, a managed file keeps its section across
 * payload upgrades, and a file the harness itself deployed is replaced bare.
 * Writing a byte-identical result is a no-op, so reinstalling is stable.
 *
 * @param {string} srcPath
 * @param {string} destPath
 * @param {string} [mode]
 */
function writeInstruction(srcPath, destPath, mode = "") {
  if (mode === "if-missing" && fs.existsSync(destPath)) return;
  const payload = fs.readFileSync(srcPath, "utf8");
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  let current = null;
  try {
    current = fs.readFileSync(destPath, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  if (current === null) {
    fs.copyFileSync(srcPath, destPath);
    return;
  }
  if (current === payload) return;
  let next = null;
  if (mode === "merge") {
    const marked = sectionOf(current);
    const userRules = marked === null && !HARNESS_MARKS.some((m) => current.includes(m)) ? current.trim() : "";
    const body = marked ?? (userRules ? MERGE_HEADING + userRules : "");
    next = body ? `${payload.replace(/\s+$/, "")}\n\n${MERGE_START}\n${body}\n${MERGE_END}\n` : payload;
  }
  if (next !== null && next === current) return;
  fs.copyFileSync(destPath, backupPath(destPath));
  if (next !== null) fs.writeFileSync(destPath, next);
  else fs.copyFileSync(srcPath, destPath);
}

/**
 * Delete the deployed copies of skills and commands removed from the package (retired.tsv).
 * An entry applies to the manifest row whose src prefixes it. The copy is deleted only when it
 * carries the marker line it shipped with, so a skill of the user's own with the same name
 * survives, and never when the package ships that path again or the entry climbs out of src.
 *
 * @param {string} src  Manifest src of the directory row
 * @param {string} dest Deployed directory
 */
function retireStale(src, dest) {
  const list = path.join(PKG_ROOT, "retired.tsv");
  if (!fs.existsSync(list)) return;
  const text = fs.readFileSync(list, "utf8");
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [entry, marker = ""] = line.split("\t");
    if (!entry.startsWith(`${src}/`)) continue;
    if (entry.split("/").includes("..")) {
      console.error(`retired.tsv: ignoring unsafe path ${entry}`);
      continue;
    }
    if (fs.existsSync(path.join(PKG_ROOT, entry))) continue;
    const target = path.join(dest, entry.slice(src.length + 1));
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) continue;
    const probe = stat.isDirectory() ? path.join(target, "SKILL.md") : target;
    const lines = fs.existsSync(probe) ? fs.readFileSync(probe, "utf8").replace(/\r/g, "").split("\n") : [];
    if (!lines.includes(marker)) continue;
    fs.rmSync(target, { recursive: true });
    console.log(`  retired ${path.relative(dest, target)}`);
  }
}

/**
 * @param {Target} t
 * @param {Set<string>} [exclude] skill folders to skip (profile)
 * @returns {boolean} success
 */
function deployTarget(t, exclude = new Set()) {
  try {
    for (const { kind, src, dest, mode } of t.entries) {
      const from = path.join(PKG_ROOT, src);
      const to = path.join(t.base, dest);
      if (kind === "file") writeInstruction(from, to, mode);
      else if (kind === "settings-hook") mergeHook(from, to);
      else if (kind === "opencode-permission") mergePermission(from, to);
      else {
        copyDir(from, to, src === "skills" ? exclude : new Set());
        retireStale(src, to);
      }
    }
    const label = t.base.replace(process.env.LAH_FAKE_HOME || os.homedir(), "~");
    console.log(`  ${c.green}✔${c.reset} ${label} (${t.name})`);
    return true;
  } catch (err) {
    console.error(`  ${c.bold}\x1b[31m✖${c.reset} ${t.name}: ${err.message}`);
    return false;
  }
}

/**
 * @param {Target[]} targets
 * @param {string} profile
 * @returns {{ok: number, failed: number}}
 */
function deployAll(targets, profile) {
  const exclude = excludedSkills(profile);
  let ok = 0;
  let failed = 0;
  for (const t of targets) (deployTarget(t, exclude) ? ok++ : failed++);
  return { ok, failed };
}

function deployLocal(profile = "full") {
  console.log(`\nModo: ${c.bold}Local${c.reset} (${c.dim}${process.env.LAH_FAKE_CWD || process.cwd()}${c.reset})`);
  return deployAll(TARGETS.local(), profile);
}

function deployGlobal(profile = "full", guard = false) {
  const home = process.env.LAH_FAKE_HOME || os.homedir();
  console.log(`\nModo: ${c.bold}Global${c.reset} (${c.dim}${home}${c.reset})`);
  return deployAll([...TARGETS.global(home), ...(guard ? TARGETS["global-guard"](home) : [])], profile);
}

const HELP = `Lean Agent Harness v${version}
Despliegue multi-plataforma de reglas, comandos y skills para agentes de código.

Uso:
  npx lean-agent-harness            Instalar en el proyecto actual (local)
  npx lean-agent-harness --global   Instalar en el home del usuario (~/.claude, ...)
  lean | lah                        Alias si se instaló globalmente

Flags:
  -l, --local     Desplegar en el proyecto actual (comportamiento por defecto)
  -g, --global    Desplegar en carpetas de usuario (~/)
  --profile <p>   core = sin skills extra (ver profile-extras.txt) | full (por defecto)
  --guard         Con --global: instala el guard (hook de Claude Code, permisos de OpenCode, extensión de Pi y reglas de Codex) que bloquea
                  secretos y comandos destructivos. Ejecuta código en el agente: es opt-in
  -h, --help      Mostrar esta ayuda
  -v, --version   Mostrar versión

Entornos: Claude Code · Pi · CommandCode · OpenCode · Cursor · Codex · Copilot (destinos en manifest.tsv)
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

  let profile = "full";
  const rest = [...argv];
  const at = rest.indexOf("--profile");
  if (at !== -1) {
    profile = rest[at + 1] ?? "";
    rest.splice(at, 2);
    if (!PROFILES.includes(profile)) {
      console.error(`Perfil desconocido: "${profile}". Usa: ${PROFILES.join(" | ")}`);
      return 1;
    }
  }

  const validFlags = new Set(["--global", "-g", "--local", "-l", "--guard"]);
  const unknownArgs = rest.filter((a) => !validFlags.has(a));

  if (unknownArgs.length > 0) {
    console.error(`Flag desconocido: ${unknownArgs.join(" ")}\n\n${HELP}`);
    return 1;
  }

  const isGlobal = argv.includes("--global") || argv.includes("-g");
  const guard = argv.includes("--guard");
  if (guard && !isGlobal) {
    console.error("--guard requiere --global: las extensiones de proyecto solo cargan si el proyecto es de confianza.");
    return 1;
  }
  const { failed } = isGlobal ? deployGlobal(profile, guard) : deployLocal(profile);

  if (failed > 0) return 1;
  console.log(`\n${c.green}${c.bold}Done!${c.reset} Arnés desplegado correctamente.\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  TARGETS,
  parseManifest,
  deployTarget,
  deployLocal,
  deployGlobal,
  writeInstruction,
  PKG_ROOT,
  version,
};