#!/usr/bin/env bash
set -euo pipefail

REPO="${GITHUB_REPO:-lnardev/lean-agent-harness}"
BRANCH="${GITHUB_BRANCH:-main}"
TAR_URL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"

# Colores de salida
GREEN='\033[32m'
CYAN='\033[36m'
YELLOW='\033[33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

TARGET_MODE=""
INSTALL_STRATEGY=""
FORCE_ALL=false
FORCE_AUTO=false

for arg in "$@"; do
  case "$arg" in
    --global|-g) TARGET_MODE="global" ;;
    --local|-l)  TARGET_MODE="local" ;;
    --all)       FORCE_ALL=true ;;
    --auto)      FORCE_AUTO=true ;;
  esac
done

TTY_DEV=""
if [ -c /dev/tty ]; then
  TTY_DEV="/dev/tty"
fi

ask_user() {
  local prompt="$1"
  local default="$2"
  local response=""
  if [ -n "$TTY_DEV" ]; then
    printf "%b" "$prompt" > /dev/tty
    read -r response < "$TTY_DEV" || true
    echo "${response:-$default}"
  else
    echo "$default"
  fi
}

echo -e "\n${BOLD}${CYAN}Lean Agent Harness${NC} — Instalador Universal\n"

# 1. Modo de instalación
if [ -z "$TARGET_MODE" ]; then
  if [ -n "$TTY_DEV" ]; then
    echo -e "${BOLD}¿Dónde deseas instalar el arnés?${NC}"
    echo -e "  ${CYAN}[1]${NC} Global (~/ en carpetas de usuario)"
    echo -e "  ${CYAN}[2]${NC} Local (en el proyecto actual: $(pwd))"
    mode_choice=$(ask_user "Selecciona [1/2] (por defecto 1): " "1")
    if [ "$mode_choice" = "2" ]; then
      TARGET_MODE="local"
    else
      TARGET_MODE="global"
    fi
    echo ""
  else
    TARGET_MODE="global"
  fi
fi

if [ "$TARGET_MODE" = "global" ]; then
  BASE_DIR="${HOME}"
  OPENCODE_PATH="${BASE_DIR}/.config/opencode"
  echo -e "Modo: ${BOLD}Global${NC} (${DIM}${BASE_DIR}${NC})\n"
else
  BASE_DIR="${PWD}"
  OPENCODE_PATH="${BASE_DIR}/.opencode"
  echo -e "Modo: ${BOLD}Local${NC} (${DIM}${BASE_DIR}${NC})\n"
fi

# 2. Descarga a carpeta temporal
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT

echo -e "${DIM}Descargando arnés desde GitHub (${REPO})...${NC}"
curl -fsSL "${TAR_URL}" | tar -xz -C "${TMP_DIR}" --strip-components=1
echo ""

# 3. Detección de arneses existentes
DETECTED=()
[ -d "${BASE_DIR}/.claude" ] && DETECTED+=("claude")
[ -d "${BASE_DIR}/.pi" ] && DETECTED+=("pi")
[ -d "${BASE_DIR}/.commandcode" ] && DETECTED+=("commandcode")
([ -d "${BASE_DIR}/.config/opencode" ] || [ -d "${BASE_DIR}/.opencode" ]) && DETECTED+=("opencode")
[ -d "${BASE_DIR}/.codex" ] && DETECTED+=("codex")
([ -d "${BASE_DIR}/.copilot" ] || [ -d "${BASE_DIR}/.github" ]) && DETECTED+=("copilot")
[ "$TARGET_MODE" = "local" ] && [ -d "${BASE_DIR}/.cursor" ] && DETECTED+=("cursor")

DO_CLAUDE=false
DO_PI=false
DO_COMMANDCODE=false
DO_OPENCODE=false
DO_CODEX=false
DO_COPILOT=false
DO_CURSOR=false

if [ "$FORCE_ALL" = true ]; then
  INSTALL_STRATEGY="all"
