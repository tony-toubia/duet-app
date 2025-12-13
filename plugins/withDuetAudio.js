const { withMainApplication, withDangerousMod, withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// =====================
// ANDROID NATIVE CODE
// =====================

// Android native module code - Note: Using ${'$'} to escape $ in template literals for Kotlin
const DUET_AUDIO_MANAGER_KT = `package com.duet.audio

import android.content.Context
import android.media.*
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread
import kotlin.math.sqrt

class DuetAudioManager(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var audioManager: AudioManager? = null

    private var isRecording = false
    private var isMuted = false
    private var isDeafened = false

    private val sampleRate = 48000
    private val channelConfigIn = AudioFormat.CHANNEL_IN_MONO
    private val channelConfigOut = AudioFormat.CHANNEL_OUT_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_FLOAT

    private var vadThreshold = 0.01f
    private var isSpeaking = false
    private var silenceFrames = 0
    private val silenceThreshold = 10

    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var focusRequest: AudioFocusRequest? = null

    override fun getName() = "DuetAudioManager"

    @ReactMethod
    fun setupAudioSession(promise: Promise) {
        try {
            audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener { focusChange ->
                        handleAudioFocusChange(focusChange)
                    }
                    .build()

                val result = audioManager?.requestAudioFocus(focusRequest!!)

                if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    promise.reject("AUDIO_FOCUS_ERROR", "Failed to gain audio focus")
                    return
                }
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(
                    { focusChange -> handleAudioFocusChange(focusChange) },
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }

            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("sampleRate", sampleRate)
            })
        } catch (e: Exception) {
            promise.reject("AUDIO_SESSION_ERROR", "Failed to setup audio session: ${'$'}{e.message}")
        }
    }

    @ReactMethod
    fun startAudioEngine(promise: Promise) {
        try {
            setupAudioRecord()
            setupAudioTrack()
            startRecording()

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
            })
        } catch (e: Exception) {
            promise.reject("ENGINE_START_ERROR", "Failed to start audio engine: ${'$'}{e.message}")
        }
    }

    private fun setupAudioRecord() {
        val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfigIn, audioFormat)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate,
            channelConfigIn,
            audioFormat,
            bufferSize * 2
        )

        if (AcousticEchoCanceler.isAvailable()) {
            echoCanceler = AcousticEchoCanceler.create(audioRecord!!.audioSessionId)
            echoCanceler?.enabled = true
        }

        if (NoiseSuppressor.isAvailable()) {
            noiseSuppressor = NoiseSuppressor.create(audioRecord!!.audioSessionId)
            noiseSuppressor?.enabled = true
        }
    }

    private fun setupAudioTrack() {
        val bufferSize = AudioTrack.getMinBufferSize(sampleRate, channelConfigOut, audioFormat)

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
                    .setChannelMask(channelConfigOut)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack?.play()
    }

    private fun startRecording() {
        isRecording = true
        audioRecord?.startRecording()

        thread {
            val bufferSize = 960
            val buffer = FloatArray(bufferSize)

            while (isRecording) {
                val read = audioRecord?.read(buffer, 0, bufferSize, AudioRecord.READ_BLOCKING) ?: 0

                if (read > 0 && !isMuted) {
                    processInputBuffer(buffer, read)
                }
            }
        }
    }

    @ReactMethod
    fun stopAudioEngine(promise: Promise) {
        isRecording = false

        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null

        echoCanceler?.release()
        echoCanceler = null

        noiseSuppressor?.release()
        noiseSuppressor = null

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
        }

        audioManager?.mode = AudioManager.MODE_NORMAL

        promise.resolve(Arguments.createMap().apply {
            putBoolean("success", true)
        })
    }

    private fun processInputBuffer(buffer: FloatArray, length: Int) {
        val rms = calculateRMS(buffer, length)
        val speaking = rms > vadThreshold

        if (speaking) {
            silenceFrames = 0
            if (!isSpeaking) {
                isSpeaking = true
                sendEvent("onVoiceActivity", Arguments.createMap().apply {
                    putBoolean("speaking", true)
                })
            }
        } else {
            silenceFrames++
            if (isSpeaking && silenceFrames > silenceThreshold) {
                isSpeaking = false
                sendEvent("onVoiceActivity", Arguments.createMap().apply {
                    putBoolean("speaking", false)
                })
            }
        }

        if (isSpeaking) {
            val base64 = floatArrayToBase64(buffer, length)
            sendEvent("onAudioData", Arguments.createMap().apply {
                putString("audio", base64)
                putInt("sampleRate", sampleRate)
                putInt("channels", 1)
            })
        }
    }

    private fun calculateRMS(buffer: FloatArray, length: Int): Float {
        var sum = 0f
        for (i in 0 until length) {
            sum += buffer[i] * buffer[i]
        }
        return sqrt(sum / length)
    }

    @ReactMethod
    fun playAudio(base64Audio: String, sampleRate: Double, channels: Int, promise: Promise) {
        if (isDeafened) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("played", false)
                putString("reason", "deafened")
            })
            return
        }

        try {
            val floatArray = base64ToFloatArray(base64Audio)
            audioTrack?.write(floatArray, 0, floatArray.size, AudioTrack.WRITE_NON_BLOCKING)

            promise.resolve(Arguments.createMap().apply {
                putBoolean("played", true)
            })
        } catch (e: Exception) {
            promise.reject("PLAYBACK_ERROR", "Failed to play audio: ${'$'}{e.message}")
        }
    }

    @ReactMethod
    fun setMuted(muted: Boolean) {
        isMuted = muted
        if (muted && isSpeaking) {
            isSpeaking = false
            sendEvent("onVoiceActivity", Arguments.createMap().apply {
                putBoolean("speaking", false)
            })
        }
    }

    @ReactMethod
    fun setDeafened(deafened: Boolean) {
        isDeafened = deafened
    }

    @ReactMethod
    fun setVadThreshold(threshold: Float) {
        vadThreshold = threshold.coerceIn(0.001f, 0.1f)
    }

    private fun floatArrayToBase64(buffer: FloatArray, length: Int): String {
        val byteBuffer = ByteBuffer.allocate(length * 4)
        byteBuffer.order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until length) {
            byteBuffer.putFloat(buffer[i])
        }
        return Base64.encodeToString(byteBuffer.array(), Base64.NO_WRAP)
    }

    private fun base64ToFloatArray(base64: String): FloatArray {
        val bytes = Base64.decode(base64, Base64.NO_WRAP)
        val byteBuffer = ByteBuffer.wrap(bytes)
        byteBuffer.order(ByteOrder.LITTLE_ENDIAN)

        val floatArray = FloatArray(bytes.size / 4)
        for (i in floatArray.indices) {
            floatArray[i] = byteBuffer.float
        }
        return floatArray
    }

    private fun handleAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                sendEvent("onConnectionStateChange", Arguments.createMap().apply {
                    putString("state", "focusLost")
                })
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                sendEvent("onConnectionStateChange", Arguments.createMap().apply {
                    putString("state", "interrupted")
                })
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                sendEvent("onConnectionStateChange", Arguments.createMap().apply {
                    putString("state", "resumed")
                })
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const DUET_AUDIO_PACKAGE_KT = `package com.duet.audio

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DuetAudioPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(DuetAudioManager(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// =====================
// iOS NATIVE CODE
// =====================

const DUET_AUDIO_MANAGER_SWIFT = `import AVFoundation
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
      reject("AUDIO_SESSION_ERROR", "Failed to setup audio session: \\(error.localizedDescription)", error)
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
      reject("ENGINE_START_ERROR", "Failed to start audio engine: \\(error.localizedDescription)", error)
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
`;

const DUET_AUDIO_MANAGER_M = `#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(DuetAudioManager, RCTEventEmitter)

RCT_EXTERN_METHOD(setupAudioSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startAudioEngine:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopAudioEngine:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(playAudio:(NSString *)base64Audio
                  sampleRate:(double)sampleRate
                  channels:(int)channels
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setMuted:(BOOL)muted)
RCT_EXTERN_METHOD(setDeafened:(BOOL)deafened)
RCT_EXTERN_METHOD(setVadThreshold:(float)threshold)

@end
`;

// =====================
// ANDROID CONFIG PLUGIN
// =====================

function withDuetAudioAndroid(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const audioDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'duet',
        'audio'
      );

      // Create directory if it doesn't exist
      fs.mkdirSync(audioDir, { recursive: true });

      // Write the Kotlin files
      fs.writeFileSync(
        path.join(audioDir, 'DuetAudioManager.kt'),
        DUET_AUDIO_MANAGER_KT
      );
      fs.writeFileSync(
        path.join(audioDir, 'DuetAudioPackage.kt'),
        DUET_AUDIO_PACKAGE_KT
      );

      console.log('[withDuetAudio] Created Android native audio module files in:', audioDir);

      return config;
    },
  ]);
}

function withDuetAudioMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Add import if not present
    if (!contents.includes('import com.duet.audio.DuetAudioPackage')) {
      // Find the package imports section and add our import
      const importRegex = /(import com\.facebook\.react\.ReactApplication)/;
      if (importRegex.test(contents)) {
        contents = contents.replace(
          importRegex,
          `$1\nimport com.duet.audio.DuetAudioPackage`
        );
      }
    }

    // Add package to getPackages - look for the packages.apply block
    if (!contents.includes('DuetAudioPackage()')) {
      // Try to find and modify the packages list
      const packagesRegex = /(packages\.apply\s*\{)/;
      if (packagesRegex.test(contents)) {
        contents = contents.replace(
          packagesRegex,
          `$1\n                add(DuetAudioPackage())`
        );
      } else {
        // Alternative: look for PackageList pattern
        const packageListRegex = /(PackageList\(this\)\.packages)/;
        if (packageListRegex.test(contents)) {
          contents = contents.replace(
            packageListRegex,
            `$1.apply { add(DuetAudioPackage()) }`
          );
        }
      }
    }

    config.modResults.contents = contents;
    console.log('[withDuetAudio] Modified MainApplication to include DuetAudioPackage');

    return config;
  });
}

// =====================
// iOS CONFIG PLUGIN
// =====================

function withDuetAudioIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      const audioDir = path.join(iosDir, 'DuetAudio');

      // Create DuetAudio directory
      fs.mkdirSync(audioDir, { recursive: true });

      // Write Swift file
      fs.writeFileSync(
        path.join(audioDir, 'DuetAudioManager.swift'),
        DUET_AUDIO_MANAGER_SWIFT
      );

      // Write Objective-C bridging file
      fs.writeFileSync(
        path.join(audioDir, 'DuetAudioManager.m'),
        DUET_AUDIO_MANAGER_M
      );

      console.log('[withDuetAudio] Created iOS native audio module files in:', audioDir);

      return config;
    },
  ]);
}

function withDuetAudioXcodeProject(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    // Get the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;

    // Find or create DuetAudio group
    let duetAudioGroup = null;
    const groups = xcodeProject.hash.project.objects['PBXGroup'];

    for (const key in groups) {
      if (groups[key].name === 'DuetAudio' || groups[key].path === 'DuetAudio') {
        duetAudioGroup = key;
        break;
      }
    }

    if (!duetAudioGroup) {
      // Create new group for DuetAudio
      duetAudioGroup = xcodeProject.addPbxGroup(
        ['DuetAudioManager.swift', 'DuetAudioManager.m'],
        'DuetAudio',
        'DuetAudio'
      );

      // Add to main group
      xcodeProject.addToPbxGroup(duetAudioGroup.uuid, mainGroup);
    }

    // Add source files to build phases
    const swiftFile = 'DuetAudio/DuetAudioManager.swift';
    const objcFile = 'DuetAudio/DuetAudioManager.m';

    // Check if files are already added
    const buildFiles = xcodeProject.hash.project.objects['PBXBuildFile'] || {};
    let swiftAdded = false;
    let objcAdded = false;

    for (const key in buildFiles) {
      const file = buildFiles[key];
      if (file.fileRef) {
        const fileRef = xcodeProject.hash.project.objects['PBXFileReference'][file.fileRef];
        if (fileRef && fileRef.path === 'DuetAudioManager.swift') swiftAdded = true;
        if (fileRef && fileRef.path === 'DuetAudioManager.m') objcAdded = true;
      }
    }

    if (!swiftAdded) {
      xcodeProject.addSourceFile(swiftFile, null, duetAudioGroup?.uuid);
    }
    if (!objcAdded) {
      xcodeProject.addSourceFile(objcFile, null, duetAudioGroup?.uuid);
    }

    console.log('[withDuetAudio] Added iOS source files to Xcode project');

    return config;
  });
}

// =====================
// MAIN EXPORT
// =====================

module.exports = function withDuetAudio(config) {
  // Android
  config = withDuetAudioAndroid(config);
  config = withDuetAudioMainApplication(config);

  // iOS
  config = withDuetAudioIOS(config);
  config = withDuetAudioXcodeProject(config);

  return config;
};
