/* ==========================================================================
   JEN AI - AUDIO & SPEECH SYNTHESIS ENGINE
   Features: Multi-voice Speech Synthesis with word-sync callbacks,
             Web Audio Ambient Background Soundscape Generator (Lo-Fi/Cosmic/Rain),
             Microphone Speech-to-Text Recognition
   ========================================================================== */

class AudioEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.selectedVoice = null;
        this.pitch = 1.0;
        this.rate = 1.05;
        this.isMuted = false;
        this.currentUtterance = null;

        // Background Music / Ambiance Synthesizer
        this.audioCtx = null;
        this.bgmType = 'lofi';
        this.bgmVolume = 0.3;
        this.isBgmPlaying = false;
        this.activeNodes = [];
        this.bgmGainNode = null;

        // Speech-to-Text Recognition
        this.recognition = null;
        this.isRecording = false;

        // Callbacks
        this.onWordSpoken = null;     // (word) => void
        this.onSpeechStart = null;    // () => void
        this.onSpeechEnd = null;      // () => void
        this.onStateChange = null;    // (state) => void

        this.initVoices();
        this.initSpeechRecognition();
    }

    /* --------------------------------------------------------------------------
       1. TEXT-TO-SPEECH (TTS) & VOICE SELECTION
       -------------------------------------------------------------------------- */
    initVoices() {
        if (!this.synth) {
            console.warn("SpeechSynthesis not supported by this browser.");
            return;
        }

        const populate = () => {
            this.voices = this.synth.getVoices();
            const voiceSelect = document.getElementById("voiceSelect");
            const activeVoiceLabel = document.getElementById("activeVoiceName");

            if (!voiceSelect) return;
            voiceSelect.innerHTML = "";

            if (this.voices.length === 0) {
                const opt = document.createElement("option");
                opt.textContent = "Default Browser Voice";
                voiceSelect.appendChild(opt);
                return;
            }

            // Prefer English voices or high quality voices first
            const sortedVoices = [...this.voices].sort((a, b) => {
                const aEn = a.lang.startsWith("en");
                const bEn = b.lang.startsWith("en");
                if (aEn && !bEn) return -1;
                if (!aEn && bEn) return 1;
                return a.name.localeCompare(b.name);
            });

            sortedVoices.forEach((voice, i) => {
                const opt = document.createElement("option");
                opt.value = voice.name;
                // Add friendly persona tag
                let tag = "Neutral";
                const lower = voice.name.toLowerCase();
                if (lower.includes("female") || lower.includes("zira") || lower.includes("samantha") || lower.includes("victoria")) {
                    tag = "Female";
                } else if (lower.includes("male") || lower.includes("david") || lower.includes("george") || lower.includes("alex")) {
                    tag = "Male";
                } else if (lower.includes("google") || lower.includes("natural") || lower.includes("online")) {
                    tag = "Studio HD";
                }
                opt.textContent = `${voice.name} (${voice.lang}) [${tag}]`;
                voiceSelect.appendChild(opt);

                // Default pick: Google US English, Natural, or first English voice
                if (!this.selectedVoice && (lower.includes("natural") || lower.includes("google us") || lower.includes("zira") || lower.includes("samantha") || (voice.lang === "en-US" && i < 3))) {
                    this.selectedVoice = voice;
                    opt.selected = true;
                }
            });

            if (!this.selectedVoice && this.voices.length > 0) {
                this.selectedVoice = this.voices[0];
            }

            if (activeVoiceLabel && this.selectedVoice) {
                activeVoiceLabel.textContent = this.selectedVoice.name.split(" ")[0] + " Voice";
            }
        };

        populate();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = populate;
        }
    }

    setVoice(voiceName) {
        const found = this.voices.find(v => v.name === voiceName);
        if (found) {
            this.selectedVoice = found;
            const activeVoiceLabel = document.getElementById("activeVoiceName");
            if (activeVoiceLabel) {
                activeVoiceLabel.textContent = found.name.split(" ")[0] + " Voice";
            }
        }
    }

    speak(text, onWordCallback) {
        if (this.isMuted || !this.synth) return;

        // Stop existing speech
        this.synth.cancel();

        // Clean markdown tags for natural speech flow
        const cleanText = text
            .replace(/```[\s\S]*?```/g, "Code block omitted.")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/[*#_~>]/g, "")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.pitch = this.pitch;
        utterance.rate = this.rate;

        utterance.onstart = () => {
            if (this.onSpeechStart) this.onSpeechStart();
            const meter = document.querySelector(".voice-wave-meter");
            if (meter) meter.classList.add("speaking");
        };

        // Word-level event listener for CapCut dynamic kinetic subtitles
        utterance.onboundary = (event) => {
            if (event.name === "word") {
                const spokenWord = cleanText.substring(event.charIndex, event.charIndex + event.charLength).trim();
                if (spokenWord && onWordCallback) {
                    onWordCallback(spokenWord);
                }
                if (spokenWord && this.onWordSpoken) {
                    this.onWordSpoken(spokenWord);
                }
            }
        };

        utterance.onend = () => {
            if (this.onSpeechEnd) this.onSpeechEnd();
            const meter = document.querySelector(".voice-wave-meter");
            if (meter) meter.classList.remove("speaking");
        };

        utterance.onerror = (e) => {
            console.error("SpeechSynthesis error:", e);
            if (this.onSpeechEnd) this.onSpeechEnd();
            const meter = document.querySelector(".voice-wave-meter");
            if (meter) meter.classList.remove("speaking");
        };

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    }

    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
        }
        if (this.onSpeechEnd) this.onSpeechEnd();
        const meter = document.querySelector(".voice-wave-meter");
        if (meter) meter.classList.remove("speaking");
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopSpeaking();
        }
        return this.isMuted;
    }

    /* --------------------------------------------------------------------------
       2. WEB AUDIO API - SYNTHESIZED BACKGROUND AMBIENCE
       Generates soothing procedural background audio without external audio files!
       -------------------------------------------------------------------------- */
    getAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    startBackgroundAmbiance(type = 'lofi') {
        const ctx = this.getAudioContext();
        this.stopBackgroundAmbiance();

        this.bgmType = type;
        if (type === 'off') {
            this.isBgmPlaying = false;
            return;
        }

        // Master Gain for Background Music
        this.bgmGainNode = ctx.createGain();
        this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, ctx.currentTime);
        this.bgmGainNode.connect(ctx.destination);

        if (type === 'lofi') {
            // Warm Lo-Fi Chords Drone (Ebmaj7 / Cmin9 harmonic progression)
            const freqs = [155.56, 196.00, 233.08, 293.66, 311.13]; // Eb, G, Bb, D, Eb
            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();

                osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                // Gentle detune for vintage analog warmth
                osc.detune.setValueAtTime((idx - 2) * 6, ctx.currentTime);

                // Lowpass filter for cozy lo-fi character
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(420 + (idx * 60), ctx.currentTime);

                // Slow subtle volume swell
                gain.gain.setValueAtTime(0.08 / freqs.length, ctx.currentTime);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGainNode);

                osc.start();
                this.activeNodes.push(osc, filter, gain);
            });
        } 
        else if (type === 'space') {
            // Deep Cosmic Drone (Sub-bass and ethereal high shimmer)
            const baseFreqs = [55.0, 110.0, 164.81]; // A1, A2, E3
            baseFreqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(220, ctx.currentTime);
                filter.Q.setValueAtTime(3.0, ctx.currentTime);

                gain.gain.setValueAtTime(0.05, ctx.currentTime);

                // LFO modulation for cosmic pulsation
                const lfo = ctx.createOscillator();
                lfo.frequency.setValueAtTime(0.12 + (idx * 0.05), ctx.currentTime);
                const lfoGain = ctx.createGain();
                lfoGain.gain.setValueAtTime(60, ctx.currentTime);
                lfo.connect(lfoGain);
                lfoGain.connect(filter.frequency);
                lfo.start();

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGainNode);

                osc.start();
                this.activeNodes.push(osc, filter, gain, lfo, lfoGain);
            });
        }
        else if (type === 'rain') {
            // Procedural Rainfall / Ambient Breeze using filtered pink-like noise
            const bufferSize = ctx.sampleRate * 2;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                output[i] = (b0 + b1 + b2) * 0.18;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const rainFilter = ctx.createBiquadFilter();
            rainFilter.type = 'bandpass';
            rainFilter.frequency.setValueAtTime(950, ctx.currentTime);
            rainFilter.Q.setValueAtTime(0.8, ctx.currentTime);

            const rainGain = ctx.createGain();
            rainGain.gain.setValueAtTime(0.18, ctx.currentTime);

            whiteNoise.connect(rainFilter);
            rainFilter.connect(rainGain);
            rainGain.connect(this.bgmGainNode);

            whiteNoise.start();
            this.activeNodes.push(whiteNoise, rainFilter, rainGain);
        }

        this.isBgmPlaying = true;
    }

    stopBackgroundAmbiance() {
        this.activeNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
        this.activeNodes = [];
        this.isBgmPlaying = false;
    }

    setBgmVolume(val) {
        this.bgmVolume = parseFloat(val);
        if (this.bgmGainNode && this.audioCtx) {
            this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.audioCtx.currentTime);
        }
    }

    /* --------------------------------------------------------------------------
       3. SPEECH-TO-TEXT (MICROPHONE STT)
       -------------------------------------------------------------------------- */
    initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.warn("SpeechRecognition not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        const micBtn = document.getElementById("micBtn");
        const msgInput = document.getElementById("messageInput");

        this.recognition.onstart = () => {
            this.isRecording = true;
            if (micBtn) {
                micBtn.classList.add("recording");
                micBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            }
        };

        this.recognition.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (msgInput) {
                msgInput.value = transcript;
            }
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            if (micBtn) {
                micBtn.classList.remove("recording");
                micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }
        };

        this.recognition.onerror = (e) => {
            console.error("Speech recognition error:", e);
            this.isRecording = false;
            if (micBtn) {
                micBtn.classList.remove("recording");
                micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }
        };
    }

    toggleRecording() {
        if (!this.recognition) {
            alert("Speech recognition is not supported by your browser (use Chrome/Edge).");
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
}

// Global instance
window.JenAudio = new AudioEngine();
