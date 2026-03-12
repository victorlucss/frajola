import Foundation
import Speech
import AVFoundation

// MARK: - C-compatible callback types

public typealias DictSpeechResultCallback = @convention(c) (
    UnsafeMutableRawPointer?, UnsafePointer<CChar>, Bool
) -> Void

public typealias DictSpeechLevelCallback = @convention(c) (
    UnsafeMutableRawPointer?, Float
) -> Void

public typealias DictSpeechErrorCallback = @convention(c) (
    UnsafeMutableRawPointer?, UnsafePointer<CChar>
) -> Void

// MARK: - Bridge class

class SpeechBridge {
    static let shared = SpeechBridge()

    private var speechRecognizer: SFSpeechRecognizer?
    private var audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var lastPartialText: String = ""
    private var delivered = false
    private var sessionID: Int = 0
    private var bufferCount: Int = 0

    private var resultCallback: DictSpeechResultCallback?
    private var levelCallback: DictSpeechLevelCallback?
    private var errorCallback: DictSpeechErrorCallback?
    private var callbackContext: UnsafeMutableRawPointer?

    private init() {}

    func setCallbacks(
        context: UnsafeMutableRawPointer?,
        onResult: DictSpeechResultCallback?,
        onLevel: DictSpeechLevelCallback?,
        onError: DictSpeechErrorCallback?
    ) {
        callbackContext = context
        resultCallback = onResult
        levelCallback = onLevel
        errorCallback = onError
    }

    private func localeIdentifier(for language: String) -> String {
        switch language {
        case "pt": return "pt-BR"
        default: return "en-US"
        }
    }

    func start(language: String) {
        // Must run on main thread for AVAudioEngine
        if !Thread.isMainThread {
            DispatchQueue.main.async { [self] in
                self.start(language: language)
            }
            return
        }

        NSLog("[DictSpeech] start() called, language=%@", language)

        // Request permissions inline if not yet determined (matching original app)
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        if speechStatus == .notDetermined {
            NSLog("[DictSpeech] Speech auth not determined, requesting...")
            SFSpeechRecognizer.requestAuthorization { status in
                NSLog("[DictSpeech] Speech auth result: %d", status.rawValue)
                if status == .authorized {
                    DispatchQueue.main.async { [self] in
                        self.startRecognition(language: language)
                    }
                } else {
                    self.reportError("Speech recognition permission denied")
                }
            }
            return
        }

        if speechStatus != .authorized {
            NSLog("[DictSpeech] Speech auth denied (status=%d)", speechStatus.rawValue)
            reportError("Speech recognition permission denied")
            return
        }

        startRecognition(language: language)
    }

