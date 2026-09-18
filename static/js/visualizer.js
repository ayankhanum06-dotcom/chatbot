/* ==========================================================================
   JEN AI - VISUALIZER & CAPCUT KINETIC ANIMATION ENGINE
   Features:
   1. Dynamic Colorful Particle Canvas Background (Cyberpunk, Aurora, Synthwave, Ocean)
   2. Cybernetic Animated Avatar Core (Canvas-rendered reactive AI orb)
   3. CapCut "Move Up" Kinetic Typography Subtitle Engine
   ========================================================================== */

class VisualizerEngine {
    constructor() {
        // Particles
        this.particleCanvas = document.getElementById("particleCanvas");
        this.pCtx = this.particleCanvas ? this.particleCanvas.getContext("2d") : null;
        this.particles = [];
        this.numParticles = 45;

        // Avatar Core
        this.avatarCanvas = document.getElementById("avatarCanvas");
        this.aCtx = this.avatarCanvas ? this.avatarCanvas.getContext("2d") : null;
        this.avatarState = "idle"; // 'idle' | 'listening' | 'thinking' | 'speaking'
        this.wavePhase = 0;
        this.avatarEnergy = 0.2;

        // CapCut Kinetic Subtitles
        this.capcutBox = document.getElementById("capcutBox");
        this.currentEffect = "move-up"; // 'move-up' | 'bounce-up' | 'karaoke-rise'
        this.wordQueue = [];
        this.activeWords = [];
        this.maxVisibleWords = 10;
        this.captionsEnabled = true;

        this.init();
    }

    init() {
        this.resizeCanvases();
        window.addEventListener("resize", () => this.resizeCanvases());

        this.initParticles();
        this.animate();
    }

    resizeCanvases() {
        if (this.particleCanvas) {
            this.particleCanvas.width = window.innerWidth;
            this.particleCanvas.height = window.innerHeight;
        }

        if (this.avatarCanvas) {
            const rect = this.avatarCanvas.parentElement.getBoundingClientRect();
            this.avatarCanvas.width = rect.width * (window.devicePixelRatio || 1);
            this.avatarCanvas.height = rect.height * (window.devicePixelRatio || 1);
        }
    }

    /* --------------------------------------------------------------------------
       1. COLORFUL DYNAMIC PARTICLE BACKGROUND
       -------------------------------------------------------------------------- */
    getThemeColors() {
        const theme = document.body.getAttribute("data-theme") || "cyberpunk";
        switch (theme) {
            case "aurora":
                return ["#00ffaa", "#18b5ff", "#b026ff"];
            case "synthwave":
                return ["#ff5e36", "#ff2a8d", "#ffb703"];
            case "ocean":
                return ["#00d2ff", "#3a7bd5", "#00f2fe"];
            case "cyberpunk":
            default:
                return ["#ff007f", "#00f0ff", "#8a2be2"];
        }
    }

