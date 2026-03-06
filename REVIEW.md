# Duet App — End-to-End Product & Architecture Review

**Date:** March 5, 2026
**Reviewer perspective:** Product Management & Cross-Functional Architecture

---

## Executive Summary

Duet is a well-architected always-on voice companion app that solves a genuine problem — hands-free, persistent voice communication overlaid on music for couples exploring together. The core technical foundation (WebRTC data channels, native audio ducking, VAD, Firebase signaling) is solid and production-ready. The app has a complete user journey from auth through room creation, voice connection, friends, and monetization.

Below are prioritized enhancement recommendations across product, UX, engineering, growth, and monetization dimensions.

---

## 1. PRODUCT & USER EXPERIENCE

### 1.1 Onboarding Flow (High Priority)

**Current state:** Users land on AuthScreen with sign-in options, then go directly to the Lobby. There is no guided onboarding.

**Recommendation:** Add a 3-screen onboarding carousel for first-time users:
- **Screen 1:** "Talk hands-free while exploring" — explains the core value
- **Screen 2:** "Your music ducks automatically" — demonstrates the audio ducking feature
- **Screen 3:** "Invite your partner" — prompts microphone permission with context

**Why:** The app's differentiator (voice overlaid on music with ducking) is non-obvious. Users who don't understand the value proposition within the first 30 seconds will churn. Contextual permission prompting also increases mic permission grant rates by ~30% vs. cold prompts.

### 1.2 Empty Lobby State (Medium Priority)

**Current state:** The Lobby shows "Start a Room" and "Join Room" buttons with an ad slot. For returning users, there's no persistent context.

**Recommendation:**
- Show the user's **last connected partner** with a "Reconnect" shortcut
- Show **online friends** with one-tap invite (currently requires navigating to Friends screen)
- Add a "Quick connect" flow: tap a friend → room is created + invitation sent in one action (this exists in FriendsScreen but not surfaced in the Lobby)

**Why:** Reducing friction to the core action (connecting with your partner) directly impacts DAU and session frequency. Every extra tap is lost engagement.

### 1.3 Connection Quality Indicator (High Priority)

**Current state:** The Room shows a simple status dot (green/yellow/red) and text like "Connected" or "Reconnecting."

**Recommendation:**
- Add a real-time **latency indicator** (e.g., "45ms") derived from WebRTC stats
- Add a **connection quality bar** (1-5 bars like a cell signal)
- Show a **bandwidth/audio quality indicator** when data channel throughput drops
- Surface WebRTC `getStats()` data to help users understand if their issues are network-related

**Why:** Voice quality is the product. Users need transparency about connection health to trust the app. This also reduces support tickets ("is it broken?" → "my connection is weak").

### 1.4 Group Rooms (Medium-High Priority)

**Current state:** Rooms are strictly 1:1 (two members max). The signaling and WebRTC architecture is built for pairs.

**Recommendation:** Extend to support 3-4 person rooms for small groups (e.g., family trips, friend groups):
- Use a mesh topology for ≤4 participants (each peer connects to every other peer)
- Extend the signaling service to handle multiple offer/answer exchanges
- Add participant avatars in a circular layout
- Individual mute/deafen per participant

**Why:** The "couple exploring together" use case naturally extends to families and small friend groups. This is the single highest-impact feature for expanding TAM beyond couples.

### 1.5 Persistent / Auto-Connect Rooms (High Priority)

**Current state:** Every session requires creating a new room and sharing a 6-character code. The room is destroyed when the host leaves.

**Recommendation:**
- Allow users to create **persistent rooms** tied to a friend pair (or group)
- When both users open the app, auto-connect to their persistent room
- Add a "favorites" concept — your partner's room is always one tap away
- Store persistent room config in `/users/{uid}/persistentRoom`

**Why:** The 6-character code flow makes sense for ad-hoc connections but creates unnecessary friction for the primary use case (same two people connecting daily). Couples don't want to share a code every time they leave the house.

### 1.6 Audio Ducking on Android (Medium Priority)

