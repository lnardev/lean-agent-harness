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
  echo -e "Modo: ${BOLD}Global${NC} (${DIM}${BASE_DIR}${NC})\n"
else
  BASE_DIR="$PWD"
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

# 3. Environment detection (ids match the `target` column of manifest.tsv)
detect() {
  local shared=false
  [ -d "$BASE_DIR/.claude" ] && echo "claude"
  [ -d "$BASE_DIR/.commandcode" ] && echo "commandcode"
  if [ "$TARGET_MODE" = "global" ]; then
    [ -d "$BASE_DIR/.pi" ] && { echo "pi"; shared=true; }
    [ -d "$BASE_DIR/.codex" ] && { echo "codex"; shared=true; }
    [ -d "$BASE_DIR/.copilot" ] && { echo "copilot"; shared=true; }
    [ -d "$BASE_DIR/.config/opencode" ] && { echo "opencode"; shared=true; }
  else
    [ -d "$BASE_DIR/.opencode" ] && { echo "opencode"; shared=true; }
    for d in .pi .codex .github .cursor; do [ -d "$BASE_DIR/$d" ] && shared=true; done
  fi
  [ -d "$BASE_DIR/.agents" ] && shared=true
  [ "$shared" = true ] && echo "agents"
  return 0
}
# String-based, not an array: stock macOS ships bash 3.2 (no mapfile).
DETECTED="$(detect)"

# Space-separated target ids to deploy. "core" (root instruction files) is local-only in the manifest.
if [ "$TARGET_MODE" = "global" ]; then
  ALL_TARGETS="claude agents pi opencode codex copilot commandcode"
else
  ALL_TARGETS="claude agents opencode commandcode"
fi
SELECTED=""

# 3.5 Strategy fallback: non-TTY runs without an explicit strategy must not be a silent no-op
if [ -z "$STRATEGY" ] && [ -z "$TTY_DEV" ]; then
  [ -n "$DETECTED" ] && STRATEGY="auto" || STRATEGY="all"
fi

if [ -z "$STRATEGY" ]; then
  if [ -n "$DETECTED" ]; then
    echo -e "${BOLD}Se detectaron configuraciones para: ${GREEN}$(echo $DETECTED)${NC}\n"
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

case "$STRATEGY" in
  all)
    SELECTED="$ALL_TARGETS"
    echo -e "${DIM}Estrategia: todos los entornos soportados.${NC}\n"
    ;;
  auto)
    SELECTED="$DETECTED"
    [ -n "$SELECTED" ] || SELECTED="claude"   # nothing detected: Claude Code is the sensible baseline
    echo -e "${DIM}Estrategia: detectados ($(echo ${DETECTED:-ninguno})).${NC}\n"
    ;;
  manual)
    echo -e "${BOLD}Responde 's' (sí) o 'n' (no) para cada entorno:${NC}"
    for id in $ALL_TARGETS; do
      [[ "$(ask "  ¿Instalar en ${id}? [S/n]: " "s")" =~ ^[Ss] ]] && SELECTED="$SELECTED $id"
    done
    echo ""
    ;;
esac

# 4. Deployment helpers (semantics mirror bin/cli.js: manifest.tsv is the SSOT)
MANIFEST="$SRC/manifest.tsv"
[ -f "$MANIFEST" ] || { echo "manifest.tsv no encontrado en $SRC" >&2; exit 1; }

# Instruction file: a divergent existing destination is preserved as .bak.
# mode "if-missing": an existing destination is left untouched (seed files).
write_instruction() {
  local src="$1" dest="$2" mode="${3:-}"
  if [ "$mode" = "if-missing" ] && [ -e "$dest" ]; then return 0; fi
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ] && ! cmp -s "$src" "$dest"; then cp "$dest" "$dest.bak"; fi
  cp "$src" "$dest"
}

copy_dir() {
  mkdir -p "$2"
  cp -R "$1/." "$2/"
}

is_selected() {
  [ "$1" = "core" ] && [ "$TARGET_MODE" = "local" ] && return 0
  case " $SELECTED " in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

# 5. Deploy every manifest row of this scope whose target was selected
TAB="$(printf '\t')"
DEPLOYED=""
while IFS="$TAB" read -r scope tgt kind src dest mode; do
  case "$scope" in ""|\#*) continue ;; esac
  [ "$scope" = "$TARGET_MODE" ] || continue
  is_selected "$tgt" || continue
  case "$kind" in
    file) write_instruction "$SRC/$src" "$BASE_DIR/$dest" "${mode:-}" ;;
    dir) copy_dir "$SRC/$src" "$BASE_DIR/$dest" ;;
  esac
  case " $DEPLOYED " in *" $tgt "*) ;; *) DEPLOYED="$DEPLOYED $tgt"; echo -e "  ${GREEN}✔${NC} $tgt" ;; esac
done < "$MANIFEST"

echo -e "\n${GREEN}${BOLD}Listo.${NC} Despliegue completado con éxito.\n"
