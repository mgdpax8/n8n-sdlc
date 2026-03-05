#!/usr/bin/env bash
set -euo pipefail

# n8n SDLC Framework Installer
# Safely installs/updates the framework into an existing project.
# Only touches framework-owned files; never overwrites user files.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(cat "$SCRIPT_DIR/n8n-sdlc/VERSION" 2>/dev/null || echo "unknown")"

SDLC_RULES=("n8n-sdlc.md" "n8n-sdlc-workflow-structure.md")
SDLC_SKILL_PREFIX="n8n-sdlc-"

SKIP_CONFIGS=("config/project.json" "config/id-mappings.json" "config/secrets.json")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

DRY_RUN=false
UPDATE=false
COPIED=0
SKIPPED=0
UPDATED=0

usage() {
    cat <<EOF
${BOLD}n8n SDLC Framework Installer v${VERSION}${NC}

Usage: ./install.sh <target-directory> [options]

Options:
  --update    Update an existing installation (same as fresh install,
              but prints a diff summary of what changed)
  --dry-run   Preview what would be copied without making changes
  -h, --help  Show this help message

Examples:
  ./install.sh ~/projects/my-n8n-project          # Fresh install
  ./install.sh ~/projects/my-n8n-project --update  # Update existing
  ./install.sh ~/projects/my-n8n-project --dry-run  # Preview changes
EOF
}

