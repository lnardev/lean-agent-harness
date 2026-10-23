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
  yellow: '\x1b[33m',
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

console.log(`\n${c.bold}${c.cyan}Lean Agent Harness${c.reset} — CLI Installer\n`);

const installGlobal = args.includes('--global') || args.includes('-g');

if (installGlobal) {
  const home = os.homedir();
  console.log(`Modo: ${c.bold}Global${c.reset} (${c.dim}${home}${c.reset})\n`);

  // 1. Claude Code (~/.claude)
  const claudeDir = path.join(home, '.claude');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(claudeDir, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(claudeDir, 'skills'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(claudeDir, 'AGENTS.md'));
  copySafe(path.join(rootPkg, 'CLAUDE.md'), path.join(claudeDir, 'CLAUDE.md'));
  console.log(`  ${c.green}✔${c.reset} ~/.claude (commands, skills, AGENTS.md, CLAUDE.md)`);

  // 2. Pi (~/.pi/agent con subcarpeta agents/)
  const piAgentDir = path.join(home, '.pi', 'agent');
  fs.mkdirSync(path.join(piAgentDir, 'agents'), { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(piAgentDir, 'AGENTS.md'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(piAgentDir, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(piAgentDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(piAgentDir, 'commands'));
  console.log(`  ${c.green}✔${c.reset} ~/.pi/agent (AGENTS.md, agents/, skills/, commands/)`);

  // 3. CommandCode (~/.commandcode)
  const ccDir = path.join(home, '.commandcode');
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(ccDir, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(ccDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(ccDir, 'commands'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(ccDir, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} ~/.commandcode (agents, skills, commands, AGENTS.md)`);

  // 4. OpenCode (~/.config/opencode)
  const opencodeDir = path.join(home, '.config', 'opencode');
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(opencodeDir, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(opencodeDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(opencodeDir, 'commands'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(opencodeDir, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} ~/.config/opencode (agents, skills, commands, AGENTS.md)`);

  // 5. Codex (~/.codex)
  const codexDir = path.join(home, '.codex');
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(codexDir, 'instructions.md'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(codexDir, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} ~/.codex (instructions.md, AGENTS.md)`);

  // 6. Copilot (~/.copilot con estructura completa)
  const copilotDir = path.join(home, '.copilot');
  fs.mkdirSync(path.join(copilotDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(copilotDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(copilotDir, 'commands'), { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(copilotDir, 'copilot-instructions.md'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(copilotDir, 'AGENTS.md'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(copilotDir, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(copilotDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(copilotDir, 'commands'));
  console.log(`  ${c.green}✔${c.reset} ~/.copilot (copilot-instructions.md, AGENTS.md, agents/, skills/, commands/)`);

} else {
  console.log(`Modo: ${c.bold}Local${c.reset} (${c.dim}${cwd}${c.reset})\n`);

  // 1. Núcleo base en la raíz
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(cwd, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(cwd, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(cwd, 'commands'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(cwd, 'AGENTS.md'));
  copySafe(path.join(rootPkg, 'CLAUDE.md'), path.join(cwd, 'CLAUDE.md'));
  console.log(`  ${c.green}✔${c.reset} Core local (/skills, /agents, /commands, AGENTS.md, CLAUDE.md)`);

  // 2. Cursor rules
  const cursorDir = path.join(cwd, '.cursor', 'rules');
  fs.mkdirSync(cursorDir, { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(cursorDir, 'agents.mdc'));
  console.log(`  ${c.green}✔${c.reset} Cursor (.cursor/rules/agents.mdc)`);

  // 3. Claude Code local
  const claudeLocal = path.join(cwd, '.claude');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(claudeLocal, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(claudeLocal, 'skills'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(claudeLocal, 'AGENTS.md'));
  copySafe(path.join(rootPkg, 'CLAUDE.md'), path.join(claudeLocal, 'CLAUDE.md'));
  console.log(`  ${c.green}✔${c.reset} Claude Code (.claude/)`);

  // 4. Pi local (.pi/agent con subcarpeta agents/)
  const piLocalAgent = path.join(cwd, '.pi', 'agent');
  fs.mkdirSync(path.join(piLocalAgent, 'agents'), { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(piLocalAgent, 'AGENTS.md'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(piLocalAgent, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(piLocalAgent, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(piLocalAgent, 'commands'));
  console.log(`  ${c.green}✔${c.reset} Pi local (.pi/agent/agents/)`);

  // 5. CommandCode local
  const commandCodeDir = path.join(cwd, '.commandcode');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(commandCodeDir, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(commandCodeDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(commandCodeDir, 'agents'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(commandCodeDir, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} CommandCode (.commandcode/)`);

  // 6. OpenCode local
  const openCodeLocal = path.join(cwd, '.opencode');
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(openCodeLocal, 'commands'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(openCodeLocal, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(openCodeLocal, 'agents'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(openCodeLocal, 'AGENTS.md'));
  console.log(`  ${c.green}✔${c.reset} OpenCode (.opencode/)`);

  // 7. Codex & Copilot local
  const githubDir = path.join(cwd, '.github');
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(githubDir, 'copilot-instructions.md'));

  const codexDir = path.join(cwd, '.codex');
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(codexDir, 'instructions.md'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(codexDir, 'AGENTS.md'));

  const copilotDir = path.join(cwd, '.copilot');
  fs.mkdirSync(path.join(copilotDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(copilotDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(copilotDir, 'commands'), { recursive: true });
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(copilotDir, 'copilot-instructions.md'));
  copySafe(path.join(rootPkg, 'AGENTS.md'), path.join(copilotDir, 'AGENTS.md'));
  copyDirRecursive(path.join(rootPkg, 'agents'), path.join(copilotDir, 'agents'));
  copyDirRecursive(path.join(rootPkg, 'skills'), path.join(copilotDir, 'skills'));
  copyDirRecursive(path.join(rootPkg, 'commands'), path.join(copilotDir, 'commands'));
  console.log(`  ${c.green}✔${c.reset} Codex & Copilot (.github/, .codex/, .copilot/)`);
}

console.log(`\n${c.green}${c.bold}Done!${c.reset} Arnés desplegado correctamente.\n`);