    private func startRecognition(language: String) {
        sessionID += 1
        let currentSession = sessionID
        delivered = false
        lastPartialText = ""
        bufferCount = 0

        // Cancel any previous task
        if recognitionTask != nil {
            recognitionTask?.cancel()
            recognitionTask = nil
        }

        // Clean up any existing tap
        audioEngine.inputNode.removeTap(onBus: 0)

        let locale = Locale(identifier: localeIdentifier(for: language))
        speechRecognizer = SFSpeechRecognizer(locale: locale)

        guard let recognizer = speechRecognizer else {
            NSLog("[DictSpeech] ERROR: SFSpeechRecognizer is nil for locale %@", locale.identifier)
            reportError("Speech recognizer not available for locale \(locale.identifier)")
            return
        }

        guard recognizer.isAvailable else {
            reportError("Speech recognizer not available")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Don't set requiresOnDeviceRecognition — let the system decide
        recognitionRequest = request

        // Set up audio engine
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) {
            [weak self] buffer, _ in
            guard let self = self else { return }
            self.recognitionRequest?.append(buffer)
            self.bufferCount += 1

            // Compute audio level (RMS)
            guard let channelData = buffer.floatChannelData else { return }
            let frames = Int(buffer.frameLength)
            var sum: Float = 0
            for i in 0..<frames {
                let sample = channelData[0][i]
                sum += sample * sample
            }
            let rms = sqrt(sum / max(Float(frames), 1.0))
            let normalized = min(1.0, sqrt(min(1.0, rms * 20.0)))

            // Marshal level callback to main thread for FFI safety
            let level = normalized
            let ctx = self.callbackContext
            let cb = self.levelCallback
            DispatchQueue.main.async {
                cb?(ctx, level)
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            NSLog("[DictSpeech] Audio engine started")
        } catch {
            NSLog("[DictSpeech] ERROR: Audio engine failed: %@", error.localizedDescription)
            reportError("Audio engine failed to start: \(error.localizedDescription)")
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) {
            [weak self] result, error in
            guard let self = self, self.sessionID == currentSession else { return }

            if let result = result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    self.delivered = true
                    self.deliverResult(text, isFinal: true)
                } else {
                    self.lastPartialText = text
                    self.deliverResult(text, isFinal: false)
                }
            }

            if let error = error {
                let nsError = error as NSError
                NSLog("[DictSpeech] Error: domain=%@ code=%d desc=%@", nsError.domain, nsError.code, nsError.localizedDescription)
                // Error 216 = request cancelled (normal on stop)
                if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 216 {
                    if !self.delivered && !self.lastPartialText.isEmpty {
                        self.delivered = true
                        self.deliverResult(self.lastPartialText, isFinal: true)
                    }
                } else if nsError.localizedDescription.contains("Dictation")
                    || nsError.localizedDescription.contains("Siri")
                {
                    self.reportError("DICTATION_DISABLED")
                } else {
                    self.reportError(error.localizedDescription)
                }
            }
        }
        NSLog("[DictSpeech] Recognition task created")
    }

    func stop() {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [self] in
                self.stop()
            }
            return
        }

        NSLog("[DictSpeech] stop() called, buffers received: %d", bufferCount)

        let currentSession = sessionID

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()

        // 3-second timeout to allow final result to arrive
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            guard let self = self, self.sessionID == currentSession else { return }
            if !self.delivered {
                self.delivered = true
                let text = self.lastPartialText
                self.deliverResult(text, isFinal: true)
            }
            self.recognitionTask?.cancel()
            self.recognitionTask = nil
        }
    }

    func cancel() {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [self] in
                self.cancel()
            }
            return
        }

        sessionID += 1
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
    }

    private func deliverResult(_ text: String, isFinal: Bool) {
        text.withCString { cStr in
            resultCallback?(callbackContext, cStr, isFinal)
        }
    }

    private func reportError(_ message: String) {
        message.withCString { cStr in
            errorCallback?(callbackContext, cStr)
        }
    }
}

// MARK: - C FFI

@_cdecl("dict_speech_set_callbacks")
public func dict_speech_set_callbacks(
    context: UnsafeMutableRawPointer?,
    onResult: DictSpeechResultCallback?,
    onLevel: DictSpeechLevelCallback?,
    onError: DictSpeechErrorCallback?
) {
    SpeechBridge.shared.setCallbacks(
        context: context,
        onResult: onResult,
        onLevel: onLevel,
        onError: onError
    )
}

@_cdecl("dict_speech_start")
public func dict_speech_start(language: UnsafePointer<CChar>) {
    let lang = String(cString: language)
    SpeechBridge.shared.start(language: lang)
}

@_cdecl("dict_speech_stop")
public func dict_speech_stop() {
    SpeechBridge.shared.stop()
}

@_cdecl("dict_speech_cancel")
public func dict_speech_cancel() {
    SpeechBridge.shared.cancel()
}

@_cdecl("dict_speech_request_permissions")
public func dict_speech_request_permissions(
    callback: @convention(c) (Bool, Bool) -> Void
) {
    var speechGranted = false
    var micGranted = false
    let group = DispatchGroup()

    group.enter()
    SFSpeechRecognizer.requestAuthorization { status in
        speechGranted = (status == .authorized)
        group.leave()
    }

    group.enter()
    AVCaptureDevice.requestAccess(for: .audio) { granted in
        micGranted = granted
        group.leave()
    }

    group.notify(queue: .global()) {
        NSLog("[DictSpeech] Permission results — speech: %d, mic: %d", speechGranted ? 1 : 0, micGranted ? 1 : 0)
        callback(speechGranted, micGranted)
    }
}
