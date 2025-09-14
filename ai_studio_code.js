// static/script.js
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const ttsToggle = document.getElementById('tts-toggle');
    const ttsIcon = document.getElementById('tts-icon');
    const chatContainer = document.getElementById('chat-container');

    let isTtsEnabled = true;
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    // --- Core Chat Function ---
    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage(message, 'user');
        chatInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            if (!response.ok) throw new Error('Network response was not ok.');
            
            const data = await response.json();
            appendMessage(data.response, 'ai');

            if (isTtsEnabled) {
                playTts(data.response);
            }

        } catch (error) {
            console.error('Error:', error);
            appendMessage('Sorry, something went wrong.', 'ai');
        }
    };

    const playTts = async (text) => {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) throw new Error('TTS generation failed.');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();

        } catch (error) {
            console.error('TTS Error:', error);
        }
    };

    // --- UI Helpers ---
    const appendMessage = (message, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.classList.add('chat-bubble', sender === 'user' ? 'user-bubble' : 'ai-bubble');
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // --- Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    ttsToggle.addEventListener('click', () => {
        isTtsEnabled = !isTtsEnabled;
        ttsIcon.classList.toggle('fa-volume-up', isTtsEnabled);
        ttsIcon.classList.toggle('fa-volume-mute', !isTtsEnabled);
        ttsToggle.title = isTtsEnabled ? 'Disable Speech Output' : 'Enable Speech Output';
    });

    // --- Speech Recognition (STT) ---
    micButton.addEventListener('click', async () => {
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            micButton.classList.remove('bg-red-600');
            micButton.classList.add('bg-blue-600');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                isRecording = true;
                audioChunks = [];
                micButton.classList.remove('bg-blue-600');
                micButton.classList.add('bg-red-600');

                mediaRecorder.addEventListener("dataavailable", event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener("stop", async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.wav');

                    try {
                        const res = await fetch('/api/stt', { method: 'POST', body: formData });
                        if (!res.ok) throw new Error('STT failed');
                        const data = await res.json();
                        chatInput.value = data.text;
                        sendMessage(); // Automatically send after transcription
                    } catch (error) {
                        console.error('STT Error:', error);
                        appendMessage('Could not process speech.', 'ai');
                    }
                });
            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Microphone access is required for voice input.");
            }
        }
    });
});