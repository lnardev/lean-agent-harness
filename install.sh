#!/usr/bin/env bash
# Lean Agent Harness — cross-platform installer (curl | bash)
# Modes: local (project) | global (user home). Detection + flags, never hangs without a TTY.
set -euo pipefail

REPO="${GITHUB_REPO:-lnardev/lean-agent-harness}"
BRANCH="${GITHUB_BRANCH:-main}"

GREEN='\033[32m'; CYAN='\033[36m'; YELLOW='\033[33m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

TARGET_MODE=""
STRATEGY=""
for arg in "$@"; do
  case "$arg" in
    --global|-g) TARGET_MODE="global" ;;
    --local|-l)  TARGET_MODE="local" ;;
    --all)       STRATEGY="all" ;;
    --auto)      STRATEGY="auto" ;;
    *) echo "Flag desconocido: $arg (solo: --global, --local, --all, --auto)" >&2; exit 64 ;;
  esac
done

TTY_DEV=""
if [ -c /dev/tty ]; then TTY_DEV="/dev/tty"; fi

ask() {
  local response=""
  if [ -n "$TTY_DEV" ]; then
    printf "%b" "$1" > "/dev/tty"
    read -r response < "/dev/tty" || true
  fi
  printf "%s" "${response:-$2}"
}

echo -e "\n${BOLD}${CYAN}Lean Agent Harness${NC} — Instalador Universal\n"

# 1. Mode: global vs local
if [ -z "$TARGET_MODE" ]; then
  if [ -n "$TTY_DEV" ]; then
    echo -e "${BOLD}¿Dónde deseas instalar el arnés?${NC}"
    echo -e "  ${CYAN}[1]${NC} Global (~/ en carpetas de usuario)"
    echo -e "  ${CYAN}[2]${NC} Local (en el proyecto actual: $(pwd))"
    mode_choice="$(ask "Selecciona [1/2] (por defecto 1): " "1")"
    [ "$mode_choice" = "2" ] && TARGET_MODE="local" || TARGET_MODE="global"
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
  BASE_DIR="$PWD"
  OPENCODE_PATH="${BASE_DIR}/.opencode"
  echo -e "Modo: ${BOLD}Local${NC} (${DIM}${BASE_DIR}${NC})\n"
fi

# 2. Source: local override for testing, otherwise the GitHub tarball
if [ -n "${LAH_SOURCE:-}" ] && [ -d "$LAH_SOURCE" ]; then
  SRC="$LAH_SOURCE"
  echo -e "${DIM}Fuente: $SRC (override local)${NC}"
else
  SRC="$(mktemp -d)"
  trap 'rm -rf "${SRC}"' EXIT
  echo -e "${DIM}Descargando arnés desde GitHub (${REPO})...${NC}"
  curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | tar -xz -C "$SRC" --strip-components=1
fi

# 3. Environment detection
detect() {
  case "$TARGET_MODE" in
    global)
      [ -d "$BASE_DIR/.claude" ] && echo "claude"
      [ -d "$BASE_DIR/.pi" ] && echo "pi"
      [ -d "$BASE_DIR/.commandcode" ] && echo "commandcode"
      [ -d "$BASE_DIR/.config/opencode" ] && echo "opencode"
      [ -d "$BASE_DIR/.codex" ] && echo "codex"
      [ -d "$BASE_DIR/.copilot" ] && echo "copilot"
      ;;
    local)
      [ -d "$BASE_DIR/.claude" ] && echo "claude"
      [ -d "$BASE_DIR/.pi" ] && echo "pi"
      [ -d "$BASE_DIR/.commandcode" ] && echo "commandcode"
      [ -d "$BASE_DIR/.opencode" ] && echo "opencode"
      [ -d "$BASE_DIR/.codex" ] && echo "codex"
      [ -d "$BASE_DIR/.copilot" ] || [ -d "$BASE_DIR/.github" ] && echo "copilot"
      [ -d "$BASE_DIR/.cursor" ] && echo "cursor"
      ;;
  esac
}
# String-based, not an array: stock macOS ships bash 3.2 (no mapfile).
DETECTED="$(detect || true)"

DO_CLAUDE=false DO_PI=false DO_COMMANDCODE=false DO_OPENCODE=false DO_CODEX=false DO_COPILOT=false DO_CURSOR=false

