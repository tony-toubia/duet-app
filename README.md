# Duet - Always-On Voice Companion App

An audio companion app that overlays voice communication onto your music, enabling seamless communication with your partner while exploring noisy environments.

## 🎯 What This Does

- **Always-on voice** - No push-to-talk, just speak naturally
- **Audio ducking** - Your music automatically lowers when your partner speaks
- **Cross-platform** - Works between iPhone and Android
- **Background operation** - Keeps working when your phone is locked

## 📱 Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Xcode 15+ (for iOS builds)
- Android Studio (for Android builds)
- Firebase project (for signaling)

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd duet-app
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project called "Duet"
3. Enable **Anonymous Authentication**:
   - Authentication → Sign-in method → Anonymous → Enable
4. Create **Realtime Database**:
   - Build → Realtime Database → Create Database
   - Start in test mode (we'll secure it later)
5. Get your config:
   - Project Settings → Your apps → Add app
   - Add iOS app (bundle ID: `com.duet.app`)
   - Add Android app (package: `com.duet.app`)
   - Download `GoogleService-Info.plist` and `google-services.json`

### 3. Add Firebase Config Files

```bash
# iOS - place in ios/ folder (after prebuild)
cp ~/Downloads/GoogleService-Info.plist ios/

# Android - place in android/app/ folder (after prebuild)
cp ~/Downloads/google-services.json android/app/
```

### 4. Generate Native Projects

```bash
# This creates the ios/ and android/ folders with native code
npx expo prebuild
```

### 5. Add Native Modules

After prebuild, you need to add our custom native audio modules:

#### iOS

Copy the Swift files to your Xcode project:

```bash
# Open Xcode
open ios/duet.xcworkspace
```

In Xcode:
1. Right-click on the `duet` folder → Add Files to "duet"
2. Add both files from `ios/DuetAudio/`:
   - `DuetAudioManager.swift`
   - `DuetAudioManager.m`
3. When prompted, select "Create Bridging Header" if asked

#### Android

The Kotlin files should already be in place. Register the package:

Edit `android/app/src/main/java/com/duet/MainApplication.kt`:

```kotlin
// Add import
import com.duet.audio.DuetAudioPackage

// In getPackages(), add:
packages.add(DuetAudioPackage())
```

### 6. Build and Run

#### Development Build (Recommended for Testing)

```bash
# Build for both platforms
eas build --profile development --platform all

# Or just one platform
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install the development build on your devices, then:

```bash
# Start the dev server
npx expo start --dev-client
```

#### Local Build (If you have Xcode/Android Studio set up)

```bash
# iOS (requires Mac with Xcode)
npx expo run:ios --device

# Android
npx expo run:android --device
```

## 📁 Project Structure

```
duet-app/
├── App.tsx                 # Main app component with UI
├── src/
│   ├── native/
│   │   └── DuetAudio.ts   # TypeScript bridge to native modules
│   ├── services/
│   │   ├── WebRTCService.ts    # Peer-to-peer audio streaming
│   │   └── SignalingService.ts # Firebase room management
│   └── hooks/
│       └── useDuetStore.ts     # Zustand state management
├── ios/
│   └── DuetAudio/
│       ├── DuetAudioManager.swift  # iOS native audio
│       └── DuetAudioManager.m      # Objective-C bridge
└── android/
    └── app/src/main/java/com/duet/audio/
        ├── DuetAudioManager.kt     # Android native audio
        └── DuetAudioPackage.kt     # React Native registration
```

## 🔧 How It Works

### Audio Ducking

**iOS**: Uses `AVAudioSession` with `.duckOthers` option. When our app plays audio (partner's voice), iOS automatically lowers the volume of other apps (Spotify, Apple Music).

**Android**: Requests audio focus with `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`. The system tells other apps to lower their volume.

### Voice Activity Detection (VAD)

We calculate the RMS (root mean square) of audio samples to detect when you're speaking. Only transmit audio when voice is detected → saves bandwidth and avoids unnecessary ducking.

### WebRTC Data Channels

Instead of using WebRTC's built-in audio tracks, we use data channels to send raw audio data. This gives us more control over the audio pipeline and lets us integrate with our native ducking system.

### Signaling (Firebase)

Firebase Realtime Database acts as the "meeting point" for two devices:
1. Device A creates a room → gets a 6-character code
2. Device B joins with the code
3. They exchange WebRTC offers/answers/ICE candidates via Firebase
4. Once connected, audio flows directly peer-to-peer (no server in between)

## 🔒 Firebase Security Rules

For production, update your Realtime Database rules:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['createdAt', 'createdBy'])",
        "members": {
          "$memberId": {
            ".validate": "$memberId === auth.uid"
          }
        }
      }
    }
  }
}
```

## 🧪 Testing Checklist

### Test Audio Ducking
- [ ] Open Spotify/Apple Music and play music
- [ ] Open Duet and create a room
- [ ] Have your partner join on their device
- [ ] Speak → your partner's music should duck
- [ ] Your partner speaks → your music should duck

### Test Latency
- [ ] Clap your hands while on the call
- [ ] Delay should be < 200ms

### Test Background Mode
- [ ] Connect to a room
- [ ] Lock your phone
- [ ] Music should continue playing
- [ ] Voice communication should still work

## 🐛 Troubleshooting

### "Microphone permission denied"
Go to Settings → Duet → Microphone → Enable

### "Music doesn't duck on Android"
Some music apps ignore audio focus requests. Spotify generally works well, but some apps may not honor the ducking request.

### "Connection keeps dropping"
- Check internet connection on both devices
- Try moving to an area with better signal
- The app will attempt to auto-reconnect

### "WebRTC connection fails"
You may need TURN servers for users behind strict NATs/firewalls. Add to `WebRTCService.ts`:

```typescript
{
  urls: 'turn:your-turn-server.com:443',
  username: 'user',
  credential: 'password',
}
```

Free options: Twilio (pay-as-you-go), Cloudflare Calls, Metered.ca

## 📝 Next Steps for MVP

1. **Add TURN servers** - For reliable connectivity through firewalls
2. **Test extensively** - Real-world testing in NYC 🗽
3. **Battery optimization** - Profile and optimize drain
4. **Polish UI** - Settings screen, onboarding flow
5. **TestFlight/Play Store beta** - Get external feedback

## 🚢 Production Checklist

- [ ] Add proper TURN server configuration
- [ ] Set up Firebase security rules
- [ ] Add analytics (Mixpanel/Amplitude)
- [ ] Add crash reporting (Sentry)
- [ ] Create App Store / Play Store listings
- [ ] Privacy policy and terms of service

## 📄 License

MIT - Build something cool with this!

---

Built with ❤️ for couples who explore together.
