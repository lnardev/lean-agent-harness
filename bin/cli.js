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
 * Flags: --help | -h | --version | -v | --global | -g | --local | -l
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const { version } = require("../package.json");

const PKG_ROOT = path.resolve(__dirname, "..");

/**
 * @typedef {Object} Entry
 * @property {"file"|"dir"} kind  file = instruction file (.bak on divergence); dir = mirrored directory
 * @property {string} src         Path relative to the package root
 * @property {string} dest        Path relative to the target base
 * @property {string} mode        "" or "if-missing" (file kind: never overwrite an existing dest)
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
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => {
      const [scope, target, kind, src, dest, mode = ""] = line.split("\t");
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
 * @param {Set<string>} [exclude] top-level entries of src to skip
 */
function copyDir(src, dest, exclude = new Set()) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (from) => !(path.dirname(from) === src && exclude.has(path.basename(from))),
  });
}

/**
 * Write an instruction file. If the destination exists and differs from the
 * package payload, the user's file is preserved as "<name>.bak" first.
 * With mode "if-missing" an existing destination is left untouched (seed files).
 *
 * @param {string} srcPath
 * @param {string} destPath
 * @param {string} [mode]
 */
function writeInstruction(srcPath, destPath, mode = "") {
  if (mode === "if-missing" && fs.existsSync(destPath)) return;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    const current = fs.readFileSync(destPath, "utf8");
    if (current !== fs.readFileSync(srcPath, "utf8")) {
      fs.copyFileSync(destPath, `${destPath}.bak`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  fs.copyFileSync(srcPath, destPath);
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
      else copyDir(from, to, src === "skills" ? exclude : new Set());
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

function deployGlobal(profile = "full") {
  const home = process.env.LAH_FAKE_HOME || os.homedir();
  console.log(`\nModo: ${c.bold}Global${c.reset} (${c.dim}${home}${c.reset})`);
  return deployAll(TARGETS.global(home), profile);
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

  const validFlags = new Set(["--global", "-g", "--local", "-l"]);
  const unknownArgs = rest.filter((a) => !validFlags.has(a));

  if (unknownArgs.length > 0) {
    console.error(`Flag desconocido: ${unknownArgs.join(" ")}\n\n${HELP}`);
    return 1;
  }

  const isGlobal = argv.includes("--global") || argv.includes("-g");
  const { failed } = isGlobal ? deployGlobal(profile) : deployLocal(profile);

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