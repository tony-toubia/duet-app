const { withMainApplication, withDangerousMod, withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// =====================
// ANDROID NATIVE CODE
// =====================

// Android native module code - Note: Using ${'$'} to escape $ in template literals for Kotlin
const DUET_AUDIO_MANAGER_KT = `package com.duet.audio

import android.content.Context
import android.content.Intent
import android.media.*
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.os.PowerManager
import android.util.Base64
import android.view.KeyEvent
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

    @Volatile private var isRecording = false
    @Volatile private var isMuted = false
    @Volatile private var isDeafened = false

    // Standard sample rate for capture (we always capture at 48kHz for consistency)
    private val captureSampleRate = 48000
    // Playback sample rate - dynamically set based on received audio
    private var playbackSampleRate = 48000
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
    private var wakeLock: PowerManager.WakeLock? = null

    // Dynamic ducking state
    private var hasDuckingFocus = false
    private var lastAudioPlayTime = 0L
    private val duckingTimeoutMs = 500L // Unduck after 500ms of silence
    private var duckingCheckHandler: android.os.Handler? = null
    private var duckingCheckRunnable: Runnable? = null

    override fun getName() = "DuetAudioManager"

    @ReactMethod
    fun setupAudioSession(promise: Promise) {
        try {
            audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // Initialize the handler for ducking timeout checks
            duckingCheckHandler = android.os.Handler(android.os.Looper.getMainLooper())

            // Prepare the focus request but don't request it yet
            // We'll request focus dynamically when partner audio arrives
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Use USAGE_ASSISTANT - this triggers ducking without switching from A2DP to HFP
                // on Bluetooth devices (unlike USAGE_VOICE_COMMUNICATION which can force HFP)
                val focusAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(focusAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setWillPauseWhenDucked(false) // Don't pause, just duck
                    .setOnAudioFocusChangeListener { focusChange ->
                        handleAudioFocusChange(focusChange)
                    }
                    .build()
            }

            // Don't request focus here - we'll do it dynamically when partner speaks

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("sampleRate", captureSampleRate)
            })
        } catch (e: Exception) {
            promise.reject("AUDIO_SESSION_ERROR", "Failed to setup audio session: ${'$'}{e.message}")
        }
    }

    // Request audio focus to duck other apps (called when partner audio arrives)
    private fun requestDuckingFocus() {
        if (hasDuckingFocus) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let {
                val result = audioManager?.requestAudioFocus(it)
                hasDuckingFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
                android.util.Log.d("DuetAudio", "Ducking focus requested, granted: ${'$'}hasDuckingFocus")
            }
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager?.requestAudioFocus(
                { focusChange -> handleAudioFocusChange(focusChange) },
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
            hasDuckingFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            android.util.Log.d("DuetAudio", "Ducking focus requested (legacy), granted: ${'$'}hasDuckingFocus")
        }
    }

    // Abandon audio focus to restore other apps' volume
    private fun abandonDuckingFocus() {
        if (!hasDuckingFocus) return

        android.util.Log.d("DuetAudio", "Abandoning ducking focus")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
        }
        hasDuckingFocus = false
    }

    // Schedule a check to unduck after silence
    private fun scheduleDuckingTimeout() {
        duckingCheckRunnable?.let { duckingCheckHandler?.removeCallbacks(it) }

        duckingCheckRunnable = Runnable {
            val timeSinceLastAudio = System.currentTimeMillis() - lastAudioPlayTime
            if (timeSinceLastAudio >= duckingTimeoutMs) {
                abandonDuckingFocus()
            }
        }

        duckingCheckHandler?.postDelayed(duckingCheckRunnable!!, duckingTimeoutMs)
    }

    @ReactMethod
    fun startAudioEngine(promise: Promise) {
        try {
            // IMPORTANT: Do NOT use MODE_IN_COMMUNICATION - it forces Bluetooth to switch from
            // A2DP (high quality music) to HFP/SCO (low quality voice), breaking audio companion
            // Instead, we keep MODE_NORMAL and rely on audio focus for ducking
            // audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION // REMOVED - breaks A2DP
            android.util.Log.d("DuetAudio", "Audio mode kept as MODE_NORMAL to preserve A2DP")

            // Acquire wake lock to keep CPU running in background
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Duet::AudioWakeLock"
            )
            wakeLock?.acquire()
            android.util.Log.d("DuetAudio", "Wake lock acquired")

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
        val bufferSize = AudioRecord.getMinBufferSize(captureSampleRate, channelConfigIn, audioFormat)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            captureSampleRate,
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
        setupAudioTrackWithSampleRate(playbackSampleRate)
    }

    private fun setupAudioTrackWithSampleRate(sampleRate: Int) {
        // Stop and release existing track if any
        audioTrack?.let {
            if (it.state == AudioTrack.STATE_INITIALIZED) {
                it.stop()
                it.release()
            }
        }

        val bufferSize = AudioTrack.getMinBufferSize(sampleRate, channelConfigOut, audioFormat)

        // Use USAGE_ASSISTANT for playback - this keeps A2DP active on Bluetooth
        // (unlike USAGE_VOICE_COMMUNICATION which may switch to HFP)
        // The audio focus request (separate) handles ducking of other apps
        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
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

        playbackSampleRate = sampleRate
        audioTrack?.play()
        android.util.Log.d("DuetAudio", "AudioTrack configured for ${'$'}sampleRate Hz")
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

        // Clean up ducking
        duckingCheckRunnable?.let { duckingCheckHandler?.removeCallbacks(it) }
        abandonDuckingFocus()

        // Audio mode is already MODE_NORMAL (we don't change it to preserve A2DP)
        android.util.Log.d("DuetAudio", "Audio engine stopped, ducking focus abandoned")

        // Release wake lock
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
            android.util.Log.d("DuetAudio", "Wake lock released")
        }
        wakeLock = null

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
                putInt("sampleRate", captureSampleRate)
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
            android.util.Log.d("DuetAudio", "playAudio: skipped (deafened)")
            promise.resolve(Arguments.createMap().apply {
                putBoolean("played", false)
                putString("reason", "deafened")
            })
            return
        }

        try {
            val receivedSampleRate = sampleRate.toInt()

            // Check if we need to reconfigure AudioTrack for different sample rate
            if (receivedSampleRate != playbackSampleRate && receivedSampleRate > 0) {
                android.util.Log.d("DuetAudio", "Sample rate changed from ${'$'}playbackSampleRate to ${'$'}receivedSampleRate, reconfiguring AudioTrack")
                setupAudioTrackWithSampleRate(receivedSampleRate)
            }

            // Request ducking focus when partner audio arrives
            requestDuckingFocus()
            lastAudioPlayTime = System.currentTimeMillis()

            val floatArray = base64ToFloatArray(base64Audio)
            val written = audioTrack?.write(floatArray, 0, floatArray.size, AudioTrack.WRITE_NON_BLOCKING) ?: 0
            android.util.Log.d("DuetAudio", "playAudio: received ${'$'}{base64Audio.length} bytes, decoded ${'$'}{floatArray.size} samples at ${'$'}receivedSampleRate Hz, wrote ${'$'}written to AudioTrack")

            // Schedule unduck after silence
            scheduleDuckingTimeout()

            promise.resolve(Arguments.createMap().apply {
                putBoolean("played", true)
            })
        } catch (e: Exception) {
            android.util.Log.e("DuetAudio", "playAudio failed: ${'$'}{e.message}")
            promise.reject("PLAYBACK_ERROR", "Failed to play audio: ${'$'}{e.message}")
        }
    }

    @ReactMethod
    fun setMuted(muted: Boolean) {
        android.util.Log.d("DuetAudio", "setMuted called: ${'$'}muted")
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
        android.util.Log.d("DuetAudio", "setDeafened called: ${'$'}deafened")
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

    // =====================
    // MEDIA CONTROLS
    // =====================

    @ReactMethod
    fun mediaPlay() {
        sendMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PLAY)
    }

    @ReactMethod
    fun mediaPause() {
        sendMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PAUSE)
    }

    @ReactMethod
    fun mediaPlayPause() {
        sendMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
    }

    @ReactMethod
    fun mediaNext() {
        sendMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_NEXT)
    }

    @ReactMethod
    fun mediaPrevious() {
        sendMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PREVIOUS)
    }

    private fun sendMediaKeyEvent(keyCode: Int) {
        val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // Send key down
        val downEvent = KeyEvent(KeyEvent.ACTION_DOWN, keyCode)
        audioManager.dispatchMediaKeyEvent(downEvent)

        // Send key up
        val upEvent = KeyEvent(KeyEvent.ACTION_UP, keyCode)
        audioManager.dispatchMediaKeyEvent(upEvent)
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
import MediaPlayer
import React
import UIKit

@objc(DuetAudioManager)
class DuetAudioManager: RCTEventEmitter {

  private var audioEngine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  private var mixerNode: AVAudioMixerNode?
  private var audioConverter: AVAudioConverter?

  private var isSessionActive = false
  private var isMuted = false
  private var isDeafened = false

  // Standard output sample rate - always output at 48kHz for cross-platform consistency
  private let outputSampleRate: Double = 48000
  private let channels: AVAudioChannelCount = 1

  // Actual device input sample rate (may differ from outputSampleRate)
  private var inputSampleRate: Double = 48000

  // VAD (Voice Activity Detection) settings
  private var vadThreshold: Float = 0.01
  private var isSpeaking = false
  private var silenceFrames = 0
  private let silenceThreshold = 10 // frames of silence before stopping

  // Ducking toggle - default OFF (mix only). User can enable to duck other apps,
  // but some apps (Spotify, Disney+) may pause instead of ducking.
  private var duckingEnabled = false

  // Background task tracking
  private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

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
    // Don't configure audio session category here - setting .playAndRecord
    // immediately would interrupt other apps. We defer ALL audio session
    // configuration to startAudioEngine when the user actually joins a room.
    isSessionActive = true

    // Listen for interruptions (phone calls, etc.)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )

    // Listen for route changes (headphones plugged/unplugged, Bluetooth connect/disconnect)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )

    // Log current audio route for debugging
    let currentRoute = AVAudioSession.sharedInstance().currentRoute
    let outputs = currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ", ")
    print("[DuetAudio] Audio session ready (deferred), current outputs: \\(outputs)")

    resolve(["success": true, "sampleRate": outputSampleRate])
  }

  // MARK: - Audio Session Options
  //
  // Default: .mixWithOthers only (no ducking). Partner voice overlays on top.
  // Optional: User can enable ducking (.duckOthers) which lowers other apps' volume
  // when partner speaks. Warning: some apps (Spotify, Disney+) may pause instead.

  private func audioSessionOptions() -> AVAudioSession.CategoryOptions {
    var options: AVAudioSession.CategoryOptions = [
      .mixWithOthers,
      .allowBluetooth,
      .allowBluetoothA2DP,
      .defaultToSpeaker
    ]
    if duckingEnabled {
      options.insert(.duckOthers)
    }
    return options
  }

  @objc
  func setDuckingEnabled(_ enabled: Bool) {
    duckingEnabled = enabled
    print("[DuetAudio] Ducking \\(enabled ? "enabled" : "disabled")")

    // Apply immediately only if the engine is running.
    // We deactivate briefly then reactivate to avoid the interruption-on-setCategory issue.
    // The brief deactivation with .notifyOthersOnDeactivation tells other apps to resume,
    // then the new setCategory + engine.start() reactivates cleanly.
    if audioEngine?.isRunning == true {
      do {
        let session = AVAudioSession.sharedInstance()

        // Stop engine temporarily
        audioEngine?.pause()

        // Deactivate and notify others to resume
        try session.setActive(false, options: [.notifyOthersOnDeactivation])

        // Reconfigure with new options
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: audioSessionOptions()
        )

        // Restart engine (implicitly reactivates session)
        try audioEngine?.start()
        playerNode?.play()

        print("[DuetAudio] Audio session reconfigured with ducking=\\(enabled)")
      } catch {
        print("[DuetAudio] Failed to reconfigure ducking: \\(error)")
        // Try to recover
        try? audioEngine?.start()
        playerNode?.play()
      }
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
      // Begin background task to ensure audio setup completes
      backgroundTaskID = UIApplication.shared.beginBackgroundTask { [weak self] in
        // Expiration handler - clean up if we're about to be suspended
        self?.endBackgroundTask()
      }

      // Configure audio session for voice + mixing.
      // IMPORTANT: Do NOT call setActive(true) explicitly here.
      // Let AVAudioEngine.start() activate it implicitly - this avoids sending
      // interruption notifications to other apps (Spotify, etc.) which cause them to pause.
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(
        .playAndRecord,
        mode: .default,
        options: audioSessionOptions()
      )
      try session.setPreferredSampleRate(outputSampleRate)
      try session.setPreferredIOBufferDuration(0.02) // 20ms buffer for low latency
      // Session will be activated implicitly by engine.start() below

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

      // Standard output format at 48kHz for cross-platform consistency
      let outputFormat = AVAudioFormat(
        standardFormatWithSampleRate: outputSampleRate,
        channels: channels
      )!

      // Connect: player -> mixer -> main output
      engine.connect(player, to: mixer, format: outputFormat)
      engine.connect(mixer, to: engine.mainMixerNode, format: outputFormat)

      // Get the actual input format from the device
      let inputNode = engine.inputNode
      let inputFormat = inputNode.outputFormat(forBus: 0)
      inputSampleRate = inputFormat.sampleRate

      print("[DuetAudio] Device input sample rate: \\(inputSampleRate) Hz, output: \\(outputSampleRate) Hz")

      // Create converter if input sample rate differs from our standard output rate
      if inputSampleRate != outputSampleRate {
        audioConverter = AVAudioConverter(from: inputFormat, to: outputFormat)
        print("[DuetAudio] Created audio converter for resampling \\(inputSampleRate) -> \\(outputSampleRate)")
      } else {
        audioConverter = nil
      }

      // Install tap on input (microphone) to capture audio
      // Use a larger buffer for resampling headroom
      let bufferSize: AVAudioFrameCount = inputSampleRate != outputSampleRate ? 2048 : 960

      inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, time in
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
    audioConverter = nil

    // Deactivate session and notify other apps so they can resume
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setActive(false, options: [.notifyOthersOnDeactivation])
    } catch {
      print("[DuetAudio] Failed to deactivate audio session: \\(error)")
    }

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
      // Resample to standard 48kHz if needed for cross-platform consistency
      let outputBuffer: AVAudioPCMBuffer
      if let converter = audioConverter {
        // Need to resample
        guard let resampledBuffer = resampleBuffer(buffer, using: converter) else {
          print("[DuetAudio] Failed to resample audio buffer")
          return
        }
        outputBuffer = resampledBuffer
      } else {
        // No resampling needed
        outputBuffer = buffer
      }

      if let data = bufferToBase64(outputBuffer) {
        sendEvent(withName: "onAudioData", body: [
          "audio": data,
          "sampleRate": outputSampleRate,  // Always send at standard rate
          "channels": channels
        ])
      }
    }
  }

  private func resampleBuffer(_ inputBuffer: AVAudioPCMBuffer, using converter: AVAudioConverter) -> AVAudioPCMBuffer? {
    // Calculate output frame count based on sample rate ratio
    let ratio = outputSampleRate / inputBuffer.format.sampleRate
    let outputFrameCount = AVAudioFrameCount(Double(inputBuffer.frameLength) * ratio)

    guard let outputFormat = AVAudioFormat(standardFormatWithSampleRate: outputSampleRate, channels: channels),
          let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: outputFrameCount) else {
      return nil
    }

    var error: NSError?
    let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
      outStatus.pointee = .haveData
      return inputBuffer
    }

    let status = converter.convert(to: outputBuffer, error: &error, withInputFrom: inputBlock)

    if status == .error {
      print("[DuetAudio] Conversion error: \\(error?.localizedDescription ?? "unknown")")
      return nil
    }

    return outputBuffer
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

  // MARK: - Media Controls
  //
  // iOS has no public API to control third-party media apps (Spotify, etc.)
  // like Android's dispatchMediaKeyEvent. MPMusicPlayerController.systemMusicPlayer
  // only works with Apple Music and crashes with other media apps.
  //
  // We use the private MediaRemote.framework via runtime dynamic linking to send
  // system-wide media commands. This is the same approach used by Discord, Shazam,
  // and other popular apps. The functions are loaded at runtime to avoid linking issues.

  private static var mediaRemoteBundle: CFBundle?
  private static var mediaRemoteLoaded = false

  private typealias MRMediaRemoteSendCommandFunc = @convention(c) (Int, AnyObject?) -> Bool

  private static func loadMediaRemote() {
    guard !mediaRemoteLoaded else { return }
    mediaRemoteLoaded = true

    let path = "/System/Library/PrivateFrameworks/MediaRemote.framework"
    guard let url = CFURLCreateWithFileSystemPath(kCFAllocatorDefault, path as CFString, .cfurlposixPathStyle, true) else {
      print("[DuetAudio] Failed to create MediaRemote URL")
      return
    }
    mediaRemoteBundle = CFBundleCreate(kCFAllocatorDefault, url)
    if let bundle = mediaRemoteBundle {
      CFBundleLoadExecutable(bundle)
      print("[DuetAudio] MediaRemote.framework loaded successfully")
    } else {
      print("[DuetAudio] Failed to load MediaRemote.framework")
    }
  }

  private static func sendMediaRemoteCommand(_ command: Int) {
    loadMediaRemote()
    guard let bundle = mediaRemoteBundle else {
      print("[DuetAudio] MediaRemote not available")
      return
    }

    guard let ptr = CFBundleGetFunctionPointerForName(bundle, "MRMediaRemoteSendCommand" as CFString) else {
      print("[DuetAudio] MRMediaRemoteSendCommand not found")
      return
    }

    let sendCommand = unsafeBitCast(ptr, to: MRMediaRemoteSendCommandFunc.self)
    let _ = sendCommand(command, nil)
  }

  // MediaRemote command constants
  private static let kMRPlay = 0
  private static let kMRPause = 1
  private static let kMRTogglePlayPause = 2
  private static let kMRNextTrack = 4
  private static let kMRPreviousTrack = 5

  @objc
  func mediaPlayPause() {
    DuetAudioManager.sendMediaRemoteCommand(DuetAudioManager.kMRTogglePlayPause)
  }

  @objc
  func mediaPlay() {
    DuetAudioManager.sendMediaRemoteCommand(DuetAudioManager.kMRPlay)
  }

  @objc
  func mediaPause() {
    DuetAudioManager.sendMediaRemoteCommand(DuetAudioManager.kMRPause)
  }

  @objc
  func mediaNext() {
    DuetAudioManager.sendMediaRemoteCommand(DuetAudioManager.kMRNextTrack)
  }

  @objc
  func mediaPrevious() {
    DuetAudioManager.sendMediaRemoteCommand(DuetAudioManager.kMRPreviousTrack)
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

    let session = AVAudioSession.sharedInstance()
    let currentRoute = session.currentRoute
    let outputs = currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ", ")

    print("[DuetAudio] Route changed: \\(reason.rawValue), outputs: \\(outputs)")

    switch reason {
    case .newDeviceAvailable:
      // New audio device connected (e.g., AirPods, car Bluetooth)
      // Check if it's a Bluetooth device and ensure A2DP is preserved
      let isBluetoothA2DP = currentRoute.outputs.contains { output in
        output.portType == .bluetoothA2DP
      }
      let isBluetoothHFP = currentRoute.outputs.contains { output in
        output.portType == .bluetoothHFP
      }

      if isBluetoothA2DP {
        print("[DuetAudio] Bluetooth A2DP connected - high quality audio preserved")
      } else if isBluetoothHFP {
        // HFP is voice-optimized but lower quality - try to switch to A2DP if available
        print("[DuetAudio] Warning: Bluetooth HFP active - attempting to preserve A2DP")
        reconfigureAudioSessionForBluetooth()
      }

      sendEvent(withName: "onConnectionStateChange", body: [
        "state": "routeChanged",
        "reason": "deviceConnected",
        "isBluetoothA2DP": isBluetoothA2DP
      ])

    case .oldDeviceUnavailable:
      // Audio device disconnected - reconfigure session
      print("[DuetAudio] Device disconnected, reconfiguring audio session")
      reconfigureAudioSessionForBluetooth()
      sendEvent(withName: "onConnectionStateChange", body: [
        "state": "routeChanged",
        "reason": "deviceDisconnected"
      ])

    case .categoryChange:
      // Audio category changed by another app - restore our settings
      print("[DuetAudio] Category changed externally, reconfiguring")
      reconfigureAudioSessionForBluetooth()

    default:
      break
    }
  }

  private func reconfigureAudioSessionForBluetooth() {
    do {
      let session = AVAudioSession.sharedInstance()
      // Reconfigure with our preferred settings to ensure A2DP is used when available
      try session.setCategory(
        .playAndRecord,
        mode: .default,  // default mode allows A2DP; voiceChat forces HFP
        options: audioSessionOptions()
      )
      try session.setActive(true)
      print("[DuetAudio] Audio session reconfigured for Bluetooth A2DP")
    } catch {
      print("[DuetAudio] Failed to reconfigure audio session: \\(error)")
    }
  }

  private func endBackgroundTask() {
    if backgroundTaskID != .invalid {
      UIApplication.shared.endBackgroundTask(backgroundTaskID)
      backgroundTaskID = .invalid
    }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    endBackgroundTask()
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
RCT_EXTERN_METHOD(setDuckingEnabled:(BOOL)enabled)

RCT_EXTERN_METHOD(mediaPlayPause)
RCT_EXTERN_METHOD(mediaPlay)
RCT_EXTERN_METHOD(mediaPause)
RCT_EXTERN_METHOD(mediaNext)
RCT_EXTERN_METHOD(mediaPrevious)

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
      const projectName = config.modRequest.projectName || 'Duet';
      const iosDir = path.join(projectRoot, 'ios');

      // Put files directly in the main project directory (e.g., ios/Duet/)
      const mainProjectDir = path.join(iosDir, projectName);

      // Write Swift file directly in main project directory
      fs.writeFileSync(
        path.join(mainProjectDir, 'DuetAudioManager.swift'),
        DUET_AUDIO_MANAGER_SWIFT
      );

      // Write Objective-C bridging file
      fs.writeFileSync(
        path.join(mainProjectDir, 'DuetAudioManager.m'),
        DUET_AUDIO_MANAGER_M
      );

      console.log('[withDuetAudio] Created iOS native audio module files in:', mainProjectDir);

      return config;
    },
  ]);
}

function withDuetAudioXcodeProject(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || 'Duet';

    // Add Swift file to project
    xcodeProject.addSourceFile(
      `${projectName}/DuetAudioManager.swift`,
      { target: xcodeProject.getFirstTarget().uuid },
      xcodeProject.getFirstProject().firstProject.mainGroup
    );

    // Add Objective-C file to project
    xcodeProject.addSourceFile(
      `${projectName}/DuetAudioManager.m`,
      { target: xcodeProject.getFirstTarget().uuid },
      xcodeProject.getFirstProject().firstProject.mainGroup
    );

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
