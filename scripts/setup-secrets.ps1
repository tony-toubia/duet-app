# Duet App - GitHub Secrets Setup (PowerShell)
#
# This script pushes all required secrets to your GitHub repository.
# Run this locally after installing the GitHub CLI (gh).
#
# Prerequisites:
#   winget install GitHub.cli   # or https://cli.github.com
#   gh auth login               # Authenticate with GitHub
#
# Usage:
#   .\scripts\setup-secrets.ps1

$ErrorActionPreference = "Stop"

# =====================
# PRE-CHECKS
# =====================

Write-Host ""
Write-Host "+==============================================+" -ForegroundColor White
Write-Host "|   Duet App - GitHub Secrets Setup             |" -ForegroundColor White
Write-Host "+==============================================+" -ForegroundColor White
Write-Host ""

# Check gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "Error: GitHub CLI (gh) not found." -ForegroundColor Red
    Write-Host "Install: winget install GitHub.cli or see https://cli.github.com"
    exit 1
}

# Check gh auth
$authResult = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Not authenticated with GitHub." -ForegroundColor Red
    Write-Host "Run: gh auth login"
    exit 1
}

# Detect repo
$REPO = gh repo view --json nameWithOwner -q '.nameWithOwner' 2>$null
if (-not $REPO) {
    Write-Host "Error: Not in a GitHub repository." -ForegroundColor Red
    exit 1
}

Write-Host "Repository: $REPO" -ForegroundColor White
Write-Host ""

# Helper: prompt for secret value
function Prompt-Secret {
    param(
        [string]$Name,
        [string]$Description,
        [string]$HowToGet
    )

    Write-Host ""
    Write-Host $Name -ForegroundColor White
    Write-Host "  $Description"
    Write-Host "  $HowToGet" -ForegroundColor Cyan

    # Check environment variable
    $envValue = [System.Environment]::GetEnvironmentVariable($Name)
    if ($envValue) {
        Write-Host "  -> Using value from environment variable" -ForegroundColor Cyan
        $envValue | gh secret set $Name --repo $REPO
        Write-Host "  [OK] $Name set" -ForegroundColor Green
        return $true
    }

    $value = Read-Host "  Enter value (or press Enter to skip)"

    if ($value) {
        $value | gh secret set $Name --repo $REPO
        Write-Host "  [OK] $Name set" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  [SKIP] $Name skipped" -ForegroundColor Yellow
        return $false
    }
}

# =====================
# SECRETS SETUP
# =====================

$skipped = 0
$setCount = 0

Write-Host ""
Write-Host "=== App Build Secrets ===" -ForegroundColor White

if (Prompt-Secret -Name "EXPO_TOKEN" `
    -Description "Expo access token for EAS builds" `
    -HowToGet "Get at: https://expo.dev/settings/access-tokens -> Create Token") {
    $setCount++
} else { $skipped++ }

Write-Host ""
Write-Host "=== Firebase Secrets ===" -ForegroundColor White

if (Prompt-Secret -Name "FIREBASE_TOKEN" `
    -Description "Firebase CI token for deployments" `
    -HowToGet "Run: firebase login:ci -> copy the token") {
    $setCount++
} else { $skipped++ }

if (Prompt-Secret -Name "FIREBASE_PROJECT_ID" `
    -Description "Your Firebase project ID" `
    -HowToGet "Firebase Console -> Project Settings -> Project ID") {
    $setCount++
} else { $skipped++ }

Write-Host ""
Write-Host "=== TURN Server Secrets ===" -ForegroundColor White

if (Prompt-Secret -Name "DIGITALOCEAN_TOKEN" `
    -Description "DigitalOcean API token for TURN server deployment" `
    -HowToGet "Get at: https://cloud.digitalocean.com/account/api/tokens") {
    $setCount++
} else { $skipped++ }

if (Prompt-Secret -Name "TURN_USERNAME" `
    -Description "TURN server username" `
    -HowToGet "Your choice (e.g., 'duet')") {
    $setCount++
} else { $skipped++ }

# TURN_PASSWORD with auto-generate option
Write-Host ""
Write-Host "TURN_PASSWORD" -ForegroundColor White
Write-Host "  TURN server password (auto-generated if not provided)"

$envTurnPw = [System.Environment]::GetEnvironmentVariable("TURN_PASSWORD")
if ($envTurnPw) {
    $envTurnPw | gh secret set "TURN_PASSWORD" --repo $REPO
    Write-Host "  [OK] TURN_PASSWORD set from environment" -ForegroundColor Green
    $setCount++
} else {
    $value = Read-Host "  Enter value (or press Enter to auto-generate)"

    if ($value) {
        $value | gh secret set "TURN_PASSWORD" --repo $REPO
        Write-Host "  [OK] TURN_PASSWORD set" -ForegroundColor Green
        $setCount++
    } else {
        # Generate random password
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
        $generatedPw = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
        $generatedPw | gh secret set "TURN_PASSWORD" --repo $REPO
        Write-Host "  [OK] TURN_PASSWORD set (auto-generated)" -ForegroundColor Green
        Write-Host "  Save this password: $generatedPw" -ForegroundColor Yellow
        $setCount++
    }
}

Write-Host ""
Write-Host "=== Store Submission Secrets ===" -ForegroundColor White

if (Prompt-Secret -Name "GOOGLE_PLAY_SERVICE_ACCOUNT" `
    -Description "Google Play service account JSON key" `
    -HowToGet "Play Console -> Setup -> API Access -> Create Service Account -> Download JSON") {
    $setCount++
} else { $skipped++ }

if (Prompt-Secret -Name "APPLE_APP_SPECIFIC_PASSWORD" `
    -Description "Apple app-specific password for App Store submission" `
    -HowToGet "Get at: https://appleid.apple.com -> Sign In -> App-Specific Passwords") {
    $setCount++
} else { $skipped++ }

# =====================
# SUMMARY
# =====================

Write-Host ""
Write-Host "======================================" -ForegroundColor White
Write-Host "  Secrets set:    $setCount" -ForegroundColor Green
Write-Host "  Secrets skipped: $skipped" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor White
Write-Host ""
Write-Host "To verify: gh secret list --repo $REPO"
Write-Host ""

if ($skipped -gt 0) {
    Write-Host "To set skipped secrets later, run this script again"
    Write-Host "or set them individually:"
    Write-Host "  echo 'value' | gh secret set SECRET_NAME"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add Firebase config files to project root:"
Write-Host "     - google-services.json (Android)"
Write-Host "     - GoogleService-Info.plist (iOS)"
Write-Host "  2. Deploy TURN server:"
Write-Host "     GitHub Actions -> Deploy TURN Server -> Run workflow"
Write-Host "  3. Release app:"
Write-Host "     git tag v1.0.0 && git push --tags"
Write-Host ""
