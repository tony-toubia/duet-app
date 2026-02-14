#!/bin/bash

# Duet App - GitHub Secrets Setup
#
# This script pushes all required secrets to your GitHub repository.
# Run this locally after installing the GitHub CLI (gh).
#
# Prerequisites:
#   brew install gh    # macOS
#   gh auth login      # Authenticate with GitHub
#
# Usage:
#   ./scripts/setup-secrets.sh
#
# You can also pass values as environment variables to avoid prompts:
#   EXPO_TOKEN=xxx FIREBASE_TOKEN=xxx ./scripts/setup-secrets.sh

set -e

# Windows: add common GitHub CLI install paths
if [[ "$OS" == "Windows_NT" ]]; then
    export PATH="$PATH:/c/Program Files/GitHub CLI:/c/Program Files (x86)/GitHub CLI"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

success() { echo -e "${GREEN}  ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠ $1${NC}"; }
info()    { echo -e "${CYAN}  → $1${NC}"; }
header()  { echo -e "\n${BOLD}$1${NC}"; }

# =====================
# PRE-CHECKS
# =====================

echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Duet App - GitHub Secrets Setup    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"

# Check gh CLI - use gh.exe explicitly on Windows
if [[ "$OS" == "Windows_NT" ]]; then
    GH_CMD="gh.exe"
else
    GH_CMD="gh"
fi

if ! command -v "$GH_CMD" &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) not found.${NC}"
    echo "Install: brew install gh (macOS) or see https://cli.github.com"
    exit 1
fi

# On Windows, alias gh to gh.exe for the rest of the script
if [[ "$OS" == "Windows_NT" ]]; then
    alias gh='gh.exe'
    shopt -s expand_aliases
fi

# Check gh auth
if ! gh auth status &> /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with GitHub.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Detect repo
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
if [ -z "$REPO" ]; then
    echo -e "${RED}Error: Not in a GitHub repository.${NC}"
    exit 1
fi

echo -e "\nRepository: ${BOLD}$REPO${NC}\n"

# Helper: prompt for secret value
prompt_secret() {
    local name="$1"
    local description="$2"
    local how_to_get="$3"
    local env_var="${!name}"
    local value=""

    echo ""
    echo -e "${BOLD}$name${NC}"
    echo -e "  $description"
    echo -e "  ${CYAN}$how_to_get${NC}"

    if [ -n "$env_var" ]; then
        value="$env_var"
        info "Using value from environment variable"
    else
        echo -n "  Enter value (or press Enter to skip): "
        read -s value
        echo ""
    fi

    if [ -n "$value" ]; then
        echo "$value" | gh secret set "$name" --repo "$REPO"
        success "$name set"
        return 0
    else
        warn "$name skipped"
        return 1
    fi
}

# Helper: generate and set a secret
generate_secret() {
    local name="$1"
    local description="$2"
    local env_var="${!name}"

    echo ""
    echo -e "${BOLD}$name${NC}"
    echo -e "  $description"

    if [ -n "$env_var" ]; then
        echo "$env_var" | gh secret set "$name" --repo "$REPO"
        success "$name set from environment"
        return 0
    fi

    local generated=$(openssl rand -hex 32)
    echo -e "  Generated: ${CYAN}${generated:0:8}...${NC} (full value stored as secret)"
    echo "$generated" | gh secret set "$name" --repo "$REPO"
    success "$name set (auto-generated)"

    # Return generated value for display
    echo "$generated"
}

# =====================
# SECRETS SETUP
# =====================

SKIPPED=0
SET=0

header "═══ App Build Secrets ═══"

prompt_secret \
    "EXPO_TOKEN" \
    "Expo access token for EAS builds" \
    "Get at: https://expo.dev/settings/access-tokens → Create Token" \
    && ((SET++)) || ((SKIPPED++))

header "═══ Firebase Secrets ═══"

prompt_secret \
    "FIREBASE_TOKEN" \
    "Firebase CI token for deployments" \
    "Run: firebase login:ci → copy the token" \
    && ((SET++)) || ((SKIPPED++))

prompt_secret \
    "FIREBASE_PROJECT_ID" \
    "Your Firebase project ID" \
    "Firebase Console → Project Settings → Project ID" \
    && ((SET++)) || ((SKIPPED++))

header "═══ TURN Server Secrets ═══"

prompt_secret \
    "DIGITALOCEAN_TOKEN" \
    "DigitalOcean API token for TURN server deployment" \
    "Get at: https://cloud.digitalocean.com/account/api/tokens" \
    && ((SET++)) || ((SKIPPED++))

prompt_secret \
    "TURN_USERNAME" \
    "TURN server username" \
    "Your choice (e.g., 'duet')" \
    && ((SET++)) || ((SKIPPED++))

# Auto-generate TURN password if not provided
echo ""
echo -e "${BOLD}TURN_PASSWORD${NC}"
echo -e "  TURN server password (auto-generated if not provided)"

if [ -n "$TURN_PASSWORD" ]; then
    echo "$TURN_PASSWORD" | gh secret set "TURN_PASSWORD" --repo "$REPO"
    success "TURN_PASSWORD set from environment"
    ((SET++))
else
    echo -n "  Enter value (or press Enter to auto-generate): "
    read -s value
    echo ""

    if [ -n "$value" ]; then
        echo "$value" | gh secret set "TURN_PASSWORD" --repo "$REPO"
        success "TURN_PASSWORD set"
        ((SET++))
    else
        GENERATED_PW=$(openssl rand -hex 32)
        echo "$GENERATED_PW" | gh secret set "TURN_PASSWORD" --repo "$REPO"
        success "TURN_PASSWORD set (auto-generated)"
        echo -e "  ${YELLOW}Save this password:${NC} $GENERATED_PW"
        ((SET++))
    fi
fi

header "═══ Store Submission Secrets ═══"

prompt_secret \
    "GOOGLE_PLAY_SERVICE_ACCOUNT" \
    "Google Play service account JSON key" \
    "Play Console → Setup → API Access → Create Service Account → Download JSON" \
    && ((SET++)) || ((SKIPPED++))

prompt_secret \
    "APPLE_APP_SPECIFIC_PASSWORD" \
    "Apple app-specific password for App Store submission" \
    "Get at: https://appleid.apple.com → Sign In → App-Specific Passwords" \
    && ((SET++)) || ((SKIPPED++))

# =====================
# SUMMARY
# =====================

echo ""
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Secrets set:    $SET${NC}"
echo -e "${YELLOW}  Secrets skipped: $SKIPPED${NC}"
echo -e "${BOLD}══════════════════════════════════════${NC}"

echo ""
echo "To verify: gh secret list --repo $REPO"
echo ""

if [ $SKIPPED -gt 0 ]; then
    echo "To set skipped secrets later, run this script again"
    echo "or set them individually:"
    echo "  echo 'value' | gh secret set SECRET_NAME"
fi

echo ""
echo "Next steps:"
echo "  1. Add Firebase config files to project root:"
echo "     - google-services.json (Android)"
echo "     - GoogleService-Info.plist (iOS)"
echo "  2. Deploy TURN server:"
echo "     GitHub Actions → Deploy TURN Server → Run workflow"
echo "  3. Release app:"
echo "     git tag v1.0.0 && git push --tags"