log_info()  { echo -e "${CYAN}[info]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
log_skip()  { echo -e "${YELLOW}[skip]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
log_err()   { echo -e "${RED}[error]${NC} $*"; }
log_dry()   { echo -e "${YELLOW}[dry]${NC}   $*"; }

# Returns 0 (true) if $1 > $2 using numeric semver comparison
compare_semver_gt() {
    local IFS='.'
    read -r -a a <<< "$1"
    read -r -a b <<< "$2"
    local max=$(( ${#a[@]} > ${#b[@]} ? ${#a[@]} : ${#b[@]} ))
    for (( i=0; i<max; i++ )); do
        local ai=${a[i]:-0}
        local bi=${b[i]:-0}
        if (( ai > bi )); then return 0
        elif (( ai < bi )); then return 1; fi
    done
    return 1
}

is_skip_config() {
    local rel_path="$1"
    for skip in "${SKIP_CONFIGS[@]}"; do
        if [[ "$rel_path" == "$skip" ]]; then
            return 0
        fi
    done
    return 1
}

copy_file() {
    local src="$1"
    local dest="$2"
    local label="${3:-$dest}"

    if $DRY_RUN; then
        if [[ -f "$dest" ]]; then
            if diff -q "$src" "$dest" >/dev/null 2>&1; then
                log_dry "unchanged: $label"
                ((SKIPPED++)) || true
            else
                log_dry "would update: $label"
                ((UPDATED++)) || true
            fi
        else
            log_dry "would copy: $label"
            ((COPIED++)) || true
        fi
        return
    fi

    mkdir -p "$(dirname "$dest")"

    if [[ -f "$dest" ]]; then
        if diff -q "$src" "$dest" >/dev/null 2>&1; then
            ((SKIPPED++)) || true
            return
        fi
        cp "$src" "$dest"
        log_ok "updated: $label"
        ((UPDATED++)) || true
    else
        cp "$src" "$dest"
        log_ok "copied:  $label"
        ((COPIED++)) || true
    fi
}

copy_dir() {
    local src_dir="${1%/}"
    local dest_dir="$2"
    local label_prefix="${3:-}"
    local prefix_len=$(( ${#src_dir} + 1 ))

    while IFS= read -r -d '' file; do
        local rel="${file:$prefix_len}"
        local label="${label_prefix}${rel}"
        copy_file "$file" "$dest_dir/$rel" "$label"
    done < <(find "$src_dir" -type f -print0 2>/dev/null)
}

install_skills() {
    local target="$1"
    local src_skills="$SCRIPT_DIR/.cursor/skills"
    local dest_skills="$target/.cursor/skills"

    log_info "Skills (.cursor/skills/${SDLC_SKILL_PREFIX}*/)"

    for skill_dir in "$src_skills"/${SDLC_SKILL_PREFIX}*/; do
        [[ -d "$skill_dir" ]] || continue
        local skill_name
        skill_name="$(basename "$skill_dir")"
        copy_dir "$skill_dir" "$dest_skills/$skill_name" ".cursor/skills/$skill_name/"
    done
}

install_rules() {
    local target="$1"
    local src_rules="$SCRIPT_DIR/.cursor/rules"
    local dest_rules="$target/.cursor/rules"

    log_info "Rules (.cursor/rules/)"

    for rule_file in "${SDLC_RULES[@]}"; do
        if [[ -f "$src_rules/$rule_file" ]]; then
            copy_file "$src_rules/$rule_file" "$dest_rules/$rule_file" ".cursor/rules/$rule_file"
        fi
    done
}

install_sdlc_folder() {
    local target="$1"
    local src_sdlc="$SCRIPT_DIR/n8n-sdlc"
    local dest_sdlc="$target/n8n-sdlc"

    log_info "Framework files (n8n-sdlc/)"

    local sdlc_prefix_len=$(( ${#src_sdlc} + 1 ))
    while IFS= read -r -d '' file; do
        local rel="${file:$sdlc_prefix_len}"

        if is_skip_config "$rel"; then
            if [[ -f "$dest_sdlc/$rel" ]]; then
                log_skip "n8n-sdlc/$rel (user config, preserved)"
            fi
            continue
        fi

        copy_file "$file" "$dest_sdlc/$rel" "n8n-sdlc/$rel"
    done < <(find "$src_sdlc" -type f -print0 2>/dev/null)
}

write_sdlc_version() {
    local target="$1"
    local dest="$target/.sdlc-version"

    if $DRY_RUN; then
        log_dry "would write .sdlc-version = $VERSION"
        return
    fi

    echo "$VERSION" > "$dest"
    log_ok "wrote .sdlc-version = $VERSION"
}

# --- Main ---

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

TARGET=""
for arg in "$@"; do
    case "$arg" in
        --update)  UPDATE=true ;;
        --dry-run) DRY_RUN=true ;;
        -h|--help) usage; exit 0 ;;
        -*)        log_err "Unknown option: $arg"; usage; exit 1 ;;
        *)         TARGET="$arg" ;;
    esac
done

if [[ -z "$TARGET" ]]; then
    log_err "Target directory is required"
    usage
    exit 1
fi

TARGET="$(cd "$TARGET" 2>/dev/null && pwd || echo "$TARGET")"

if [[ ! -d "$TARGET" ]]; then
    log_err "Target directory does not exist: $TARGET"
    exit 1
fi

if [[ "$TARGET" == "$SCRIPT_DIR" ]]; then
    log_err "Cannot install into the SDLC source directory itself"
    exit 1
fi

echo ""
echo -e "${BOLD}n8n SDLC Framework Installer v${VERSION}${NC}"
echo -e "Source: ${CYAN}$SCRIPT_DIR${NC}"
echo -e "Target: ${CYAN}$TARGET${NC}"

if [[ -f "$TARGET/.sdlc-version" ]]; then
    INSTALLED="$(cat "$TARGET/.sdlc-version")"
    echo -e "Installed version: ${YELLOW}$INSTALLED${NC}"

    if [[ "$INSTALLED" == "$VERSION" ]] && ! $UPDATE && ! $DRY_RUN; then
        log_info "Already at v$VERSION. Use --update to force refresh."
        exit 0
    fi

    if compare_semver_gt "$INSTALLED" "$VERSION"; then
        log_warn "Installed version ($INSTALLED) is newer than source ($VERSION)"
    fi
fi

if $DRY_RUN; then
    echo -e "Mode: ${YELLOW}dry run (no changes will be made)${NC}"
else
    echo -e "Mode: ${GREEN}$(if $UPDATE; then echo "update"; else echo "install"; fi)${NC}"
fi

echo ""

install_skills "$TARGET"
install_rules "$TARGET"
install_sdlc_folder "$TARGET"

# Copy CLAUDE.md for Claude Code compatibility
if [[ -f "$SCRIPT_DIR/CLAUDE.md" ]]; then
    log_info "Claude Code config (CLAUDE.md)"
    copy_file "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md" "CLAUDE.md"
fi

write_sdlc_version "$TARGET"

echo ""
echo -e "${BOLD}Summary${NC}"
if $DRY_RUN; then
    echo -e "  Would copy:    ${GREEN}$COPIED${NC} new files"
    echo -e "  Would update:  ${CYAN}$UPDATED${NC} files"
    echo -e "  Unchanged:     $SKIPPED files"
    echo ""
    echo -e "${YELLOW}Dry run complete. No changes were made.${NC}"
else
    echo -e "  Copied:    ${GREEN}$COPIED${NC} new files"
    echo -e "  Updated:   ${CYAN}$UPDATED${NC} files"
    echo -e "  Unchanged: $SKIPPED files"
    echo ""
    echo -e "${GREEN}Installation complete.${NC}"
    if ! $UPDATE; then
        echo ""
        echo "Next steps:"
        echo "  1. Open the project in Cursor or Claude Code"
        echo "  2. Say \"get started\" to the AI to initialize your n8n project"
    fi
fi
