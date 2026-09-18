/* ==========================================================================
   JEN AI - APPLICATION ORCHESTRATION & CHAT ENGINE
   Features:
   - Groq API SSE streaming integration
   - CapCut Move-Up kinetic text feed synchronization
   - Voice and background audio integration
   - Theme switcher & settings management
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const messagesContainer = document.getElementById("messagesContainer");
    const modelSelect = document.getElementById("modelSelect");
    const quickPromptsRow = document.getElementById("quickPromptsRow");
    const micBtn = document.getElementById("micBtn");

    // Theme & Dropdowns
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeMenu = document.getElementById("themeMenu");
    const capcutToggleBtn = document.getElementById("capcutToggleBtn");
    const capcutMenu = document.getElementById("capcutMenu");
    const audioMenuBtn = document.getElementById("audioMenuBtn");
    const audioMenu = document.getElementById("audioMenu");

    // Settings Modal
    const openSettingsBtn = document.getElementById("openSettingsBtn");
    const settingsModal = document.getElementById("settingsModal");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const closeSettingsBtn2 = document.getElementById("closeSettingsBtn2");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveKeyBtn = document.getElementById("saveKeyBtn");
    const keySaveResult = document.getElementById("keySaveResult");
    const keyStatusBadge = document.getElementById("keyStatusBadge");
    const clearChatBtn = document.getElementById("clearChatBtn");

    // Audio & Voice Controls
    const voiceSelect = document.getElementById("voiceSelect");
    const pitchSlider = document.getElementById("pitchSlider");
    const pitchVal = document.getElementById("pitchVal");
    const rateSlider = document.getElementById("rateSlider");
    const rateVal = document.getElementById("rateVal");
    const bgmSelect = document.getElementById("bgmSelect");
    const bgmVolSlider = document.getElementById("bgmVolSlider");
    const bgmVolVal = document.getElementById("bgmVolVal");
    const toggleBgmBtn = document.getElementById("toggleBgmBtn");
    const muteAudioBtn = document.getElementById("muteAudioBtn");

    // CapCut Controls
    const toggleCaptions = document.getElementById("toggleCaptions");
    const kineticFxToggle = document.getElementById("kineticFxToggle");
    const fxSpeedSlider = document.getElementById("fxSpeedSlider");
    const fxSpeedVal = document.getElementById("fxSpeedVal");

    // State
    let chatHistory = [];
    let isStreaming = false;

    /* --------------------------------------------------------------------------
       1. INITIALIZATION & STATUS CHECK
       -------------------------------------------------------------------------- */
    function checkBackendStatus() {
        fetch("/api/status")
            .then(res => res.json())
            .then(data => {
                if (data.has_api_key) {
                    keyStatusBadge.className = "status-indicator-dot active";
                    keyStatusBadge.title = "Groq API Key Active (" + data.masked_key + ")";
                    if (apiKeyInput) apiKeyInput.placeholder = data.masked_key;
                } else {
                    keyStatusBadge.className = "status-indicator-dot warning";
                    keyStatusBadge.title = "Groq API Key Missing - Click to Set";
                    showToast("⚠️ Groq API key is not set in .env. Click Settings (gear icon) to add it!", 6000);
                }
            })
            .catch(err => {
                console.warn("Backend status check error:", err);
                keyStatusBadge.className = "status-indicator-dot warning";
            });
    }

    checkBackendStatus();

    // Hook audio engine with visualizer
    if (window.JenAudio) {
        window.JenAudio.onSpeechStart = () => {
            if (window.JenVisualizer) window.JenVisualizer.setAvatarState("speaking");
        };
        window.JenAudio.onSpeechEnd = () => {
            if (window.JenVisualizer) window.JenVisualizer.setAvatarState("idle");
        };
        window.JenAudio.onWordSpoken = (word) => {
            if (window.JenVisualizer) window.JenVisualizer.feedCapcutWord(word);
        };
    }

    /* --------------------------------------------------------------------------
       2. CHAT SUBMISSION & STREAMING
       -------------------------------------------------------------------------- */
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage();
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-grow textarea
    messageInput.addEventListener("input", () => {
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
    });

    // Quick prompt chips
    if (quickPromptsRow) {
        quickPromptsRow.addEventListener("click", (e) => {
            const btn = e.target.closest(".chip-btn");
            if (btn) {
                const prompt = btn.getAttribute("data-prompt");
                messageInput.value = prompt;
                messageInput.focus();
                sendMessage();
            }
        });
    }

    function appendMessageCard(sender, text = "", isMoveUp = true) {
        const card = document.createElement("div");
        card.className = `message-card ${sender === "user" ? "user-card" : "bot-card"}`;
        if (isMoveUp) {
            card.classList.add("move-up");
        }

        const avatarIcon = sender === "user" ? "fa-solid fa-user-astronaut" : "fa-solid fa-wand-magic-sparkles";
        const senderLabel = sender === "user" ? "You" : "JEN AI";

        card.innerHTML = `
            <div class="avatar-badge">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="card-content">
                <div class="card-meta">
                    <span class="sender-name">${senderLabel}</span>
                    <span class="time-stamp">Now</span>
                </div>
                <div class="card-body markdown-body">
                    ${renderMarkdown(text)}
                </div>
                <div class="card-actions">
                    <button class="action-btn speak-msg-btn" title="Read Aloud">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <button class="action-btn copy-msg-btn" title="Copy Message">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>
        `;

        // Action button events
        card.querySelector(".speak-msg-btn").addEventListener("click", () => {
            const bodyText = card.querySelector(".card-body").innerText;
            if (window.JenAudio) {
                window.JenAudio.speak(bodyText, (w) => {
                    if (window.JenVisualizer) window.JenVisualizer.feedCapcutWord(w);
                });
            }
        });

        card.querySelector(".copy-msg-btn").addEventListener("click", () => {
            const bodyText = card.querySelector(".card-body").innerText;
            navigator.clipboard.writeText(bodyText).then(() => {
                showToast("Copied to clipboard!");
            });
        });

        messagesContainer.appendChild(card);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return card;
    }

    function renderMarkdown(text) {
        if (!text) return "";
        if (window.marked) {
            return marked.parse(text);
        }
        return text.replace(/\n/g, "<br>");
    }

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || isStreaming) return;

        // Reset input
        messageInput.value = "";
        messageInput.style.height = "auto";

        // Append User Message with CapCut Move-Up
        appendMessageCard("user", text, true);
        chatHistory.push({ role: "user", content: text });

        // Update UI State to Thinking
        isStreaming = true;
        sendBtn.disabled = true;
        if (window.JenVisualizer) {
            window.JenVisualizer.setAvatarState("thinking");
            window.JenVisualizer.clearCapcutCaptions();
        }

        // Create Bot Streaming Message Card
        const botCard = appendMessageCard("bot", "", true);
        const cardBody = botCard.querySelector(".card-body");
        cardBody.innerHTML = `
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;

        let accumulatedResponse = "";
        let wordBuffer = "";

        const payload = {
            message: text,
            history: chatHistory.slice(-8),
            model: modelSelect.value,
            stream: true,
            system_prompt: document.getElementById("systemPromptInput") ? document.getElementById("systemPromptInput").value : ""
        };

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error || `HTTP ${response.status}: ${response.statusText}`;
                cardBody.innerHTML = `<p style="color:#ff5b5b;">⚠️ <strong>Error:</strong> ${errMsg}</p>`;
                if (errData.tip) {
                    cardBody.innerHTML += `<p class="small-tip" style="color:#ffaa00;">${errData.tip}</p>`;
                }
                if (window.JenVisualizer) window.JenVisualizer.setAvatarState("idle");
                isStreaming = false;
                sendBtn.disabled = false;
                return;
            }

            // Stream Reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let firstChunk = true;

            if (window.JenVisualizer) window.JenVisualizer.setAvatarState("speaking");

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(trimmed.slice(6));
                                if (data.content) {
                                    if (firstChunk) {
                                        cardBody.innerHTML = "";
                                        firstChunk = false;
                                    }
                                    accumulatedResponse += data.content;
                                    wordBuffer += data.content;

                                    cardBody.innerHTML = renderMarkdown(accumulatedResponse);
                                    messagesContainer.scrollTop = messagesContainer.scrollHeight;

                                    // Check for word boundary and trigger CapCut Move-Up
                                    if (/\s/.test(wordBuffer)) {
                                        const words = wordBuffer.trim().split(/\s+/);
                                        if (words.length > 1) {
                                            const wordToAnimate = words.shift();
                                            if (window.JenVisualizer) {
                                                window.JenVisualizer.feedCapcutWord(wordToAnimate);
                                            }
                                            wordBuffer = words.join(" ");
                                        }
                                    }
                                } else if (data.error) {
                                    cardBody.innerHTML += `<p style="color:#ff5b5b;">${data.error}</p>`;
                                }
                            } catch (e) {
                                // Partial JSON, ignore
                            }
                        }
                    }
                }
            }

            // Process any remaining word in buffer
            if (wordBuffer.trim() && window.JenVisualizer) {
                window.JenVisualizer.feedCapcutWord(wordBuffer.trim());
            }

            chatHistory.push({ role: "assistant", content: accumulatedResponse });

            // Trigger natural Speech Synthesis for completed response
            if (window.JenAudio && !window.JenAudio.isMuted) {
                window.JenAudio.speak(accumulatedResponse, (word) => {
                    if (window.JenVisualizer) window.JenVisualizer.feedCapcutWord(word);
                });
            } else {
                if (window.JenVisualizer) window.JenVisualizer.setAvatarState("idle");
            }

        } catch (err) {
            console.error("Chat error:", err);
            cardBody.innerHTML = `<p style="color:#ff5b5b;">Connection Error: ${err.message}</p>`;
            if (window.JenVisualizer) window.JenVisualizer.setAvatarState("idle");
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
        }
    }

    /* --------------------------------------------------------------------------
       3. COLORFUL BACKGROUND THEME SWITCHER
       -------------------------------------------------------------------------- */
    themeToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle("hidden");
        capcutMenu.classList.add("hidden");
        audioMenu.classList.add("hidden");
    });

    document.querySelectorAll(".theme-opt").forEach(btn => {
        btn.addEventListener("click", () => {
            const theme = btn.getAttribute("data-theme");
            document.body.setAttribute("data-theme", theme);
            document.querySelectorAll(".theme-opt").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            themeMenu.classList.add("hidden");

            // Re-initialize particles with new theme colors
            if (window.JenVisualizer) {
                window.JenVisualizer.initParticles();
            }
            showToast(`Theme switched to ${btn.textContent.trim()}!`);
        });
    });

    /* --------------------------------------------------------------------------
       4. CAPCUT KINETIC MOTION SWITCHER
       -------------------------------------------------------------------------- */
    capcutToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        capcutMenu.classList.toggle("hidden");
        themeMenu.classList.add("hidden");
        audioMenu.classList.add("hidden");
    });

    document.querySelectorAll(".fx-opt").forEach(btn => {
        btn.addEventListener("click", () => {
            const effect = btn.getAttribute("data-effect");
            if (window.JenVisualizer) {
                window.JenVisualizer.setCapcutEffect(effect);
            }
            document.querySelectorAll(".fx-opt").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            capcutMenu.classList.add("hidden");
            showToast(`CapCut effect set to: ${btn.textContent.trim()}`);
        });
    });

    toggleCaptions.addEventListener("change", (e) => {
        if (window.JenVisualizer) {
            window.JenVisualizer.setCaptionsEnabled(e.target.checked);
        }
    });

    kineticFxToggle.addEventListener("click", () => {
        kineticFxToggle.classList.toggle("active");
        const active = kineticFxToggle.classList.contains("active");
        if (window.JenVisualizer) {
            window.JenVisualizer.setCaptionsEnabled(active);
            toggleCaptions.checked = active;
        }
        showToast(active ? "CapCut Move Up Active" : "Captions Disabled");
    });

    if (fxSpeedSlider) {
        fxSpeedSlider.addEventListener("input", (e) => {
            const val = e.target.value;
            fxSpeedVal.textContent = val + "s";
            document.documentElement.style.setProperty("--capcut-duration", val + "s");
        });
    }

    /* --------------------------------------------------------------------------
       5. AUDIO & BACKGROUND AMBIENCE CONTROLS
       -------------------------------------------------------------------------- */
    audioMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        audioMenu.classList.toggle("hidden");
        themeMenu.classList.add("hidden");
        capcutMenu.classList.add("hidden");
    });

    if (voiceSelect) {
        voiceSelect.addEventListener("change", (e) => {
            if (window.JenAudio) window.JenAudio.setVoice(e.target.value);
        });
    }

    if (pitchSlider) {
        pitchSlider.addEventListener("input", (e) => {
            pitchVal.textContent = e.target.value;
            if (window.JenAudio) window.JenAudio.pitch = parseFloat(e.target.value);
        });
    }

    if (rateSlider) {
        rateSlider.addEventListener("input", (e) => {
            rateVal.textContent = e.target.value;
            if (window.JenAudio) window.JenAudio.rate = parseFloat(e.target.value);
        });
    }

    if (bgmVolSlider) {
        bgmVolSlider.addEventListener("input", (e) => {
            const pct = Math.round(e.target.value * 100) + "%";
            bgmVolVal.textContent = pct;
            if (window.JenAudio) window.JenAudio.setBgmVolume(e.target.value);
        });
    }

    if (toggleBgmBtn) {
        toggleBgmBtn.addEventListener("click", () => {
            if (!window.JenAudio) return;
            const currentBgm = bgmSelect.value;
            if (window.JenAudio.isBgmPlaying) {
                window.JenAudio.stopBackgroundAmbiance();
                toggleBgmBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Background Audio';
                showToast("Background audio stopped");
            } else {
                window.JenAudio.startBackgroundAmbiance(currentBgm);
                toggleBgmBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Stop Background Audio';
                showToast(`Playing ${currentBgm} ambient soundscape in background!`);
            }
        });
    }

    if (bgmSelect) {
        bgmSelect.addEventListener("change", (e) => {
            if (window.JenAudio && window.JenAudio.isBgmPlaying) {
                window.JenAudio.startBackgroundAmbiance(e.target.value);
                showToast(`Soundscape changed to ${e.target.value}`);
            }
        });
    }

    if (muteAudioBtn) {
        muteAudioBtn.addEventListener("click", () => {
            if (!window.JenAudio) return;
            const isMuted = window.JenAudio.toggleMute();
            muteAudioBtn.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
            showToast(isMuted ? "Speech synthesis muted" : "Speech synthesis enabled");
        });
    }

    if (micBtn) {
        micBtn.addEventListener("click", () => {
            if (window.JenAudio) {
                window.JenAudio.toggleRecording();
                if (window.JenVisualizer) {
                    window.JenVisualizer.setAvatarState(window.JenAudio.isRecording ? "listening" : "idle");
                }
            }
        });
    }

    // Close menus on outside click
    document.addEventListener("click", () => {
        themeMenu.classList.add("hidden");
        capcutMenu.classList.add("hidden");
        audioMenu.classList.add("hidden");
    });

    /* --------------------------------------------------------------------------
       6. SETTINGS & .ENV API KEY MODAL
       -------------------------------------------------------------------------- */
    openSettingsBtn.addEventListener("click", () => {
        settingsModal.classList.remove("hidden");
        keySaveResult.className = "notice-box hidden";
    });

    const closeSettings = () => settingsModal.classList.add("hidden");
    closeSettingsBtn.addEventListener("click", closeSettings);
    closeSettingsBtn2.addEventListener("click", closeSettings);

    saveKeyBtn.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            keySaveResult.textContent = "Please enter an API key.";
            keySaveResult.className = "notice-box error";
            return;
        }

        saveKeyBtn.disabled = true;
        saveKeyBtn.textContent = "Saving...";

        fetch("/api/save-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                keySaveResult.textContent = "✓ Key saved successfully into .env file!";
                keySaveResult.className = "notice-box success";
                keyStatusBadge.className = "status-indicator-dot active";
                keyStatusBadge.title = "Groq API Key Configured";
                showToast("Groq API key updated!");
            } else {
                keySaveResult.textContent = data.error || "Failed to save key.";
                keySaveResult.className = "notice-box error";
            }
        })
        .catch(err => {
            keySaveResult.textContent = "Error saving key: " + err.message;
            keySaveResult.className = "notice-box error";
        })
        .finally(() => {
            saveKeyBtn.disabled = false;
            saveKeyBtn.textContent = "Save to .env";
        });
    });

    clearChatBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear chat history?")) {
            chatHistory = [];
            messagesContainer.innerHTML = "";
            appendMessageCard("bot", "Chat history cleared. How can I assist you next?", true);
            closeSettings();
            showToast("Chat history cleared");
        }
    });

    /* --------------------------------------------------------------------------
       7. TOAST NOTIFICATIONS
       -------------------------------------------------------------------------- */
    function showToast(message, duration = 3000) {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(100px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
});
