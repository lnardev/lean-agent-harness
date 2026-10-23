#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const rootPkg = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function copySafe(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log(`\n${c.bold}${c.cyan}Surgical Agent Harness${c.reset} — Installation\n`);

const installGlobal = args.includes('--global') || args.includes('-g');

if (installGlobal) {
  const home = os.homedir();
  const globalTargets = [
    { name: 'Claude Code (~/.claude)', dir: path.join(home, '.claude') },
    { name: 'Pi (~/.pi)', dir: path.join(home, '.pi') },
    { name: 'OpenCode (~/.config/opencode)', dir: path.join(home, '.config', 'opencode') },
    { name: 'CommandCode (~/.commandcode)', dir: path.join(home, '.commandcode') },
    { name: 'Codex (~/.codex)', dir: path.join(home, '.codex') }
  ];

  for (const target of globalTargets) {
    copyDirRecursive(path.join(rootPkg, 'skills'), path.join(target.dir, 'skills'));
    copyDirRecursive(path.join(rootPkg, 'commands'), path.join(target.dir, 'commands'));
    copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(target.dir, 'AGENTS.md'));
    console.log(`  ${c.green}✔${c.reset} Installed to ${c.bold}${target.name}${c.reset}`);
  }
} else {
  console.log(`Installing into: ${c.dim}${cwd}${c.reset}\n`);

  // 1. Core harness
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(cwd, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(cwd, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(cwd, 'commands'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(cwd, 'AGENTS.md'));
  copySafe(path.join(rootPkg, 'CLAUDE.md'), path.join(cwd, 'CLAUDE.md'));
  console.log(`  ${c.green}✔${c.reset} Core harness: /skills, /agents, /commands, AGENTS.md, CLAUDE.md`);

  // 2. Cursor
  const cursorDir = path.join(cwd, '.cursor', 'rules');
  fs.mkdirSync(cursorDir, { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(cursorDir, 'agents.mdc'));
  console.log(`  ${c.green}✔${c.reset} Cursor: .cursor/rules/agents.mdc`);

  // 3. Claude Code local
  const claudeLocal = path.join(cwd, '.claude');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(claudeLocal, 'commands'));
  console.log(`  ${c.green}✔${c.reset} Claude Code: .claude/commands`);

  // 4. Codex / Copilot
  const githubDir = path.join(cwd, '.github');
  fs.mkdirSync(githubDir, { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(githubDir, 'copilot-instructions.md'));
  const codexDir = path.join(cwd, '.codex');
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(codexDir, 'instructions.md'));
  console.log(`  ${c.green}✔${c.reset} Codex/Copilot: .github/copilot-instructions.md & .codex/instructions.md`);

  // 5. CommandCode
  const commandCodeDir = path.join(cwd, '.commandcode');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(commandCodeDir, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(commandCodeDir, 'skills'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(commandCodeDir, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} CommandCode: .commandcode/`);

  // 6. Pi local
  const piLocal = path.join(cwd, '.pi');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(piLocal, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(piLocal, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(piLocal, 'agents'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(piLocal, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} Pi local: .pi/`);
}

console.log(`\n${c.green}${c.bold}Done!${c.reset} Configured for Claude Code, Cursor, Pi, OpenCode, Codex, and CommandCode.\n`);