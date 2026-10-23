#!/usr/bin/env bash
set -euo pipefail

# Configuración del repositorio
REPO="${GITHUB_REPO:-lnardev/lean-agent-harness}"
BRANCH="main"
TAR_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"

TARGET_DIR="${PWD}"
GLOBAL_INSTALL=false

# Evaluar flags
for arg in "$@"; do
  case "$arg" in
    --global|-g)
      GLOBAL_INSTALL=true
      ;;
  esac
done

# Colores de salida
GREEN='\033[32m'
CYAN='\033[36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "\n${BOLD}${CYAN}Lean Agent Harness${NC} — Instalando vía curl\n"

# Descargar tarball a directorio temporal
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

curl -fsSL "${TAR_URL}" | tar -xz -C "${TMP_DIR}" --strip-components=1

if [ "$GLOBAL_INSTALL" = true ]; then
  HOME_DIR="${HOME}"
  
  # Directorios globales
  declare -a TARGETS=(
    "${HOME_DIR}/.claude"
    "${HOME_DIR}/.pi"
    "${HOME_DIR}/.config/opencode"
    "${HOME_DIR}/.commandcode"
    "${HOME_DIR}/.codex"
  )

  for dir in "${TARGETS[@]}"; do
    mkdir -p "${dir}/skills" "${dir}/commands"
    cp -R "${TMP_DIR}/skills/"* "${dir}/skills/"
    cp -R "${TMP_DIR}/commands/"* "${dir}/commands/"
    cp "${TMP_DIR}/AGENTS.md" "${dir}/AGENTS.md"
    echo -e "  ${GREEN}✔${NC} Instalado globalmente en: ${BOLD}${dir}${NC}"
  done

else
  # 1. Copiar arnés base al proyecto actual
  mkdir -p "${TARGET_DIR}/skills" "${TARGET_DIR}/agents" "${TARGET_DIR}/commands"
  cp -R "${TMP_DIR}/skills/"* "${TARGET_DIR}/skills/"
  cp -R "${TMP_DIR}/agents/"* "${TARGET_DIR}/agents/"
  cp -R "${TMP_DIR}/commands/"* "${TARGET_DIR}/commands/"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md"
  cp "${TMP_DIR}/CLAUDE.md" "${TARGET_DIR}/CLAUDE.md"
  echo -e "  ${GREEN}✔${NC} Core: /skills, /agents, /commands, AGENTS.md, CLAUDE.md"

  # 2. Cursor rules
  mkdir -p "${TARGET_DIR}/.cursor/rules"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/.cursor/rules/agents.mdc"
  echo -e "  ${GREEN}✔${NC} Cursor: .cursor/rules/agents.mdc"

  # 3. Claude Code local
  mkdir -p "${TARGET_DIR}/.claude/commands"
  cp -R "${TMP_DIR}/commands/"* "${TARGET_DIR}/.claude/commands/"
  echo -e "  ${GREEN}✔${NC} Claude Code: .claude/commands"

  # 4. Codex / Copilot
  mkdir -p "${TARGET_DIR}/.github" "${TARGET_DIR}/.codex"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/.github/copilot-instructions.md"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/.codex/instructions.md"
  echo -e "  ${GREEN}✔${NC} Codex/Copilot: .github/ y .codex/"

  # 5. CommandCode local
  mkdir -p "${TARGET_DIR}/.commandcode/commands" "${TARGET_DIR}/.commandcode/skills"
  cp -R "${TMP_DIR}/commands/"* "${TARGET_DIR}/.commandcode/commands/"
  cp -R "${TMP_DIR}/skills/"* "${TARGET_DIR}/.commandcode/skills/"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/.commandcode/AGENTS.md"
  echo -e "  ${GREEN}✔${NC} CommandCode: .commandcode/"

  # 6. Pi local
  mkdir -p "${TARGET_DIR}/.pi/commands" "${TARGET_DIR}/.pi/skills" "${TARGET_DIR}/.pi/agents"
  cp -R "${TMP_DIR}/commands/"* "${TARGET_DIR}/.pi/commands/"
  cp -R "${TMP_DIR}/skills/"* "${TARGET_DIR}/.pi/skills/"
  cp -R "${TMP_DIR}/agents/"* "${TARGET_DIR}/.pi/agents/"
  cp "${TMP_DIR}/AGENTS.md" "${TARGET_DIR}/.pi/AGENTS.md"
  echo -e "  ${GREEN}✔${NC} Pi: .pi/"
fi

echo -e "\n${GREEN}${BOLD}Listo.${NC} Configurado y blindado para todos los asistentes.\n"