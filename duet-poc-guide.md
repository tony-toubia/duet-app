# Duet — Proof of Concept Guide

## Goal
Validate that we can:
1. Capture mic audio while music plays
2. Duck system audio when we play voice
3. Stream audio between two devices via WebRTC

---

## Option A: React Native + Native Modules (Recommended)

### Project Setup

```bash
# Create new Expo project with dev client (needed for native modules)
npx create-expo-app duet-poc --template expo-template-blank-typescript
cd duet-poc

# Install dependencies
npx expo install expo-av expo-dev-client
npm install react-native-webrtc
npm install zustand
```

### Key Native Module: Audio Mixer (iOS)

Create `ios/DuetAudio/DuetAudioManager.swift`:

```swift
import AVFoundation
import Foundation

@objc(DuetAudioManager)
class DuetAudioManager: NSObject {
    
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var inputNode: AVAudioInputNode?
    
    @objc
    func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        
        do {
            // This is the magic: playAndRecord + duckOthers
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.duckOthers, .allowBluetooth, .defaultToSpeaker]
            )
            try session.setActive(true)
            print("Audio session configured for ducking")
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }
    
    @objc
    func startListening(callback: @escaping (Data) -> Void) {
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else { return }
        
        inputNode = audioEngine.inputNode
        let format = inputNode!.outputFormat(forBus: 0)
        
        // Tap the microphone
        inputNode!.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, time in
            // Convert buffer to data for WebRTC
            let data = self.bufferToData(buffer: buffer)
            callback(data)
        }
        
        do {
            try audioEngine.start()
        } catch {
            print("Failed to start audio engine: \(error)")
        }
    }
    
    @objc
    func playPartnerAudio(data: Data) {
        // This will automatically duck other audio (Spotify, etc.)
        // because of our audio session configuration
        
        guard let audioEngine = audioEngine else { return }
        
        if playerNode == nil {
            playerNode = AVAudioPlayerNode()
            audioEngine.attach(playerNode!)
            audioEngine.connect(playerNode!, to: audioEngine.mainMixerNode, format: nil)
        }
        
        // Convert data back to buffer and play
        if let buffer = dataToBuffer(data: data) {
            playerNode?.scheduleBuffer(buffer, completionHandler: nil)
            playerNode?.play()
        }
    }
    
    private func bufferToData(buffer: AVAudioPCMBuffer) -> Data {
        let audioBuffer = buffer.audioBufferList.pointee.mBuffers
        return Data(bytes: audioBuffer.mData!, count: Int(audioBuffer.mDataByteSize))
    }
    
    private func dataToBuffer(data: Data) -> AVAudioPCMBuffer? {
        // Implementation depends on your audio format
        // Simplified for POC
        return nil
    }
}
```

### Key Native Module: Audio Mixer (Android)

Create `android/app/src/main/java/com/duet/DuetAudioManager.kt`:

```kotlin
package com.duet

import android.media.*
import android.content.Context
import android.os.Build

class DuetAudioManager(private val context: Context) {
    
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var isRecording = false
    
    private val sampleRate = 44100
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    
    fun setupAudioSession() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        
        // Request audio focus with ducking
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .build()
            
            audioManager.requestAudioFocus(focusRequest)
        }
    }
    
    fun startListening(callback: (ByteArray) -> Unit) {
        val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate,
            channelConfig,
            audioFormat,
            bufferSize
        )
        
        isRecording = true
        audioRecord?.startRecording()
        
        Thread {
            val buffer = ByteArray(bufferSize)
            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, bufferSize) ?: 0
                if (read > 0) {
                    callback(buffer.copyOf(read))
                }
            }
        }.start()
    }
    
    fun playPartnerAudio(data: ByteArray) {
        if (audioTrack == null) {
            val bufferSize = AudioTrack.getMinBufferSize(sampleRate, 
                AudioFormat.CHANNEL_OUT_MONO, audioFormat)
            
            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(audioFormat)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .build()
            
            audioTrack?.play()
        }
        
        audioTrack?.write(data, 0, data.size)
    }
    
    fun stop() {
        isRecording = false
        audioRecord?.stop()
        audioRecord?.release()
        audioTrack?.stop()
        audioTrack?.release()
    }
}
```

---

## Option B: Pure Native POC (Faster Validation)

If you want to validate even faster, build two separate native apps:

### iOS (SwiftUI) — Minimal POC

