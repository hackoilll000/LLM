# services/voice_utils.py
import os
import json
from vosk import Model, KaldiRecognizer
from TTS.api import TTS
import wave
import tempfile

class VoiceUtils:
    def __init__(self):
        # --- VOSK (STT) Initialization ---
        # NOTE: You need to download a Vosk model, e.g., 'vosk-model-small-en-us-0.15'
        # and place it in a 'models' directory.
        vosk_model_path = "./models/vosk-model-small-en-us-0.15"
        if os.path.exists(vosk_model_path):
            self.vosk_model = Model(vosk_model_path)
        else:
            print("Warning: Vosk model not found. STT will not work.")
            self.vosk_model = None

        # --- Coqui (TTS) Initialization ---
        # NOTE: This will download the model on first run.
        try:
            self.tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)
        except Exception as e:
            print(f"Warning: Coqui TTS failed to initialize: {e}. TTS will not work.")
            self.tts = None

    def stt_process_audio(self, audio_bytes: bytes) -> str:
        """Transcribes audio bytes to text using Vosk."""
        if not self.vosk_model:
            return "Error: Speech-to-text model not loaded."

        # Vosk requires a WAV file format. We can process the raw bytes.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            wf = wave.open(tmp_wav.name, "wb")
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(audio_bytes)
            wf.close()

            with wave.open(tmp_wav.name, "rb") as wf:
                rec = KaldiRecognizer(self.vosk_model, wf.getframerate())
                rec.SetWords(True)
                
                while True:
                    data = wf.readframes(4000)
                    if len(data) == 0:
                        break
                    if rec.AcceptWaveform(data):
                        pass
                
                result = json.loads(rec.FinalResult())
                return result.get('text', '')

    def tts_generate_speech(self, text: str) -> str:
        """Generates speech from text and returns the file path."""
        if not self.tts:
            raise RuntimeError("Text-to-speech engine not initialized.")

        # Create a temporary file to save the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as fp:
            filepath = fp.name
        
        self.tts.tts_to_file(text=text, file_path=filepath)
        return filepath