# Audio Companion App — Technical Architecture & MVP Spec

**Project Codename:** Duet  
**Version:** 0.1 Draft  
**Date:** December 2024  
**Author:** Tony + Claude

---

## Executive Summary

Duet is an always-on voice communication app that overlays partner audio onto whatever you're already listening to — music, podcasts, or ambient sound. Unlike walkie-talkie apps that interrupt your audio or require push-to-talk, Duet uses intelligent audio ducking to seamlessly blend conversation with your media.

### Core Problem
Couples and small groups exploring noisy environments (cities, concerts, theme parks) struggle to communicate while wearing headphones for music. Current solutions either:
- Require removing headphones (defeats the purpose)
- Use push-to-talk (clunky UX, interrupts flow)
- Pause music during voice (jarring experience)

### Solution
An always-on voice channel that:
1. Automatically detects when your partner speaks
2. Ducks (lowers) your music volume
3. Overlays their voice on top
4. Restores music when they stop talking

---

## Technical Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEVICE A (You)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Music App  │    │  Duet App    │    │   Audio Output   │  │
│  │  (Spotify)   │───▶│  Audio Mixer │───▶│   (Headphones)   │  │
│  └──────────────┘    │              │    └──────────────────┘  │
│                      │   ┌──────┐   │                          │
│                      │   │ VAD  │   │                          │
│                      │   └──────┘   │                          │
│  ┌──────────────┐    │      │       │                          │
│  │  Microphone  │───▶│      ▼       │                          │
│  └──────────────┘    │  ┌───────┐   │                          │
│                      │  │Encoder│   │                          │
│                      └──┴───┬───┴───┘                          │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │      TRANSPORT LAYER          │
              │  ┌─────────┐   ┌───────────┐  │
              │  │Bluetooth│   │  Network  │  │
              │  │  (P2P)  │   │  (WebRTC) │  │
              │  └─────────┘   └───────────┘  │
              └───────────────┬───────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                         DEVICE B (Partner)                      │
│                      (Mirror architecture)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Voice Activity Detection (VAD)

The brain of the system. Determines when someone is actually speaking vs. background noise.

**Approach:** WebRTC's built-in VAD + custom ML model for noisy environments

```
Input Audio Stream
       │
       ▼
┌──────────────────┐
│  Pre-processing  │  ← Noise gate, high-pass filter
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   WebRTC VAD     │  ← Fast, low-latency detection
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ML Refinement   │  ← Reduces false positives in noisy environments
│  (Optional)      │
└────────┬─────────┘
         │
         ▼
   Speaking: true/false
```

**Key Parameters:**
- Detection latency: < 50ms
- False positive rate: < 5% in 70dB ambient noise
- Minimum speech duration: 200ms (avoids triggering on coughs/sighs)

### 2. Audio Ducking Engine

Smoothly reduces music volume when partner voice is detected.

**Ducking Curve:**
```
Music Volume
100% ┤────────┐
     │        │
 70% ┤        └─────────────────┐
     │          ↑               │
 30% ┤     Duck start     Duck end
     │    (partner speaks)  (partner stops + 500ms)
     └────────────────────────────────── Time
```

**Parameters (User Configurable):**
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Duck Level | 30% | 10-50% | How much to lower music |
| Attack Time | 100ms | 50-200ms | How fast to duck |
| Release Time | 500ms | 200-1000ms | How fast to restore |
| Voice Boost | +6dB | 0-12dB | Partner voice amplification |