**Current state:** The ducking toggle is iOS-only (`Platform.OS === 'ios'`). On Android, the native module requests `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, but there's no user-facing toggle.

**Recommendation:**
- Expose the ducking toggle on Android as well
- Add a "ducking intensity" slider (how much to lower other audio: 30%, 50%, 70%)
- Document which popular music apps respect Android audio focus ducking (Spotify, YouTube Music, etc.)

**Why:** Android is likely ≥50% of users. Parity of the core feature across platforms is essential.

---

## 2. ENGINEERING & ARCHITECTURE

### 2.1 Code Duplication Between Mobile and Web (High Priority)

**Current state:** The `/src` directory (React Native mobile) and `/website/src` directory (Next.js web) have nearly identical files:
- `hooks/useDuetStore.ts`, `hooks/useAuthStore.ts`, `hooks/useFriendsStore.ts`
- `services/SignalingService.ts`, `services/WebRTCService.ts`, `services/AuthService.ts`, etc.
- `components/app/RoomScreen.tsx`, `components/app/LobbyScreen.tsx`, etc.

**Recommendation:**
- Extract shared business logic (stores, services, types) into a `packages/shared` workspace package
- Keep platform-specific UI in their respective directories
- Use a monorepo tool (Turborepo or Nx) to manage the workspace

**Why:** Bug fixes and feature additions currently require parallel changes in two places. This doubles development effort and creates divergence risk.

### 2.2 Room Code Collision Risk (Medium Priority)

**Current state:** Room codes are 6 characters from a 30-character alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), giving ~729 million possible codes. Codes are generated client-side with `Math.random()` and there's no collision check.

**Recommendation:**
- Add a collision check: after generating a code, verify the room doesn't already exist before writing
- Or switch to Firebase `push()` keys with a short human-readable alias stored as a child
- For higher scale, use a server-side Cloud Function to generate and reserve codes atomically

**Why:** At scale, birthday paradox makes collisions likely faster than expected. With ~27K concurrent rooms, there's a ~50% chance of collision.

### 2.3 Audio Data Channel Efficiency (Medium Priority)

**Current state:** Audio is sent as JSON-stringified base64 over the WebRTC data channel:
```typescript
const packet: AudioPacket = { audio: base64Audio, sampleRate, channels };
this.dataChannel.send(JSON.stringify(packet));
```

**Recommendation:**
- Switch to binary data channel messages (ArrayBuffer) instead of base64-encoded JSON
- Base64 encoding adds ~33% overhead, plus JSON serialization overhead
- Use a simple binary header (4 bytes sample rate + 1 byte channels) followed by raw PCM data
- This reduces bandwidth by ~40% and CPU usage for encode/decode

**Why:** For a real-time voice app, every millisecond and byte matters. This is low-hanging fruit for latency and battery life improvement.

### 2.4 Missing Error Boundaries (Medium Priority)

**Current state:** No React error boundaries are implemented. If any component throws during render, the entire app crashes.

**Recommendation:**
- Add an error boundary wrapper around the root navigator
- Add a screen-level error boundary with a "Something went wrong, tap to retry" fallback
- Log caught errors to Crashlytics

**Why:** Audio and WebRTC operations can throw in edge cases (hardware failures, OS-level audio session conflicts). Graceful degradation is better than a full crash.

### 2.5 Testing Infrastructure (High Priority)

**Current state:** There are **zero tests** in the project. No unit tests, no integration tests, no E2E tests.

**Recommendation:**
- **Unit tests** for business logic: `useDuetStore`, `useAuthStore`, `SignalingService`, `WebRTCService` — use Jest + mock Firebase
- **Component tests** for critical screens: `AuthScreen`, `LobbyScreen`, `RoomScreen` — use React Native Testing Library
- **E2E tests** for the happy path: sign in → create room → join room → verify connection — use Detox or Maestro
- Set up CI with EAS Build to run tests on every PR

**Why:** A real-time voice app has complex state transitions (connecting → connected → reconnecting → failed). Without tests, regressions in these flows will ship silently.

### 2.6 Signaling Race Conditions (Low-Medium Priority)

**Current state:** The signaling service has a 120-second debounce for "partner left" events, and the partner-joined callback has logic to skip duplicate fires. This defensive coding suggests race conditions have been encountered.

**Recommendation:**
- Add a **sequence number** to signaling messages (offer, answer, ICE candidates) to detect stale messages
- Use Firebase transactions for member add/remove to prevent read-modify-write races
- Add an explicit "session ID" to each room connection so stale reconnects don't corrupt the current session

**Why:** The 120-second debounce is a pragmatic workaround, but it means if a partner truly leaves, the remaining user doesn't know for 2 minutes. A session-aware approach would reduce this to seconds.

---

## 3. GROWTH & RETENTION

### 3.1 Deep Link / App Clip for Frictionless Join (High Priority)

**Current state:** Deep links exist (`getduet.app/app/room/{code}`) and there's a web app, but the join experience from a shared link requires the app to be installed.

**Recommendation:**
- Implement **iOS App Clips** / **Android Instant Apps** so the partner can join a room without installing the full app
- The web app already has the room screen (`/app/room/[code]/page.tsx`) — make this a fully functional fallback
- Add a smart banner: "For the best experience, install the app" after the first session

**Why:** The biggest growth bottleneck for a 2-person app is the second person. If your partner needs to install an app before they can connect, you lose ~70% of potential conversions. Frictionless join is the single highest-leverage growth feature.

### 3.2 Referral Program (Medium Priority)

**Current state:** Users can share a friend code and room code. There's no incentive mechanism.

**Recommendation:**
- Add a referral reward: "Invite a friend, both get ad-free rooms for a week"
- Track referral chains: who invited whom
- Show referral stats on the profile screen

**Why:** Word-of-mouth is the natural acquisition channel for a social utility app. Incentivized referrals accelerate this.

### 3.3 Usage Analytics & Engagement Metrics (High Priority)

**Current state:** There is `EventTrackingService` and `AnalyticsService` that log basic events (`room_created`, `room_joined`, `session_start`), but there are no product metrics dashboards.

**Recommendation:** Instrument and track:
- **Session duration** (time in room per session)
- **Daily/weekly active rooms** (not just DAU — the product unit is a "duet")
- **Connection success rate** (% of room joins that reach "connected" state)
- **Audio quality metrics** (packet loss, latency, jitter from WebRTC stats)
- **Funnel: Auth → Lobby → Create Room → Partner Joined → 5min session**
- **Retention cohorts**: D1, D7, D30 by signup method

**Why:** You can't improve what you don't measure. For a pre-product-market-fit app, these metrics tell you whether the core experience works.

### 3.4 Push Notification Strategy (Medium Priority)

**Current state:** Push notifications exist for: partner left, friend request, room invitation. These are all reactive/transactional.

**Recommendation:** Add proactive engagement notifications:
- "Your partner is online — start a duet?" (when a friend comes online)
- "You haven't connected in 3 days — say hi to [partner name]" (re-engagement)
- Make all proactive notifications respect the push opt-in preference
- Add notification grouping and rate limiting (max 2 proactive pushes/day)

**Why:** For a daily-use app, proactive nudges drive habit formation. The friend online status is already tracked — leverage it.

---

## 4. MONETIZATION & BUSINESS MODEL

### 4.1 Ad Experience Polish (Medium Priority)

**Current state:**
- Pre-roll interstitial before entering a room
- Interstitial every 3rd room leave
- Native ads in the lobby and room
- Rewarded ads are loaded but not surfaced in any UI

**Recommendation:**
- **Remove pre-roll ads** — showing an ad before the core experience creates negative first impressions. Move to post-session only.
- **Surface rewarded ads** as "Watch an ad for 1 hour ad-free" — give users agency
- **Add a frequency cap** — no more than 1 interstitial per 30 minutes regardless of room count
- **A/B test** ad-free first session for new users

**Why:** Pre-roll ads before entering a voice room are a UX anti-pattern (like a phone call with an ad before it connects). The current model risks churning new users before they experience the product.

### 4.2 Subscription Tier (High Priority)

**Current state:** The app is ad-supported with guest access. No paid tier exists.

**Recommendation:** Introduce "Duet Pro" subscription:
- **Ad-free experience**
- **Persistent rooms** (always-on room with your partner)
- **Higher audio quality** (higher bitrate/sample rate option)
- **Group rooms** (3-4 people)
- **Custom reactions** and room themes
- Price point: $2.99/month or $24.99/year

**Why:** For a utility app used daily by couples, subscription conversion rates of 5-10% are realistic. This also reduces dependence on ad revenue and improves UX for your most engaged users.

### 4.3 Guest User Limitations (Medium Priority)

**Current state:** Guests have a `GuestRoomTimer` that limits room time, and controls get locked. But the limitation details aren't clearly communicated.

**Recommendation:**
- Show a clear "Guest: 10 min per room" badge in the room
- At 7 minutes, show a gentle upgrade prompt (not a hard wall)
- At 10 minutes, show "Create a free account to continue" — not sign out, but an inline upgrade flow
- Track guest → authenticated conversion rate

**Why:** The guest experience is a trial. It should feel generous enough to demonstrate value but have clear upgrade paths.

---

## 5. SECURITY & RELIABILITY

### 5.1 Firebase Security Rules Gaps (High Priority)

**Current state:** The rules are well-structured overall, but:
- Rooms have `".read": true` — anyone (even unauthenticated) can read room data including SDP offers/answers
- The `.write` rule for rooms is `"!data.exists() || auth != null"` — unauthenticated users can create rooms
- Invitation writes are `"auth != null"` — any authenticated user can write to any invitation

**Recommendation:**
- Change room reads to `"auth != null"` — require authentication to see room data
- Remove the `!data.exists()` clause from room writes — always require auth
- Add rate limiting via Firebase App Check or a Cloud Function proxy
- Add validation that `invitation.fromUid == auth.uid` to prevent spoofing

**Why:** SDP data contains ICE candidates with IP addresses. Unauthenticated access to this data is a privacy risk. Invitation spoofing could be used for harassment.

### 5.2 Rate Limiting (Medium Priority)

**Current state:** No rate limiting on room creation, friend requests, or invitation sending.

**Recommendation:**
- Add server-side rate limiting via Cloud Functions:
  - Max 10 rooms per user per hour
  - Max 20 friend requests per user per day
  - Max 50 invitations per user per day
- Use Firebase App Check to verify requests come from genuine app instances

**Why:** Without rate limiting, a single bad actor can spam invitations or flood the database with rooms.

### 5.3 TURN Server Reliability (High Priority)

**Current state:** TURN configuration is loaded from `src/config/turn.ts` which is not in the repo listing (likely contains credentials or placeholder config). The README mentions TURN as a "next step."

**Recommendation:**
- Deploy redundant TURN servers in multiple regions (or use a managed service like Twilio, Cloudflare Calls)
- Implement TURN credential rotation (time-limited HMAC credentials via a Cloud Function)
- Add fallback: if TURN fails, show user a clear message rather than a silent failure
- Monitor TURN usage and relay bandwidth

**Why:** ~15-20% of users are behind symmetric NATs or corporate firewalls where STUN alone won't work. Without reliable TURN, these users can never connect.

---

## 6. PLATFORM PARITY & WEB APP

### 6.1 Web App Feature Completeness (Medium Priority)

**Current state:** The web app (`/website`) mirrors the mobile app with a Next.js frontend. It has all major screens (Auth, Lobby, Room, Friends, Profile) plus an admin panel for marketing campaigns.

**Recommendation:**
- Ensure the web app has **feature parity** with mobile for core flows
- Add **PWA support** with service worker for background audio (the manifest exists but needs offline/background capabilities)
- The web app is the ideal vehicle for the "frictionless join" experience (Recommendation 3.1)

**Why:** Web is the lowest-friction entry point. A partner who receives a room link should be able to join from any browser without installation.

### 6.2 Admin Panel Enhancements (Low Priority)

**Current state:** The admin panel at `/admin` supports campaigns, segments, journeys, messages, subscribers, reporting, and asset management.

**Recommendation:**
- Add **real-time connection monitoring** (active rooms, connected users)
- Add **audio quality dashboards** (aggregate WebRTC stats)
- Add **user lookup** for support (search by email, view room history)

**Why:** As the app scales, operational tooling becomes critical for support and incident response.

---

## Priority Matrix

| # | Enhancement | Impact | Effort | Priority |
|---|------------|--------|--------|----------|
| 3.1 | Frictionless join (web fallback / App Clips) | Very High | High | P0 |
| 1.5 | Persistent / auto-connect rooms | Very High | Medium | P0 |
| 5.1 | Firebase security rules hardening | High | Low | P0 |
| 2.5 | Testing infrastructure | High | Medium | P0 |
| 1.1 | Onboarding flow | High | Low | P1 |
| 1.3 | Connection quality indicator | High | Medium | P1 |
| 5.3 | TURN server reliability | High | Medium | P1 |
| 4.1 | Ad experience polish (remove pre-roll) | High | Low | P1 |
| 4.2 | Subscription tier | High | Medium | P1 |
| 3.3 | Usage analytics & engagement metrics | High | Medium | P1 |
| 2.1 | Shared package for mobile/web code | Medium | High | P2 |
| 2.3 | Binary audio data channel | Medium | Medium | P2 |
| 1.2 | Lobby "quick connect" with online friends | Medium | Low | P2 |
| 1.4 | Group rooms (3-4 people) | High | Very High | P2 |
| 3.4 | Proactive push notification strategy | Medium | Low | P2 |
| 1.6 | Android ducking parity | Medium | Low | P2 |
| 3.2 | Referral program | Medium | Medium | P3 |
| 2.2 | Room code collision prevention | Low | Low | P3 |
| 2.4 | Error boundaries | Medium | Low | P3 |
| 2.6 | Signaling race condition fixes | Low | Medium | P3 |
| 5.2 | Rate limiting | Medium | Medium | P3 |
| 4.3 | Guest limitation clarity | Low | Low | P3 |
| 6.1 | Web app PWA support | Medium | High | P3 |
| 6.2 | Admin panel enhancements | Low | Medium | P4 |

---

## Closing Thoughts

Duet has strong technical fundamentals and a clear product vision. The most impactful next steps are:

1. **Remove friction from the partner join experience** — this is the growth bottleneck
2. **Add persistent rooms** — this transforms the app from "session-based tool" to "always-on connection"
3. **Harden security and add tests** — protect what you've built before scaling
4. **Rethink monetization** — move from ad-heavy to subscription-centric to align incentives with user experience

The app is well-positioned for the "daily utility for couples" market. The recommendations above focus on deepening engagement with existing users and removing barriers for new ones.
