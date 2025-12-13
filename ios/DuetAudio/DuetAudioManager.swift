import AVFoundation
import Foundation
import React

@objc(DuetAudioManager)
class DuetAudioManager: RCTEventEmitter {
  
  private var audioEngine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  private var mixerNode: AVAudioMixerNode?
  
  private var isSessionActive = false
  private var isMuted = false
  private var isDeafened = false
  
  // Audio format for streaming (matches WebRTC Opus decoded output)
  private let sampleRate: Double = 48000
  private let channels: AVAudioChannelCount = 1
  
  // VAD (Voice Activity Detection) settings
  private var vadThreshold: Float = 0.01
  private var isSpeaking = false
  private var silenceFrames = 0
  private let silenceThreshold = 10 // frames of silence before stopping
  
  // MARK: - RCTEventEmitter
  
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  override func supportedEvents() -> [String]! {
    return ["onAudioData", "onVoiceActivity", "onConnectionStateChange", "onError"]
  }
  
  // MARK: - Audio Session Setup
  
  @objc
  func setupAudioSession(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    do {
      let session = AVAudioSession.sharedInstance()
      
      // This is the magic combination for ducking other apps
      try session.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [
          .duckOthers,           // Duck other audio (Spotify, etc.)
          .allowBluetooth,       // Support Bluetooth headsets
          .allowBluetoothA2DP,   // Support high-quality Bluetooth audio
          .defaultToSpeaker      // Use speaker when no headphones
        ]
      )
      
      // Optimize for voice
      try session.setPreferredSampleRate(sampleRate)
      try session.setPreferredIOBufferDuration(0.02) // 20ms buffer for low latency
      
      // Activate the session
      try session.setActive(true)
      
      isSessionActive = true
      
      // Listen for interruptions (phone calls, etc.)
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleInterruption),
        name: AVAudioSession.interruptionNotification,
        object: nil
      )
      
      // Listen for route changes (headphones plugged/unplugged)
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleRouteChange),
        name: AVAudioSession.routeChangeNotification,
        object: nil
      )
      
      resolve(["success": true, "sampleRate": sampleRate])
    } catch {
      reject("AUDIO_SESSION_ERROR", "Failed to setup audio session: \(error.localizedDescription)", error)
    }
  }
  
  // MARK: - Audio Engine
  
  @objc
  func startAudioEngine(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard isSessionActive else {
      reject("NOT_INITIALIZED", "Audio session not initialized. Call setupAudioSession first.", nil)
      return
    }
    
    do {
      audioEngine = AVAudioEngine()
      playerNode = AVAudioPlayerNode()
      mixerNode = AVAudioMixerNode()
      
      guard let engine = audioEngine,
            let player = playerNode,
            let mixer = mixerNode else {
        reject("ENGINE_ERROR", "Failed to create audio engine components", nil)
        return
      }
      
      // Attach nodes
      engine.attach(player)
      engine.attach(mixer)
      
      // Get the format for our audio
      let format = AVAudioFormat(
        standardFormatWithSampleRate: sampleRate,
        channels: channels
      )!
      
      // Connect: player -> mixer -> main output
      engine.connect(player, to: mixer, format: format)
      engine.connect(mixer, to: engine.mainMixerNode, format: format)
      
      // Install tap on input (microphone) to capture audio
      let inputNode = engine.inputNode
      let inputFormat = inputNode.outputFormat(forBus: 0)
      
      inputNode.installTap(onBus: 0, bufferSize: 960, format: inputFormat) { [weak self] buffer, time in
        self?.processInputBuffer(buffer)
      }
      
      // Start the engine
      try engine.start()
      player.play()
      
      resolve(["success": true])
    } catch {
      reject("ENGINE_START_ERROR", "Failed to start audio engine: \(error.localizedDescription)", error)
    }
  }
  
  @objc
  func stopAudioEngine(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
    audioEngine?.inputNode.removeTap(onBus: 0)
    playerNode?.stop()
    audioEngine?.stop()
    
    audioEngine = nil
    playerNode = nil
    mixerNode = nil
    
    resolve(["success": true])
  }
  
  // MARK: - Audio Processing
  
  private func processInputBuffer(_ buffer: AVAudioPCMBuffer) {
    guard !isMuted else { return }
    
    // Calculate RMS for VAD
    let rms = calculateRMS(buffer)
    let speaking = rms > vadThreshold
    
    if speaking {
      silenceFrames = 0
      if !isSpeaking {
        isSpeaking = true
        sendEvent(withName: "onVoiceActivity", body: ["speaking": true])
      }
    } else {
      silenceFrames += 1
      if isSpeaking && silenceFrames > silenceThreshold {
        isSpeaking = false
        sendEvent(withName: "onVoiceActivity", body: ["speaking": false])
      }
    }
    
    // Only send audio data when speaking (saves bandwidth)
    if isSpeaking {
      if let data = bufferToBase64(buffer) {
        sendEvent(withName: "onAudioData", body: [
          "audio": data,
          "sampleRate": buffer.format.sampleRate,
          "channels": buffer.format.channelCount
        ])
      }
    }
  }
  
  private func calculateRMS(_ buffer: AVAudioPCMBuffer) -> Float {
    guard let channelData = buffer.floatChannelData else { return 0 }
    
    let channelDataPointer = channelData[0]
    let frameLength = Int(buffer.frameLength)
    
    var sum: Float = 0
    for i in 0..<frameLength {
      let sample = channelDataPointer[i]
      sum += sample * sample
    }
    
    return sqrt(sum / Float(frameLength))
  }
  
  // MARK: - Playback (Partner Audio)
  
  @objc
  func playAudio(_ base64Audio: String,
                 sampleRate: Double,
                 channels: Int,
                 resolve: @escaping RCTPromiseResolveBlock,
                 reject: @escaping RCTPromiseRejectBlock) {
    guard !isDeafened else {
      resolve(["played": false, "reason": "deafened"])
      return
    }
    
    guard let player = playerNode,
          let data = Data(base64Encoded: base64Audio) else {
      reject("PLAYBACK_ERROR", "Invalid audio data or player not initialized", nil)
      return
    }
    
    let format = AVAudioFormat(
      standardFormatWithSampleRate: sampleRate,
      channels: AVAudioChannelCount(channels)
    )!
    
    if let buffer = dataToBuffer(data, format: format) {
      player.scheduleBuffer(buffer, completionHandler: nil)
      resolve(["played": true])
    } else {
      reject("BUFFER_ERROR", "Failed to create audio buffer", nil)
    }
  }
  
  // MARK: - Controls
  
  @objc
  func setMuted(_ muted: Bool) {
    isMuted = muted
    if muted && isSpeaking {
      isSpeaking = false
      sendEvent(withName: "onVoiceActivity", body: ["speaking": false])
    }
  }
  
  @objc
  func setDeafened(_ deafened: Bool) {
    isDeafened = deafened
  }
  
  @objc
  func setVadThreshold(_ threshold: Float) {
    vadThreshold = max(0.001, min(0.1, threshold))
  }
  
  // MARK: - Utility Functions
  
  private func bufferToBase64(_ buffer: AVAudioPCMBuffer) -> String? {
    guard let channelData = buffer.floatChannelData else { return nil }
    
    let frameLength = Int(buffer.frameLength)
    let data = Data(
      bytes: channelData[0],
      count: frameLength * MemoryLayout<Float>.size
    )
    
    return data.base64EncodedString()
  }
  
  private func dataToBuffer(_ data: Data, format: AVAudioFormat) -> AVAudioPCMBuffer? {
    let frameCount = UInt32(data.count / MemoryLayout<Float>.size)
    
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
      return nil
    }
    
    buffer.frameLength = frameCount
    
    data.withUnsafeBytes { ptr in
      if let channelData = buffer.floatChannelData,
         let baseAddress = ptr.baseAddress {
        memcpy(channelData[0], baseAddress, data.count)
      }
    }
    
    return buffer
  }
  
  // MARK: - Notification Handlers
  
  @objc private func handleInterruption(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
      return
    }
    
    switch type {
    case .began:
      // Audio was interrupted (e.g., phone call)
      sendEvent(withName: "onConnectionStateChange", body: ["state": "interrupted"])
    case .ended:
      // Interruption ended, try to resume
      if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
        let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
        if options.contains(.shouldResume) {
          try? audioEngine?.start()
          playerNode?.play()
          sendEvent(withName: "onConnectionStateChange", body: ["state": "resumed"])
        }
      }
    @unknown default:
      break
    }
  }
  
  @objc private func handleRouteChange(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }
    
    switch reason {
    case .newDeviceAvailable:
      // New audio device connected (e.g., AirPods)
      sendEvent(withName: "onConnectionStateChange", body: ["state": "routeChanged", "reason": "deviceConnected"])
    case .oldDeviceUnavailable:
      // Audio device disconnected
      sendEvent(withName: "onConnectionStateChange", body: ["state": "routeChanged", "reason": "deviceDisconnected"])
    default:
      break
    }
  }
  
  deinit {
    NotificationCenter.default.removeObserver(self)
  }
}