elif [ "$FORCE_AUTO" = true ]; then
  INSTALL_STRATEGY="auto"
elif [ -n "$TTY_DEV" ]; then
  echo -e "${BOLD}Detección de asistentes:${NC}"
  if [ ${#DETECTED[@]} -gt 0 ]; then
    echo -e "  Se encontraron configuraciones para: ${GREEN}${DETECTED[*]}${NC}\n"
    echo -e "  ${CYAN}[1]${NC} Instalar únicamente en los detectados (${GREEN}${DETECTED[*]}${NC})"
    echo -e "  ${CYAN}[2]${NC} Seleccionar interactivamente uno por uno"
    echo -e "  ${CYAN}[3]${NC} Instalar en todos los harnesses soportados"
    choice=$(ask_user "Elige una opción [1/2/3] (por defecto 1): " "1")
  else
    echo -e "  ${YELLOW}No se detectaron carpetas de asistentes existentes.${NC}\n"
    echo -e "  ${CYAN}[1]${NC} Instalar en todos los soportados"
    echo -e "  ${CYAN}[2]${NC} Seleccionar interactivamente uno por uno"
    choice_raw=$(ask_user "Elige una opción [1/2] (por defecto 1): " "1")
    [ "$choice_raw" = "2" ] && choice="2" || choice="3"
  fi

  case "$choice" in
    1) INSTALL_STRATEGY="auto" ;;
    2) INSTALL_STRATEGY="manual" ;;
    *) INSTALL_STRATEGY="all" ;;
  esac
  echo ""
else
  [ ${#DETECTED[@]} -gt 0 ] && INSTALL_STRATEGY="auto" || INSTALL_STRATEGY="all"
fi

if [ "$INSTALL_STRATEGY" = "all" ]; then
  DO_CLAUDE=true
  DO_PI=true
  DO_COMMANDCODE=true
  DO_OPENCODE=true
  DO_CODEX=true
  DO_COPILOT=true
  [ "$TARGET_MODE" = "local" ] && DO_CURSOR=true

elif [ "$INSTALL_STRATEGY" = "auto" ]; then
  for item in "${DETECTED[@]}"; do
    case "$item" in
      claude)      DO_CLAUDE=true ;;
      pi)          DO_PI=true ;;
      commandcode) DO_COMMANDCODE=true ;;
      opencode)    DO_OPENCODE=true ;;
      codex)       DO_CODEX=true ;;
      copilot)     DO_COPILOT=true ;;
      cursor)      DO_CURSOR=true ;;
    esac
  done

