#!/bin/bash

# Duet App - Setup Script
# Usage: ./scripts/setup.sh [dev|prod]

set -e

MODE=${1:-dev}

echo "🎵 Setting up Duet App ($MODE mode)..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "  $1"; }

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    error "Node.js is required. Install from nodejs.org"
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ required (found v$NODE_VERSION)"
fi
success "Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
    error "npm is required"
fi
success "npm $(npm -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
success "Dependencies installed"

# Check for Firebase config files
echo ""
echo "Checking Firebase configuration..."

if [ ! -f "google-services.json" ]; then
    warn "google-services.json not found (required for Android)"
    info "Download from Firebase Console → Project Settings → Add Android App"
fi

if [ ! -f "GoogleService-Info.plist" ]; then
    warn "GoogleService-Info.plist not found (required for iOS)"
    info "Download from Firebase Console → Project Settings → Add iOS App"
fi

# Check Expo login
echo ""
echo "Checking Expo..."
if ! command -v eas &> /dev/null; then
    info "Installing EAS CLI..."
    npm install -g eas-cli
fi
success "EAS CLI installed"

if ! eas whoami &> /dev/null 2>&1; then
    warn "Not logged in to Expo"
    info "Run: eas login"
fi

# Production-specific checks
if [ "$MODE" == "prod" ]; then
    echo ""
    echo "Production checks..."

    # Check Firebase CLI
    if ! command -v firebase &> /dev/null; then
        info "Installing Firebase CLI..."
        npm install -g firebase-tools
    fi
    success "Firebase CLI installed"

    if ! firebase projects:list &> /dev/null 2>&1; then
        warn "Not logged in to Firebase"
        info "Run: firebase login"
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        warn "Terraform not installed (required for TURN server)"
        info "Install from terraform.io"
    else
        success "Terraform $(terraform -v | head -1 | cut -d'v' -f2)"
    fi

    # Check for secrets
    echo ""
    echo "Environment variables needed for CI/CD:"
    info "EXPO_TOKEN - Expo access token"
    info "FIREBASE_TOKEN - Firebase CI token"
    info "FIREBASE_PROJECT_ID - Your Firebase project"
    info "DIGITALOCEAN_TOKEN - DigitalOcean API token"
    info "TURN_USERNAME - TURN server username"
    info "TURN_PASSWORD - TURN server password"
fi

# Summary
echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""

if [ "$MODE" == "dev" ]; then
    echo "To start development:"
    echo "  npm start"
    echo ""
    echo "To run on device:"
    echo "  npm run ios     # iOS"
    echo "  npm run android # Android"
else
    echo "Next steps for production:"
    echo ""
    echo "1. Add Firebase config files:"
    echo "   - google-services.json (Android)"
    echo "   - GoogleService-Info.plist (iOS)"
    echo ""
    echo "2. Deploy Firebase backend:"
    echo "   cd firebase/functions && npm install && npm run build"
    echo "   firebase deploy"
    echo ""
    echo "3. Deploy TURN server:"
    echo "   cd server/terraform"
    echo "   terraform init && terraform apply"
    echo ""
    echo "4. Build and submit:"
    echo "   eas build --platform all --profile production"
    echo "   eas submit --platform all"
    echo ""
    echo "See docs/DEPLOYMENT.md for detailed instructions."
fi