# 3.5 Strategy fallback: non-TTY runs without an explicit strategy must not be a silent no-op
if [ -z "$STRATEGY" ]; then
  [ -n "$DETECTED" ] && STRATEGY="auto" || STRATEGY="all"
fi

if [ "$STRATEGY" = "all" ]; then
  DO_CLAUDE=true DO_PI=true DO_COMMANDCODE=true DO_OPENCODE=true DO_CODEX=true DO_COPILOT=true
  [ "$TARGET_MODE" = "local" ] && DO_CURSOR=true
  echo -e "${DIM}Estrategia: todos los entornos soportados.${NC}\n"
elif [ "$STRATEGY" = "auto" ]; then
  for item in $DETECTED; do
    case "$item" in
      claude) DO_CLAUDE=true ;;
      pi) DO_PI=true ;;
      commandcode) DO_COMMANDCODE=true ;;
      opencode) DO_OPENCODE=true ;;
      codex) DO_CODEX=true ;;
      copilot) DO_COPILOT=true ;;
      cursor) DO_CURSOR=true ;;
    esac
  done
  [ -n "$DETECTED" ] || DO_CLAUDE=true   # nothing detected: Claude Code is the sensible baseline
  echo -e "${DIM}Estrategia: detectados (${DETECTED:-ninguno}).${NC}\n"
elif [ -n "$TTY_DEV" ]; then
  if [ -n "$DETECTED" ]; then
    echo -e "${BOLD}Se detectaron configuraciones para: ${GREEN}${DETECTED}${NC}\n"
    echo -e "  ${CYAN}[1]${NC} Instalar únicamente en los detectados"
    echo -e "  ${CYAN}[2]${NC} Seleccionar manualmente uno por uno"
    echo -e "  ${CYAN}[3]${NC} Instalar en todos los soportados"
    choice="$(ask "Elige una opción [1/2/3] (por defecto 1): " "1")"
    case "$choice" in
      1) STRATEGY="auto" ;;
      2) STRATEGY="manual" ;;
      *) STRATEGY="all" ;;
    esac
  else
    echo -e "  ${YELLOW}No se detectaron carpetas de asistentes previas.${NC}\n"
    echo -e "  ${CYAN}[1]${NC} Instalar en todos los soportados"
    echo -e "  ${CYAN}[2]${NC} Seleccionar manualmente uno por uno"
    choice="$(ask "Elige una opción [1/2] (por defecto 1): " "1")"
    case "$choice" in 2) STRATEGY="manual" ;; *) STRATEGY="all" ;; esac
  fi
fi

if [ "$STRATEGY" = "auto" ]; then
  for item in $DETECTED; do
    case "$item" in
      claude) DO_CLAUDE=true ;;
      pi) DO_PI=true ;;
      commandcode) DO_COMMANDCODE=true ;;
      opencode) DO_OPENCODE=true ;;
      codex) DO_CODEX=true ;;
      copilot) DO_COPILOT=true ;;
      cursor) DO_CURSOR=true ;;
    esac
  done
  [ -n "$DETECTED" ] || DO_CLAUDE=true