```swift
// ContentView.swift
import SwiftUI
import AVFoundation
import MultipeerConnectivity

struct ContentView: View {
    @StateObject private var audioManager = AudioManager()
    @State private var isMuted = false
    
    var body: some View {
        VStack(spacing: 40) {
            Text("Duet POC")
                .font(.largeTitle)
            
            Circle()
                .fill(audioManager.isConnected ? Color.green : Color.red)
                .frame(width: 100, height: 100)
            
            Text(audioManager.isConnected ? "Connected" : "Searching...")
            
            Button(action: { isMuted.toggle() }) {
                Image(systemName: isMuted ? "mic.slash.fill" : "mic.fill")
                    .font(.system(size: 50))
            }
            
            Text("Play music in Spotify to test ducking")
                .font(.caption)
                .foregroundColor(.gray)
        }
        .onAppear {
            audioManager.start()
        }
    }
}

class AudioManager: NSObject, ObservableObject {
    @Published var isConnected = false
    
    private var audioEngine = AVAudioEngine()
    private var playerNode = AVAudioPlayerNode()
    
    // MultipeerConnectivity for local P2P
    private var peerID: MCPeerID!
    private var session: MCSession!
    private var advertiser: MCNearbyServiceAdvertiser!
    private var browser: MCNearbyServiceBrowser!
    
    func start() {
        setupAudioSession()
        setupMultipeer()
        startAudioEngine()
    }
    
    private func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .voiceChat, 
                                  options: [.duckOthers, .allowBluetooth])
        try? session.setActive(true)
    }
    
    private func setupMultipeer() {
        peerID = MCPeerID(displayName: UIDevice.current.name)
        session = MCSession(peer: peerID)
        session.delegate = self
        
        // Both advertise and browse
        advertiser = MCNearbyServiceAdvertiser(peer: peerID, 
                                                discoveryInfo: nil, 
                                                serviceType: "duet-audio")
        advertiser.delegate = self
        advertiser.startAdvertisingPeer()
        
        browser = MCNearbyServiceBrowser(peer: peerID, serviceType: "duet-audio")
        browser.delegate = self
        browser.startBrowsingForPeers()
    }
    
    private func startAudioEngine() {
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        
        // Capture mic and send to peer
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self = self, !self.session.connectedPeers.isEmpty else { return }
            
            if let data = self.bufferToData(buffer) {
                try? self.session.send(data, toPeers: self.session.connectedPeers, with: .unreliable)
            }
        }
        
        // Setup player for incoming audio
        audioEngine.attach(playerNode)
        audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: format)
        
        try? audioEngine.start()
        playerNode.play()
    }
    
    private func bufferToData(_ buffer: AVAudioPCMBuffer) -> Data? {
        guard let channelData = buffer.floatChannelData else { return nil }
        let frameLength = Int(buffer.frameLength)
        return Data(bytes: channelData[0], count: frameLength * MemoryLayout<Float>.size)
    }
    
    private func dataToBuffer(_ data: Data, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let frameCount = UInt32(data.count / MemoryLayout<Float>.size)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount
        
        data.withUnsafeBytes { ptr in
            if let channelData = buffer.floatChannelData {
                memcpy(channelData[0], ptr.baseAddress, data.count)
            }
        }
        return buffer
    }
}

// MARK: - MCSessionDelegate
extension AudioManager: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            self.isConnected = state == .connected
        }
    }
    
    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        let format = audioEngine.inputNode.outputFormat(forBus: 0)
        if let buffer = dataToBuffer(data, format: format) {
            playerNode.scheduleBuffer(buffer)
        }
    }
    
    func session(_ session: MCSession, didReceive stream: InputStream, 
                 withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, 
                 fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, 
                 fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

// MARK: - Advertiser & Browser Delegates
extension AudioManager: MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, 
                    didReceiveInvitationFromPeer peerID: MCPeerID, 
                    withContext context: Data?, 
                    invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(true, session)
    }
    
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, 
                 withDiscoveryInfo info: [String: String]?) {
        browser.invitePeer(peerID, to: session, withContext: nil, timeout: 10)
    }
    
    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}
    
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {}
    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {}
}
```

---

## Testing Checklist

### Test 1: Audio Session (Critical)
- [ ] Start Spotify playing music
- [ ] Launch Duet POC
- [ ] Verify music continues playing
- [ ] Verify music ducks when voice is received

### Test 2: Mic Capture
- [ ] Speak into Device A
- [ ] Verify audio data is being captured (log buffer sizes)
- [ ] Verify no feedback loop

### Test 3: P2P Connection
- [ ] Two devices discover each other
- [ ] Connection established
- [ ] Audio flows both directions

### Test 4: Real-World
- [ ] Walk around apartment with both devices
- [ ] Verify connection stability
- [ ] Measure latency (subjective: is it annoying?)
- [ ] Test with headphones on both devices

---

## Key Metrics to Measure

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Voice latency | < 200ms | Timestamp in packets |
| Duck response time | < 100ms | Log timestamps |
| Battery drain | < 10%/hour | iOS Battery settings |
| Connection drops | < 1/hour | Counter in app |

---

## Next Steps After POC

If POC validates the concept:

1. **Add WebRTC** — For when users are apart
2. **Add VAD** — Only transmit when speaking
3. **Add UI** — Basic mute controls
4. **Test with strangers** — Is setup intuitive?

If POC reveals issues:

1. **Latency too high?** — Try different audio formats, buffer sizes
2. **Ducking not working?** — Research per-platform workarounds
3. **Connection unstable?** — Add WebRTC as primary, Bluetooth as enhancement