### 3. Audio Mixing Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    AUDIO MIXER                          │
│                                                         │
│   Music Input ──┬──▶ [Ducker] ──┬──▶ Output Mix        │
│                 │               │                       │
│   Partner Voice ┴──▶ [Boost]  ──┘                      │
│                                                         │
│   Your Voice ──────▶ [Encoder] ──▶ Transport Layer     │
└─────────────────────────────────────────────────────────┘
```

**iOS Implementation:**
- AVAudioEngine for mixing
- AVAudioSession category: `.playAndRecord` with `.mixWithOthers`
- Requires background audio entitlement

**Android Implementation:**
- AudioTrack + AudioRecord with STREAM_VOICE_CALL
- Oboe library for low-latency audio
- Foreground service for background operation

### 4. Transport Layer (Dual-Mode)

#### Mode A: Bluetooth Direct (Proximity)
- **When:** Devices within ~30 feet
- **Latency:** 20-50ms
- **Protocol:** Bluetooth LE Audio (LC3 codec) or Classic Bluetooth (SCO)
- **Pros:** No internet required, lowest latency, no server costs
- **Cons:** Limited range, connection can be finicky

#### Mode B: Network (WebRTC)
- **When:** Bluetooth unavailable or out of range
- **Latency:** 100-300ms typical
- **Protocol:** WebRTC with Opus codec
- **Pros:** Unlimited range, reliable
- **Cons:** Requires internet, some latency

**Auto-Switching Logic:**
```
┌─────────────────────────────────────────┐
│           Connection Manager            │
├─────────────────────────────────────────┤
│                                         │
│  IF bluetooth_connected AND             │
│     bluetooth_quality > threshold:      │
│       USE bluetooth                     │
│                                         │
│  ELSE IF network_available:             │
│       USE webrtc                        │
│                                         │
│  ELSE:                                  │
│       SHOW "no connection" indicator    │
│                                         │
└─────────────────────────────────────────┘
```

### 5. Group & Privacy System

```
┌─────────────────────────────────────────────────────────┐
│                    GROUP STRUCTURE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Group (max 6 members for MVP)                         │
│   ├── Owner (creator)                                   │
│   │   └── Can invite/remove members                     │
│   │   └── Can delete group                              │
│   │                                                     │
│   └── Members                                           │
│       └── Can mute self                                 │
│       └── Can mute incoming audio                       │
│       └── Can leave group                               │
│                                                         │
│   Invite Flow:                                          │
│   1. Owner generates invite code (expires 24h)          │
│   2. Invitee enters code in app                         │
│   3. Owner approves join request                        │
│   4. E2E encrypted channel established                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Encryption:**
- Signal Protocol for key exchange
- AES-256 for voice data
- No voice data stored on servers (peer-to-peer when possible)

---

## Platform-Specific Challenges

### iOS Challenges

| Challenge | Solution |
|-----------|----------|
| Background audio restrictions | Proper audio session configuration, background modes |
| Bluetooth audio routing | AVAudioSession.setPreferredInput() + careful session management |
| CallKit integration? | Optional - could make it behave like a "call" for system integration |
| Music ducking | MPVolumeView doesn't work; must use system audio mixing |
| Spotify/Apple Music control | Can't directly control third-party apps; rely on system ducking |

**Critical iOS Insight:**
iOS doesn't let apps directly lower other apps' volume. Instead, we use:
1. `AVAudioSession` with `.duckOthers` option
2. System handles ducking other audio automatically when we play our voice audio

### Android Challenges

| Challenge | Solution |
|-----------|----------|
| Audio focus | Request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK |
| Background restrictions (Android 12+) | Foreground service + notification |
| Bluetooth SCO routing | AudioManager.startBluetoothSco() |
| Device fragmentation | Oboe library abstracts audio path differences |
| Battery optimization | Exempt from Doze mode via foreground service |

---

## MVP Feature Set (v1.0)

### Must Have (Launch Blockers)
- [ ] Two-person groups (couples mode)
- [ ] Always-on voice with auto-ducking
- [ ] Network-based communication (WebRTC)
- [ ] Mute self toggle
- [ ] Mute incoming toggle
- [ ] Basic onboarding flow
- [ ] Simple invite system (share code)
- [ ] Works while screen is off

### Should Have (v1.1)
- [ ] Bluetooth P2P mode for lower latency
- [ ] Adjustable duck level
- [ ] Connection quality indicator
- [ ] Battery usage optimization
- [ ] "Tap to talk" option for those who prefer it
- [ ] Widget for quick mute toggle

### Nice to Have (v1.2+)
- [ ] Groups up to 6 people
- [ ] Spatial audio (partner voice positioned left/right)
- [ ] Voice-activated mute ("Hey Duet, mute")
- [ ] Apple Watch / WearOS companion
- [ ] Location sharing within group
- [ ] Integration with Find My / Google Find

---

## User Interface Concept

### Main Screen (Connected State)

```
┌─────────────────────────────────────┐
│  ◀  Duet                    ⚙️     │
├─────────────────────────────────────┤
│                                     │
│         ┌─────────────────┐         │
│         │                 │         │
│         │    👤  Sarah    │         │
│         │   ● Connected   │         │
│         │                 │         │
│         └─────────────────┘         │
│                                     │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│    Currently playing: Spotify       │
│    🎵 "Dreams" - Fleetwood Mac     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│     ┌─────────┐    ┌─────────┐     │
│     │   🎤    │    │   🔇    │     │
│     │  MUTE   │    │ DEAFEN  │     │
│     │  self   │    │ partner │     │
│     └─────────┘    └─────────┘     │
│                                     │
└─────────────────────────────────────┘
```

