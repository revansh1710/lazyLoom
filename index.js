// --- Core Continuous Math ---
function smoothNoise(t) { return (Math.sin(t) + Math.sin(t * 1.37) + Math.sin(t * 2.13)) / 3; }
function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }
function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// --- The Unseen (Phantom Nodes) ---
class PhantomNode {
    constructor() {
        this.x = 400;
        this.y = 300;
        this.warmth = 0;
        this.seedX = Math.random() * 100;
        this.seedY = Math.random() * 100;
    }
    update(t) {
        const targetX = 400 + Math.sin(t * 0.02 + this.seedX) * 350;
        const targetY = 300 + Math.cos(t * 0.015 + this.seedY) * 200;

        this.x = lerp(this.x, targetX, 0.005);
        this.y = lerp(this.y, targetY, 0.005);

        // Warmth swells gently as it moves
        this.warmth = Math.pow((smoothNoise(t * 0.05) + 1) / 2, 2);
    }
}

// --- The Yielding Environment ---
class Mote {
    constructor(w, h) {
        this.x = Math.random() * w;
        this.y = h + Math.random() * 200;
        this.seed = Math.random() * 100;
        this.size = Math.random() * 2.5 + 1.5;
        this.baseSpeed = Math.random() * 0.3 + 0.1;
    }
    update(t, loomX, loomY, phantoms) {
        const dLoom = Math.sqrt(Math.pow(this.x - loomX, 2) + Math.pow(this.y - loomY, 2));
        let comfortMultiplier = smoothstep(0, 300, dLoom);

        let phantomPullX = 0;
        phantoms.forEach(p => {
            const dPhantom = Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
            if (dPhantom < 150) {
                comfortMultiplier *= 0.5;
                phantomPullX += (p.x - this.x) * 0.001 * p.warmth;
            }
        });

        const currentSpeed = this.baseSpeed * (0.1 + 0.9 * comfortMultiplier);

        this.y -= currentSpeed;
        this.x += Math.sin(t * 0.5 + this.seed) * 0.3 + phantomPullX;

        if (this.y < -50) {
            this.y = 650;
            this.x = Math.random() * 800;
        }
    }
    draw(ctx, presence) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 230, 200, ${0.1 + presence * 0.4})`;
        ctx.fill();
    }
}

// --- The Character Engine ---
class LoomPresence {
    constructor() {
        this.canvas = document.getElementById('loom-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.time = 0;
        this.breathPhase = 0;
        this.lastFrameTime = performance.now();
        this.lastInteractionTime = performance.now();

        this.mouseX = 400;
        this.mouseY = 300;

        this.presence = 0;
        this.eyeOpenness = 0;
        this.gazeOffset = { x: 0, y: 0 };

        this.phantoms = [new PhantomNode(), new PhantomNode(), new PhantomNode()];
        this.motes = Array.from({ length: 50 }, () => new Mote(this.canvas.width, this.canvas.height));

        window.addEventListener('pointermove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.lastInteractionTime = performance.now();
        });

        requestAnimationFrame(this.loop.bind(this));
    }

    updateCharacter(deltaTime, idleDuration) {
        this.presence = lerp(this.presence, idleDuration > 5 ? 1.0 : 0.0, idleDuration > 5 ? 0.002 : 0.05);
        this.phantoms.forEach(p => p.update(this.time));

        // --- The Shared Breathing Field ---
        const rawDoubt = Math.pow(Math.max(0, smoothNoise(this.time * 0.3)), 2);
        const doubt = rawDoubt * (1 - this.presence * 0.8);
        let breathSpeed = lerp(1.5, 0.6, this.presence);

        const globalRhythmPhase = this.time * 0.65;
        const syncWindow = Math.pow(smoothNoise(this.time * 0.04), 4);

        if (syncWindow > 0.5) {
            const phaseDiff = Math.sin(globalRhythmPhase) - Math.sin(this.breathPhase);
            breathSpeed += phaseDiff * (syncWindow * 0.5);
        }

        this.breathPhase += deltaTime * breathSpeed * (1 - doubt * 0.9);

        // --- Emotional Recognition & The Continuous Attention Field ---
        const curiosity = Math.pow((Math.sin(this.time * 0.1) + Math.sin(this.time * 0.17)) * 0.5, 4);
        const stillnessSafety = smoothstep(8, 20, idleDuration);

        const awareness = curiosity * stillnessSafety * this.presence;
        this.eyeOpenness = lerp(this.eyeOpenness, Math.max(0, (awareness - 0.1) * 5), 0.02);

        if (this.eyeOpenness > 0.05) {
            // ZERO LOGIC GATES. Pure Barycentric Gravity.
            // The user always has a baseline gravitational pull of 1.0
            let totalWeight = 1.0;
            let weightedX = this.mouseX * 1.0;
            let weightedY = this.mouseY * 1.0;

            // Phantoms add their pull to the center of mass based purely on their warmth
            this.phantoms.forEach(p => {
                // Squaring the warmth and multiplying makes the pull exponential but smooth
                const phantomWeight = Math.pow(p.warmth, 2) * 2.5;
                weightedX += p.x * phantomWeight;
                weightedY += p.y * phantomWeight;
                totalWeight += phantomWeight;
            });

            // The final gaze is the continuous center of mass of the room
            const targetX = weightedX / totalWeight;
            const targetY = weightedY / totalWeight;

            const targetGazeX = (targetX - 300) * 0.03;
            const targetGazeY = (targetY - 350) * 0.03;
            const shyOffsetX = smoothNoise(this.time * 0.5) * 5;

            this.gazeOffset.x = lerp(this.gazeOffset.x, targetGazeX + shyOffsetX, 0.03);
            this.gazeOffset.y = lerp(this.gazeOffset.y, targetGazeY, 0.03);
        } else {
            this.gazeOffset.x = lerp(this.gazeOffset.x, 0, 0.02);
            this.gazeOffset.y = lerp(this.gazeOffset.y, 0, 0.02);
        }
    }

    render(geom) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // --- Background & Residual Warmth ---
        const bgR = lerp(12, 22, this.presence);
        const bgG = lerp(10, 16, this.presence);
        const bgB = lerp(12, 15, this.presence);

        this.ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
        this.ctx.fillRect(0, 0, w, h);

        // Draw Phantom Warmth (Subtle, large gradients in the void)
        this.ctx.globalCompositeOperation = "screen";
        this.phantoms.forEach(p => {
            if (p.warmth > 0.1) {
                const echoGrad = this.ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 250);
                echoGrad.addColorStop(0, `rgba(40, 25, 25, ${p.warmth * 0.15})`);
                echoGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
                this.ctx.fillStyle = echoGrad;
                this.ctx.fillRect(0, 0, w, h);
            }
        });
        this.ctx.globalCompositeOperation = "source-over";

        // Base Vignette
        const bgGrad = this.ctx.createRadialGradient(w / 2, h / 2 + 100, 100, w / 2, h / 2, 600);
        bgGrad.addColorStop(0, `rgba(0,0,0,0)`);
        bgGrad.addColorStop(1, `rgba(5, 4, 4, 0.9)`);
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, w, h);

        // Motes
        this.motes.forEach(m => {
            m.update(this.time, geom.headX, geom.backY, this.phantoms);
            m.draw(this.ctx, this.presence);
        });

        // Loom Shadow
        const shadowWidth = lerp(200, 350, this.presence);
        const shadowGrad = this.ctx.createRadialGradient(geom.headX + 50, 520, 10, geom.headX + 50, 520, shadowWidth);
        shadowGrad.addColorStop(0, `rgba(0,0,0,${lerp(0.4, 0.9, this.presence)})`);
        shadowGrad.addColorStop(1, `rgba(0,0,0,0)`);
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(0, 400, w, 200);

        // --- Draw Loom ---
        const lR = lerp(100, 140, this.presence);
        const lG = lerp(85, 105, this.presence);
        const lB = lerp(95, 110, this.presence);

        const bodyGrad = this.ctx.createRadialGradient(geom.headX, geom.headY, 20, geom.headX + 150, geom.backY, 350);
        bodyGrad.addColorStop(0, `rgb(${lR}, ${lG}, ${lB})`);
        bodyGrad.addColorStop(1, `rgb(${lR - 35}, ${lG - 25}, ${lB - 25})`);

        this.ctx.fillStyle = bodyGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(150, 520);
        this.ctx.quadraticCurveTo(geom.headX - 90, geom.backY + 30, geom.headX, geom.backY - 40);
        this.ctx.quadraticCurveTo(geom.headX + 200, geom.backY - 100, 600, geom.backY + 40);
        this.ctx.quadraticCurveTo(650, 520, 550, 520);
        this.ctx.fill();

        this.ctx.fillStyle = `rgb(${lR - 25}, ${lG - 20}, ${lB - 20})`;
        this.ctx.beginPath();
        this.ctx.moveTo(geom.headX + 10, geom.headY - 60);
        this.ctx.quadraticCurveTo(geom.headX - 70, geom.earY - 10, geom.headX - 90, geom.earY + 50);
        this.ctx.quadraticCurveTo(geom.headX - 50, geom.headY + 40, geom.headX - 10, geom.headY - 10);
        this.ctx.fill();

        // --- The Eye ---
        const eyeX = geom.headX - 25;
        const eyeY = geom.headY - 20;

        this.ctx.strokeStyle = `rgb(${lR - 55}, ${lG - 45}, ${lB - 45})`;
        this.ctx.lineWidth = 3;

        if (this.eyeOpenness < 0.02) {
            this.ctx.beginPath();
            this.ctx.moveTo(eyeX - 15, eyeY);
            this.ctx.quadraticCurveTo(eyeX, eyeY + 8, eyeX + 15, eyeY + 2);
            this.ctx.stroke();
        } else {
            const maxOpen = 7;
            const eyeHeight = maxOpen * Math.min(1, this.eyeOpenness);

            this.ctx.fillStyle = `rgba(255, 235, 200, ${Math.min(1, this.eyeOpenness * 1.5)})`;
            this.ctx.beginPath();
            this.ctx.ellipse(eyeX, eyeY, 14, eyeHeight, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = "#151010";
            this.ctx.beginPath();
            this.ctx.arc(eyeX + this.gazeOffset.x, eyeY + this.gazeOffset.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    loop(currentTime) {
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        this.time += deltaTime;

        const idleDuration = (currentTime - this.lastInteractionTime) / 1000;

        this.updateCharacter(deltaTime, idleDuration);

        const breathAmp = lerp(7, 14, this.presence);
        const geom = {
            backY: 420 + Math.sin(this.breathPhase) * breathAmp,
            headX: 300 + Math.cos(this.time * 0.1) * 4,
            headY: 440 + Math.sin(this.breathPhase) * (breathAmp * 0.4),
            earY: 400 + Math.sin(this.time * 0.2) * 3 + (1 - this.presence) * 12
        };

        this.render(geom);

        requestAnimationFrame(this.loop.bind(this));
    }
}

new LoomPresence();