package com.duet.audio

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
    
    // Audio format settings (matches iOS)
    private val sampleRate = 48000
    private val channelConfigIn = AudioFormat.CHANNEL_IN_MONO
    private val channelConfigOut = AudioFormat.CHANNEL_OUT_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_FLOAT
    
    // VAD settings
    private var vadThreshold = 0.01f
    private var isSpeaking = false
    private var silenceFrames = 0
    private val silenceThreshold = 10
    
    // Echo cancellation and noise suppression
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    
    // Audio focus
    private var focusRequest: AudioFocusRequest? = null
    
    override fun getName() = "DuetAudioManager"

    // =====================
    // AUDIO SESSION SETUP
    // =====================
    
    @ReactMethod
    fun setupAudioSession(promise: Promise) {
        try {
            audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
            // Request audio focus with ducking
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
            
            // Set mode for voice communication
            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
            
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("sampleRate", sampleRate)
            })
        } catch (e: Exception) {
            promise.reject("AUDIO_SESSION_ERROR", "Failed to setup audio session: ${e.message}")
        }
    }
    
    // =====================
    // AUDIO ENGINE
    // =====================
    
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
            promise.reject("ENGINE_START_ERROR", "Failed to start audio engine: ${e.message}")
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
        
        // Enable echo cancellation if available
        if (AcousticEchoCanceler.isAvailable()) {
            echoCanceler = AcousticEchoCanceler.create(audioRecord!!.audioSessionId)
            echoCanceler?.enabled = true
        }
        
        // Enable noise suppression if available
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
            val bufferSize = 960 // ~20ms at 48kHz
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
        
        // Release audio focus
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
    
    // =====================
    // AUDIO PROCESSING
    // =====================
    
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
        
        // Only send audio data when speaking
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
    
    // =====================
    // PLAYBACK
    // =====================
    
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
            promise.reject("PLAYBACK_ERROR", "Failed to play audio: ${e.message}")
        }
    }
    
    // =====================
    // CONTROLS
    // =====================
    
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
    
    // =====================
    // UTILITY FUNCTIONS
    // =====================
    
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
    
    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep track of listeners if needed
    }
    
    @ReactMethod
    fun removeListeners(count: Int) {
        // Remove listeners if needed
    }
}