elif [ "$STRATEGY" = "manual" ]; then
  echo -e "${BOLD}Responde 's' (sí) o 'n' (no) para cada entorno:${NC}"
  [[ "$(ask "  ¿Instalar en Claude Code (.claude)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CLAUDE=true
  [[ "$(ask "  ¿Instalar en Pi (.pi/agent)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_PI=true
  [[ "$(ask "  ¿Instalar en CommandCode (.commandcode)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_COMMANDCODE=true
  [[ "$(ask "  ¿Instalar en OpenCode (${OPENCODE_PATH#$BASE_DIR/})? [S/n]: " "s")" =~ ^[Ss] ]] && DO_OPENCODE=true
  [[ "$(ask "  ¿Instalar en Codex (.codex)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CODEX=true
  [[ "$(ask "  ¿Instalar en Copilot (.copilot)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_COPILOT=true
  if [ "$TARGET_MODE" = "local" ]; then
    [[ "$(ask "  ¿Instalar en Cursor (.cursor/rules)? [S/n]: " "s")" =~ ^[Ss] ]] && DO_CURSOR=true
  fi
  echo ""
fi

# 4. Deployment helpers
copy_dir() {
  local src_dir="$1" dest_dir="$2"
  mkdir -p "$dest_dir"
  cp -R "$src_dir/." "$dest_dir/"
}

# full bundle: agents + skills + commands + AGENTS.md
deploy_full() {
  local dest="$1"
  mkdir -p "$dest"
  copy_dir "$SRC/agents" "$dest/agents"
  copy_dir "$SRC/skills" "$dest/skills"
  copy_dir "$SRC/commands" "$dest/commands"
  cp "$SRC/AGENTS.md" "$dest/AGENTS.md"
}

label() {
  local dest="$1"; shift
  echo -e "  ${GREEN}✔${NC} ${dest#$HOME/} ($*)"
}

# 5. Core in local mode (files at project root)
if [ "$TARGET_MODE" = "local" ]; then
  mkdir -p "$BASE_DIR/skills" "$BASE_DIR/agents" "$BASE_DIR/commands"
  copy_dir "$SRC/skills" "$BASE_DIR/skills"
  copy_dir "$SRC/agents" "$BASE_DIR/agents"
  copy_dir "$SRC/commands" "$BASE_DIR/commands"
  cp "$SRC/AGENTS.md" "$BASE_DIR/AGENTS.md"
  cp "$SRC/CLAUDE.md" "$BASE_DIR/CLAUDE.md"
  cp "$SRC/GLOSSARY.md" "$BASE_DIR/GLOSSARY.md"
  label "$BASE_DIR" "core: /skills /agents /commands AGENTS.md CLAUDE.md GLOSSARY.md"
fi

# 6. Per-environment deployment

if [ "$DO_CLAUDE" = true ]; then
  DEST="${BASE_DIR}/.claude"
  mkdir -p "$DEST"
  copy_dir "$SRC/commands" "$DEST/commands"
  copy_dir "$SRC/skills" "$DEST/skills"
  cp "$SRC/AGENTS.md" "$DEST/AGENTS.md"
  cp "$SRC/CLAUDE.md" "$DEST/CLAUDE.md"
  cp "$SRC/GLOSSARY.md" "$DEST/GLOSSARY.md"
  label "$DEST" "commands skills AGENTS.md CLAUDE.md GLOSSARY.md"
fi

if [ "$DO_PI" = true ]; then
  DEST="${BASE_DIR}/.pi/agent"
  deploy_full "$DEST"
  cp "$SRC/GLOSSARY.md" "$DEST/GLOSSARY.md"
  label "$DEST" "AGENTS.md agents skills commands GLOSSARY.md"
fi

if [ "$DO_COMMANDCODE" = true ]; then
  DEST="${BASE_DIR}/.commandcode"
  deploy_full "$DEST"
  label "$DEST" "AGENTS.md agents skills commands"
fi

if [ "$DO_OPENCODE" = true ]; then
  DEST="$OPENCODE_PATH"
  deploy_full "$DEST"
  label "$DEST" "AGENTS.md agents skills commands"
fi

if [ "$DO_CODEX" = true ]; then
  DEST="${BASE_DIR}/.codex"
  mkdir -p "$DEST"
  cp "$SRC/AGENTS.md" "$DEST/instructions.md"
  cp "$SRC/AGENTS.md" "$DEST/AGENTS.md"
  label "$DEST" "instructions.md AGENTS.md"
fi

if [ "$DO_COPILOT" = true ]; then
  DEST="${BASE_DIR}/.copilot"
  deploy_full "$DEST"
  cp "$SRC/AGENTS.md" "$DEST/copilot-instructions.md"
  if [ "$TARGET_MODE" = "local" ]; then
    mkdir -p "${BASE_DIR}/.github"
    cp "$SRC/AGENTS.md" "${BASE_DIR}/.github/copilot-instructions.md"
  fi
  label "$DEST" "AGENTS.md copilot-instructions.md agents skills commands"
fi

if [ "$DO_CURSOR" = true ]; then
  DEST="${BASE_DIR}/.cursor/rules"
  mkdir -p "$DEST"
  cp "$SRC/AGENTS.md" "$DEST/agents.mdc"
  label "$DEST" "agents.mdc"
fi

echo -e "\n${GREEN}${BOLD}Listo.${NC} Despliegue completado con éxito.\n"