elif [ "$INSTALL_STRATEGY" = "manual" ]; then
  echo -e "${BOLD}Responde 's' (sí) o 'n' (no) para cada entorno:${NC}"
  [[ "$(ask_user "  ¿Instalar en Claude Code (.claude)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CLAUDE=true
  [[ "$(ask_user "  ¿Instalar en Pi (.pi/agent)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_PI=true
  [[ "$(ask_user "  ¿Instalar en CommandCode (.commandcode)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_COMMANDCODE=true
  [[ "$(ask_user "  ¿Instalar en OpenCode (${OPENCODE_PATH#$BASE_DIR/})? [S/n]: " "s")" =~ ^[Ss] ]] && DO_OPENCODE=true
  [[ "$(ask_user "  ¿Instalar en Codex (.codex)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CODEX=true
  [[ "$(ask_user "  ¿Instalar en Copilot (.copilot)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_COPILOT=true
  if [ "$TARGET_MODE" = "local" ]; then
    [[ "$(ask_user "  ¿Instalar en Cursor (.cursor/rules)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CURSOR=true
  fi
  echo ""
fi

# 4. Despliegue del Core en modo local
if [ "$TARGET_MODE" = "local" ]; then
  mkdir -p "${BASE_DIR}/skills" "${BASE_DIR}/agents" "${BASE_DIR}/commands"
  cp -R "${TMP_DIR}/skills/"* "${BASE_DIR}/skills/"
  cp -R "${TMP_DIR}/agents/"* "${BASE_DIR}/agents/"
  cp -R "${TMP_DIR}/commands/"* "${BASE_DIR}/commands/"
  cp "${TMP_DIR}/AGENTS.md" "${BASE_DIR}/AGENTS.md"
  cp "${TMP_DIR}/CLAUDE.md" "${BASE_DIR}/CLAUDE.md"
  echo -e "  ${GREEN}✔${NC} Core local (/skills, /agents, /commands, AGENTS.md, CLAUDE.md)"
fi

# 5. Despliegue por entorno

# Claude Code
if [ "$DO_CLAUDE" = true ]; then
  DEST="${BASE_DIR}/.claude"
  mkdir -p "${DEST}/commands" "${DEST}/skills"
  cp -R "${TMP_DIR}/commands/"* "${DEST}/commands/"
  cp -R "${TMP_DIR}/skills/"* "${DEST}/skills/"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  cp "${TMP_DIR}/CLAUDE.md" "${DEST}/CLAUDE.md"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (commands, skills, AGENTS.md, CLAUDE.md)"
fi

# Pi (.pi/agent con carpeta interna agents/)
if [ "$DO_PI" = true ]; then
  DEST="${BASE_DIR}/.pi/agent"
  mkdir -p "${DEST}/agents" "${DEST}/skills" "${DEST}/commands"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  cp -R "${TMP_DIR}/agents/"* "${DEST}/agents/"
  cp -R "${TMP_DIR}/skills/"* "${DEST}/skills/"
  cp -R "${TMP_DIR}/commands/"* "${DEST}/commands/"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (AGENTS.md, agents/, skills/, commands/)"
fi

# CommandCode
if [ "$DO_COMMANDCODE" = true ]; then
  DEST="${BASE_DIR}/.commandcode"
  mkdir -p "${DEST}/agents" "${DEST}/skills" "${DEST}/commands"
  cp -R "${TMP_DIR}/agents/"* "${DEST}/agents/"
  cp -R "${TMP_DIR}/skills/"* "${DEST}/skills/"
  cp -R "${TMP_DIR}/commands/"* "${DEST}/commands/"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (agents, skills, commands, AGENTS.md)"
fi

# OpenCode
if [ "$DO_OPENCODE" = true ]; then
  DEST="${OPENCODE_PATH}"
  mkdir -p "${DEST}/agents" "${DEST}/skills" "${DEST}/commands"
  cp -R "${TMP_DIR}/agents/"* "${DEST}/agents/"
  cp -R "${TMP_DIR}/skills/"* "${DEST}/skills/"
  cp -R "${TMP_DIR}/commands/"* "${DEST}/commands/"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (agents, skills, commands, AGENTS.md)"
fi

# Codex
if [ "$DO_CODEX" = true ]; then
  DEST="${BASE_DIR}/.codex"
  mkdir -p "${DEST}"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/instructions.md"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (instructions.md, AGENTS.md)"
fi

# Copilot
if [ "$DO_COPILOT" = true ]; then
  DEST="${BASE_DIR}/.copilot"
  mkdir -p "${DEST}"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/copilot-instructions.md"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/AGENTS.md"
  if [ "$TARGET_MODE" = "local" ]; then
    mkdir -p "${BASE_DIR}/.github"
    cp "${TMP_DIR}/AGENTS.md" "${BASE_DIR}/.github/copilot-instructions.md"
  fi
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (copilot-instructions.md, AGENTS.md)"
fi

# Cursor (Solo local)
if [ "$DO_CURSOR" = true ]; then
  DEST="${BASE_DIR}/.cursor/rules"
  mkdir -p "${DEST}"
  cp "${TMP_DIR}/AGENTS.md" "${DEST}/agents.mdc"
  echo -e "  ${GREEN}✔${NC} ${DEST#$HOME/} (agents.mdc)"
fi

echo -e "\n${GREEN}${BOLD}Listo.${NC} Despliegue completado con éxito.\n"