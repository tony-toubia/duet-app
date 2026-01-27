# Duet App - Deployment Guide

Complete guide for deploying Duet to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Firebase Setup](#firebase-setup)
4. [TURN Server Setup](#turn-server-setup)
5. [App Store Deployment](#app-store-deployment)
6. [CI/CD Configuration](#cicd-configuration)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- **Expo Account** - [expo.dev](https://expo.dev)
- **Firebase Account** - [firebase.google.com](https://firebase.google.com)
- **Apple Developer Account** - For iOS deployment ($99/year)
- **Google Play Console** - For Android deployment ($25 one-time)
- **DigitalOcean/AWS/GCP** - For TURN server (~$6/month)

### Required Tools

```bash
# Node.js 18+
node --version

# Expo CLI
npm install -g expo-cli eas-cli

# Firebase CLI
npm install -g firebase-tools

# Terraform (for TURN server)
brew install terraform  # macOS
# or download from terraform.io
```

---

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-org/duet-app.git
cd duet-app

# Install dependencies
npm install

# Login to services
expo login
firebase login
```

### 2. Set Up Firebase Project

```bash
# Create Firebase project (or use existing)
firebase projects:create duet-app-prod

# Initialize Firebase in the app
firebase init
# Select: Realtime Database, Functions
```

### 3. Add Firebase Config Files

**Android:** Download `google-services.json` from Firebase Console → Project Settings → Add Android App
- Place in root directory

**iOS:** Download `GoogleService-Info.plist` from Firebase Console → Project Settings → Add iOS App
- Place in root directory

### 4. Deploy Backend

```bash
# Deploy Firebase
cd firebase/functions && npm install && npm run build
firebase deploy --only database,functions

# Deploy TURN server (see detailed section below)
```

### 5. Build & Deploy App

```bash
# Build for both platforms
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

---

## Firebase Setup

### 1. Create Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project"
3. Name it `duet-app` (or your preferred name)
4. Enable Google Analytics (optional)

### 2. Enable Services

**Realtime Database:**
1. Build → Realtime Database → Create Database
2. Choose region closest to your users
3. Start in "locked mode" (we'll deploy rules)

**Authentication:**
1. Build → Authentication → Get Started
2. Enable "Anonymous" sign-in method

**Cloud Messaging:**
1. Project Settings → Cloud Messaging
2. For iOS: Upload APNs Authentication Key
   - Go to [Apple Developer](https://developer.apple.com/account/resources/authkeys/list)
   - Create new key with APNs enabled
   - Download and upload to Firebase

### 3. Deploy Security Rules

```bash
# Copy rules file
cp firebase/database.rules.json database.rules.json

# Deploy
firebase deploy --only database
```

### 4. Deploy Cloud Functions

```bash
cd firebase/functions
npm install
npm run build
firebase deploy --only functions
```

### 5. Verify Deployment

```bash
# Check function logs
firebase functions:log

# Test database rules
firebase database:rules:get
```

---

## TURN Server Setup

### Option A: Automated (Terraform)

**1. Configure Secrets**

Add to GitHub Secrets:
- `DIGITALOCEAN_TOKEN` - DigitalOcean API token
- `TURN_USERNAME` - e.g., `duet`
- `TURN_PASSWORD` - Generate with `openssl rand -hex 32`

**2. Deploy via GitHub Actions**

1. Go to Actions → "Deploy TURN Server"
2. Click "Run workflow"
3. Select region (e.g., `nyc1`)
4. Choose action: `apply`
5. Wait for deployment (~3 minutes)

**3. Update App Config**

Copy the output from GitHub Actions to `src/config/turn.ts`:

```typescript
const PRODUCTION_TURN: TurnServer[] = [
  {
    urls: 'turn:YOUR_SERVER_IP:3478',
    username: 'duet',
    credential: 'YOUR_PASSWORD',
  },
  {
    urls: 'turn:YOUR_SERVER_IP:3478?transport=tcp',
    username: 'duet',
    credential: 'YOUR_PASSWORD',
  },
];
```

### Option B: Manual (Docker)

**1. Provision Server**

Create a VPS with:
- Ubuntu 22.04
- 1 vCPU, 1GB RAM minimum
- Public IP address

**2. Configure Firewall**

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Configure UFW
ufw allow 22/tcp      # SSH
ufw allow 3478/udp    # STUN/TURN
ufw allow 3478/tcp    # STUN/TURN TCP
ufw allow 5349/tcp    # TURN TLS
ufw allow 49152:65535/udp  # Media relay
ufw enable
```

**3. Deploy coturn**

```bash
# Copy files
scp -r server/* root@YOUR_SERVER_IP:/opt/duet-turn/

# SSH and configure
ssh root@YOUR_SERVER_IP
cd /opt/duet-turn

# Edit configuration
nano turnserver.conf
# Set: external-ip=YOUR_SERVER_IP
# Set: user=duet:YOUR_PASSWORD

# Start
docker-compose up -d
```

**4. Verify**

Test at https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

---

## App Store Deployment

### Google Play Store

**1. Create App**

1. Go to [Play Console](https://play.google.com/console)
2. Create app → Enter details

**2. Configure EAS**

```bash
# Set up credentials
eas credentials --platform android
# Choose: Build credentials → Create new keystore
```

**3. Build & Submit**

```bash
# Build production APK/AAB
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

**4. Complete Store Listing**

- App screenshots (phone + tablet)
- Feature graphic (1024x500)
- Privacy policy URL
- App description

### Apple App Store

**1. Create App**

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → + → New App

**2. Configure EAS**

```bash
# Set up credentials
eas credentials --platform ios
# Choose: Build credentials → Use existing or create new
```

**3. Build & Submit**

```bash
# Build production IPA
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

**4. Complete Store Listing**

- Screenshots for all device sizes
- App preview video (optional)
- Privacy policy URL
- App description

---

## CI/CD Configuration

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token from expo.dev |
| `FIREBASE_TOKEN` | Firebase CI token (`firebase login:ci`) |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `DIGITALOCEAN_TOKEN` | DigitalOcean API token |
| `TURN_USERNAME` | TURN server username |
| `TURN_PASSWORD` | TURN server password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | JSON key for Play Store |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for Apple ID |

### Generate Tokens

```bash
# Expo token
expo login
expo whoami  # Note your username
# Create at expo.dev/settings/access-tokens

# Firebase token
firebase login:ci
# Copy the token

# DigitalOcean token
# Create at cloud.digitalocean.com/account/api/tokens
```

### Workflow Triggers

| Workflow | Trigger |
|----------|---------|
| `build.yml` | Push to main, PR, or version tag |
| `firebase.yml` | Push to main with changes in `firebase/` |
| `turn-server.yml` | Manual trigger only |

---

## Monitoring

### Firebase

```bash
# View function logs
firebase functions:log --only cleanupStaleRooms

# View database usage
# Firebase Console → Realtime Database → Usage
```

### TURN Server

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# View logs
docker logs -f duet-turn

# Check status
docker ps

# View bandwidth
docker stats duet-turn
```

### Crashlytics

1. Firebase Console → Crashlytics
2. View crash reports by version
3. Set up alerts for new issues

---

## Troubleshooting

### Build Failures

**"Missing google-services.json"**
```bash
# Download from Firebase Console and place in root
```

**"Code signing error" (iOS)**
```bash
eas credentials --platform ios
# Revoke and recreate if needed
```

### Connection Issues

**"ICE failed"**
- Check TURN server is running: `docker ps`
- Verify firewall ports are open
- Test TURN server at webrtc.github.io

**"Audio not working"**
- Check microphone permissions granted
- Verify Bluetooth not in HFP mode
- Check Crashlytics for native errors

### Push Notifications Not Working

**iOS:**
- Verify APNs key uploaded to Firebase
- Check entitlements in Xcode

**Android:**
- Verify google-services.json is correct
- Check notification channel created

---

## Cost Estimation

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| Firebase Realtime DB | 1GB storage, 10GB/month | $0-5/month |
| Firebase Functions | 2M invocations | $0 |
| Cloud Messaging | Unlimited | $0 |
| TURN Server | - | $6/month |
| Apple Developer | - | $99/year |
| Google Play | - | $25 one-time |

**Total for 1000 DAU:** ~$15/month + store fees

---

## Security Checklist

- [ ] Firebase rules deployed
- [ ] TURN server uses strong password
- [ ] TLS enabled on TURN server (if using domain)
- [ ] APNs key secured
- [ ] Secrets not committed to repo
- [ ] Anonymous auth enabled (not email/password)
- [ ] Crashlytics enabled for error tracking

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/duet-app/issues)
- **Expo:** [Expo Forums](https://forums.expo.dev)
- **Firebase:** [Firebase Support](https://firebase.google.com/support)