### Settings Screen

```
┌─────────────────────────────────────┐
│  ◀  Settings                        │
├─────────────────────────────────────┤
│                                     │
│  AUDIO                              │
│  ┌─────────────────────────────┐   │
│  │ Duck Level         ━━━●━━   │   │
│  │                      30%    │   │
│  ├─────────────────────────────┤   │
│  │ Voice Boost        ━━━━●━   │   │
│  │                      +6dB   │   │
│  ├─────────────────────────────┤   │
│  │ Release Delay      ━━●━━━   │   │
│  │                     500ms   │   │
│  └─────────────────────────────┘   │
│                                     │
│  CONNECTION                         │
│  ┌─────────────────────────────┐   │
│  │ Prefer Bluetooth      [ON]  │   │
│  ├─────────────────────────────┤   │
│  │ Auto-reconnect        [ON]  │   │
│  └─────────────────────────────┘   │
│                                     │
│  PRIVACY                            │
│  ┌─────────────────────────────┐   │
│  │ End-to-End Encryption  ✓    │   │
│  │ (Always on)                 │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## Technology Stack Recommendation

### Mobile App
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | React Native + Expo | Fast iteration, single codebase |
| Audio Engine | Native modules (Swift/Kotlin) | RN can't handle low-latency audio |
| State | Zustand | Lightweight, perfect for this scale |
| Navigation | React Navigation | Industry standard |
| Real-time | WebRTC (react-native-webrtc) | Best for voice P2P |

### Backend (Minimal)
| Service | Technology | Purpose |
|---------|------------|---------|
| Signaling | Cloudflare Workers | WebRTC connection setup |
| Auth | Firebase Auth | Simple, free tier sufficient |
| Groups | Firebase Firestore | Real-time group membership |
| TURN Server | Cloudflare Calls or Twilio | NAT traversal fallback |

**Cost Estimate (MVP):**
- Firebase: Free tier (50K auth, 1GB storage)
- Cloudflare Workers: Free tier (100K requests/day)
- TURN: ~$0.001/minute of relayed audio (most calls are P2P)
- **Total MVP:** ~$20-50/month until significant scale

---

## Development Phases

### Phase 1: Proof of Concept (2-3 weeks)
**Goal:** Validate core audio mixing works on both platforms

- [ ] Basic React Native app shell
- [ ] Native audio module that captures mic + plays test tone
- [ ] Verify ducking works with Spotify playing
- [ ] WebRTC connection between two devices (no UI)

**Success Criteria:** Two phones can hear each other while both play music

### Phase 2: Core Features (4-6 weeks)
**Goal:** Functional couples mode

- [ ] User authentication
- [ ] Two-person group creation/joining
- [ ] Mute self / mute incoming
- [ ] Background operation on both platforms
- [ ] Basic settings (duck level, boost)

**Success Criteria:** You and your wife can use it exploring Brooklyn

### Phase 3: Polish & Beta (3-4 weeks)
**Goal:** Ready for TestFlight / Play Store beta

- [ ] Connection reliability improvements
- [ ] Battery optimization
- [ ] Onboarding flow
- [ ] Crash reporting (Sentry)
- [ ] Analytics (Mixpanel/Amplitude)
- [ ] App Store assets

**Success Criteria:** 10 beta testers use it for a week without major issues

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS audio session conflicts | High | High | Extensive testing with various music apps |
| Battery drain complaints | Medium | Medium | Aggressive optimization, clear user expectations |
| Bluetooth unreliable | High | Medium | Network fallback is primary; BT is enhancement |
| App Store rejection | Low | High | Follow all guidelines, clear privacy policy |
| WebRTC complexity | Medium | Medium | Use established libraries, have TURN fallback |

---

## Competitive Moat

1. **UX Focus:** No one else targets the "couples exploring together" use case
2. **Audio Quality:** Proper ducking vs. interrupt/pause
3. **Hybrid Transport:** Bluetooth when close, network when apart
4. **Privacy First:** E2E encryption, no voice storage

---

## Next Steps

1. **Validate audio mixing** — Build iOS/Android native POC
2. **Test with real users** — You + your wife in NYC
3. **Iterate on latency** — Is network latency acceptable?
4. **Refine UX** — What gestures feel natural?

---

## Appendix: Name Ideas

- **Duet** (current working title)
- **Sidekick**
- **Whisper**
- **Tandem**
- **Murmur**
- **Alongside**
- **PairTalk**
- **Echo** (might be taken)

---

*Document generated December 2024. Architecture subject to change based on POC findings.*