    initParticles() {
        this.particles = [];
        const colors = this.getThemeColors();
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                radius: Math.random() * 2.5 + 1,
                vx: (Math.random() - 0.5) * 0.7,
                vy: (Math.random() - 0.5) * 0.7,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.6 + 0.2
            });
        }
    }

    drawParticles() {
        if (!this.pCtx) return;
        const w = this.particleCanvas.width;
        const h = this.particleCanvas.height;

        this.pCtx.clearRect(0, 0, w, h);

        const colors = this.getThemeColors();

        // Connect nearby particles with subtle glowing lines
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];

            p1.x += p1.vx;
            p1.y += p1.vy;

            if (p1.x < 0) p1.x = w;
            if (p1.x > w) p1.x = 0;
            if (p1.y < 0) p1.y = h;
            if (p1.y > h) p1.y = 0;

            this.pCtx.beginPath();
            this.pCtx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
            this.pCtx.fillStyle = p1.color;
            this.pCtx.globalAlpha = p1.alpha;
            this.pCtx.fill();

            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 120) {
                    this.pCtx.beginPath();
                    this.pCtx.moveTo(p1.x, p1.y);
                    this.pCtx.lineTo(p2.x, p2.y);
                    this.pCtx.strokeStyle = colors[0];
                    this.pCtx.globalAlpha = (1 - dist / 120) * 0.2;
                    this.pCtx.lineWidth = 0.8;
                    this.pCtx.stroke();
                }
            }
        }
        this.pCtx.globalAlpha = 1.0;
    }

    /* --------------------------------------------------------------------------
       2. CYBERNETIC ANIMATED AVATAR CORE
       -------------------------------------------------------------------------- */
    drawAvatarCore() {
        if (!this.aCtx) return;
        const w = this.avatarCanvas.width;
        const h = this.avatarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const baseR = Math.min(w, h) * 0.32;

        this.aCtx.clearRect(0, 0, w, h);
        this.wavePhase += 0.04;

        // Smooth energy interpolation
        let targetEnergy = 0.15;
        if (this.avatarState === "speaking") targetEnergy = 0.85;
        else if (this.avatarState === "thinking") targetEnergy = 0.6;
        else if (this.avatarState === "listening") targetEnergy = 0.45;

        this.avatarEnergy += (targetEnergy - this.avatarEnergy) * 0.1;

        const colors = this.getThemeColors();

        // 1. Radial Core Glow
        const grad = this.aCtx.createRadialGradient(cx, cy, 5, cx, cy, baseR * 1.4);
        grad.addColorStop(0, colors[1]);
        grad.addColorStop(0.5, colors[0]);
        grad.addColorStop(1, "transparent");

        this.aCtx.fillStyle = grad;
        this.aCtx.globalAlpha = 0.35 + Math.sin(this.wavePhase * 2) * 0.15 * this.avatarEnergy;
        this.aCtx.beginPath();
        this.aCtx.arc(cx, cy, baseR * (1.1 + this.avatarEnergy * 0.2), 0, Math.PI * 2);
        this.aCtx.fill();
        this.aCtx.globalAlpha = 1.0;

        // 2. Multi-Sine Reactive Wave Ring
        const numPoints = 80;
        const numLayers = 3;

        for (let l = 0; l < numLayers; l++) {
            this.aCtx.beginPath();
            const layerColor = colors[l % colors.length];
            const speed = (l + 1) * 0.8;

            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                // Harmonic frequency variation
                const freq1 = Math.sin(angle * 6 + this.wavePhase * speed);
                const freq2 = Math.cos(angle * 12 - this.wavePhase * 1.5);
                const mod = (freq1 + freq2 * 0.5) * (18 * this.avatarEnergy);
                const r = baseR + mod + (l * 4);

                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;

                if (i === 0) this.aCtx.moveTo(x, y);
                else this.aCtx.lineTo(x, y);
            }

            this.aCtx.closePath();
            this.aCtx.strokeStyle = layerColor;
            this.aCtx.lineWidth = 2.2 - l * 0.4;
            this.aCtx.shadowColor = layerColor;
            this.aCtx.shadowBlur = 12 * this.avatarEnergy;
            this.aCtx.stroke();
            this.aCtx.shadowBlur = 0;
        }

        // 3. Central Pulsing Hologram Core
        const corePulse = Math.sin(this.wavePhase * 3) * (6 * this.avatarEnergy);
        this.aCtx.beginPath();
        this.aCtx.arc(cx, cy, (baseR * 0.45) + corePulse, 0, Math.PI * 2);
        this.aCtx.fillStyle = colors[1];
        this.aCtx.globalAlpha = 0.85;
        this.aCtx.shadowColor = colors[1];
        this.aCtx.shadowBlur = 20;
        this.aCtx.fill();
        this.aCtx.shadowBlur = 0;
        this.aCtx.globalAlpha = 1.0;

        // Draw inner high-tech aperture geometric marks
        this.aCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        this.aCtx.lineWidth = 1.5;
        for (let a = 0; a < 4; a++) {
            const ang = (this.wavePhase * 0.5) + (a * Math.PI / 2);
            const x1 = cx + Math.cos(ang) * (baseR * 0.2);
            const y1 = cy + Math.sin(ang) * (baseR * 0.2);
            const x2 = cx + Math.cos(ang) * (baseR * 0.4);
            const y2 = cy + Math.sin(ang) * (baseR * 0.4);

            this.aCtx.beginPath();
            this.aCtx.moveTo(x1, y1);
            this.aCtx.lineTo(x2, y2);
            this.aCtx.stroke();
        }
    }

    setAvatarState(state) {
        this.avatarState = state;
        const label = document.getElementById("aiStateLabel");
        const liveDot = document.querySelector(".live-dot");

        if (label) {
            switch (state) {
                case "speaking":
                    label.textContent = "Jen AI Speaking";
                    if (liveDot) liveDot.className = "live-dot speaking";
                    break;
                case "thinking":
                    label.textContent = "Groq LPU Processing...";
                    if (liveDot) liveDot.className = "live-dot pulse";
                    break;
                case "listening":
                    label.textContent = "Listening to You...";
                    if (liveDot) liveDot.className = "live-dot pulse";
                    break;
                default:
                    label.textContent = "AI Ready";
                    if (liveDot) liveDot.className = "live-dot";
            }
        }
    }

    /* --------------------------------------------------------------------------
       3. CAPCUT "MOVE UP" KINETIC SUBTITLES ENGINE
       Words dynamically rise and pop up into the caption box in sync with AI!
       -------------------------------------------------------------------------- */
    feedCapcutWord(word) {
        if (!this.captionsEnabled || !this.capcutBox) return;

        // Clear placeholder if present
        const placeholder = this.capcutBox.querySelector(".capcut-placeholder");
        if (placeholder) {
            this.capcutBox.innerHTML = "";
        }

        // Limit maximum visible words in container
        while (this.capcutBox.children.length >= this.maxVisibleWords) {
            this.capcutBox.removeChild(this.capcutBox.firstElementChild);
        }

        const span = document.createElement("span");
        span.className = "capcut-word";
        span.textContent = word;

        // Apply selected CapCut style
        if (this.currentEffect === "bounce-up") {
            span.classList.add("fx-bounce-up");
        } else if (this.currentEffect === "karaoke-rise") {
            span.classList.add("fx-karaoke-rise");
        } else {
            // Default: Move-Up with glowing highlight
            span.classList.add("active-glow");
        }

        this.capcutBox.appendChild(span);

        // Transition glow to normal after animation completes
        setTimeout(() => {
            span.classList.remove("active-glow");
        }, 800);
    }

    clearCapcutCaptions() {
        if (this.capcutBox) {
            this.capcutBox.innerHTML = '<span class="capcut-placeholder">Jen AI is ready to speak with you...</span>';
        }
    }

    setCapcutEffect(effectName) {
        this.currentEffect = effectName;
    }

    setCaptionsEnabled(enabled) {
        this.captionsEnabled = enabled;
        const stage = document.getElementById("capcutCaptionStage");
        if (stage) {
            stage.style.display = enabled ? "flex" : "none";
        }
    }

    /* --------------------------------------------------------------------------
       MAIN ANIMATION LOOP
       -------------------------------------------------------------------------- */
    animate() {
        this.drawParticles();
        this.drawAvatarCore();
        requestAnimationFrame(() => this.animate());
    }
}

// Global instance
window.JenVisualizer = new VisualizerEngine();
