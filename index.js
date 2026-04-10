function smoothNoise(t) { return (Math.sin(t) + Math.sin(t * 1.37) + Math.sin(t * 2.13)) / 3; }
function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }
function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

class PhantomNode {
    constructor() {
        this.nx = Math.random();
        this.ny = Math.random(); 
        this.warmth = 0;
        this.seedX = Math.random() * 100;
        this.seedY = Math.random() * 100;
    }
    update(t) {
        const targetNX = 0.5 + Math.sin(t * 0.02 + this.seedX) * 0.4;
        const targetNY = 0.5 + Math.cos(t * 0.015 + this.seedY) * 0.3;

        this.nx = lerp(this.nx, targetNX, 0.005);
        this.ny = lerp(this.ny, targetNY, 0.005);
        this.warmth = Math.pow((smoothNoise(t * 0.05) + 1) / 2, 2);
    }
}

class Mote {
    constructor() {
        this.nx = Math.random();
        this.ny = 1.0 + Math.random() * 0.5;
        this.seed = Math.random() * 100;
        this.sizeBase = Math.random() * 2.5 + 1.0;
        this.speedBase = Math.random() * 0.001 + 0.0005; 
    }
    update(t, loomNX, loomNY, phantoms, aspectRatio) {
        const dx = (this.nx - loomNX) * aspectRatio;
        const dy = (this.ny - loomNY);
        const dLoom = Math.sqrt(dx * dx + dy * dy);

        let comfortMultiplier = smoothstep(0, 0.4, dLoom);
        let phantomPullNX = 0;

        phantoms.forEach(p => {
            const pdx = (this.nx - p.nx) * aspectRatio;
            const pdy = (this.ny - p.ny);
            const dPhantom = Math.sqrt(pdx * pdx + pdy * pdy);
            if (dPhantom < 0.2) {
                comfortMultiplier *= 0.5;
                phantomPullNX += (p.nx - this.nx) * 0.01 * p.warmth;
            }
        });

        const currentSpeed = this.speedBase * (0.1 + 0.9 * comfortMultiplier);

        this.ny -= currentSpeed;
        this.nx += Math.sin(t * 0.5 + this.seed) * 0.001 + phantomPullNX;

        if (this.ny < -0.1) {
            this.ny = 1.1;
            this.nx = Math.random();
        }
    }
    draw(ctx, w, h, scale, presence) {
        const px = this.nx * w;
        const py = this.ny * h;
        const pSize = this.sizeBase * (scale * 0.8); 

        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 230, 200, ${0.1 + presence * 0.4})`;
        ctx.fill();
    }
}

class LoomPresence {
    constructor() {
        this.canvas = document.getElementById('loom-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.time = 0;
        this.breathPhase = 0;
        this.lastFrameTime = performance.now();
        this.lastInteractionTime = performance.now();

        this.inputActive = false;
        this.inputNX = 0.5;
        this.inputNY = 0.5;

        this.presence = 0;
        this.eyeOpenness = 0;
        this.gazeOffset = { x: 0, y: 0 };

        this.phantoms = [new PhantomNode(), new PhantomNode(), new PhantomNode()];
        this.motes = [];

        this.handleResize();
        window.addEventListener('resize', this.handleResize.bind(this));


        window.addEventListener('pointermove', this.handlePointer.bind(this));
        window.addEventListener('pointerdown', this.handlePointer.bind(this));
        window.addEventListener('pointerup', () => this.inputActive = false);
        window.addEventListener('pointerleave', () => this.inputActive = false);

        requestAnimationFrame(this.loop.bind(this));
    }

    handleResize() {
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        this.aspectRatio = this.w / this.h;

        this.scale = Math.min(this.w, this.h) / 500;


        const area = this.w * this.h;
        const targetMotes = Math.max(15, Math.min(80, Math.floor(area / 15000)));

 
        if (this.motes.length < targetMotes) {
            while (this.motes.length < targetMotes) this.motes.push(new Mote());
        } else if (this.motes.length > targetMotes) {
            this.motes.splice(targetMotes); 
        }
    }

    handlePointer(e) {
        this.inputActive = true;
        this.inputNX = e.clientX / this.w;
        this.inputNY = e.clientY / this.h;
        this.lastInteractionTime = performance.now();
    }

    updateCharacter(deltaTime, idleDuration) {
        this.presence = lerp(this.presence, idleDuration > 5 ? 1.0 : 0.0, idleDuration > 5 ? 0.002 : 0.05);
        this.phantoms.forEach(p => p.update(this.time));


        const doubt = Math.pow(Math.max(0, smoothNoise(this.time * 0.3)), 2) * (1 - this.presence * 0.8);
        let breathSpeed = lerp(1.5, 0.6, this.presence);
        const syncWindow = Math.pow(smoothNoise(this.time * 0.04), 4);

        if (syncWindow > 0.5) {
            const phaseDiff = Math.sin(this.time * 0.65) - Math.sin(this.breathPhase);
            breathSpeed += phaseDiff * (syncWindow * 0.5);
        }

        this.breathPhase += deltaTime * breathSpeed * (1 - doubt * 0.9);

        const curiosity = Math.pow((Math.sin(this.time * 0.1) + Math.sin(this.time * 0.17)) * 0.5, 4);
        const stillnessSafety = smoothstep(8, 20, idleDuration);
        const awareness = curiosity * stillnessSafety * this.presence;
        this.eyeOpenness = lerp(this.eyeOpenness, Math.max(0, (awareness - 0.1) * 5), 0.02);

        if (this.eyeOpenness > 0.05) {
            let totalWeight = this.inputActive ? 1.0 : 0.1;
            let weightedNX = this.inputNX * totalWeight;
            let weightedNY = this.inputNY * totalWeight;

            this.phantoms.forEach(p => {
                const pWeight = Math.pow(p.warmth, 2) * 3.0;
                weightedNX += p.nx * pWeight;
                weightedNY += p.ny * pWeight;
                totalWeight += pWeight;
            });

            const targetNX = weightedNX / totalWeight;
            const targetNY = weightedNY / totalWeight;


            const targetGazeX = (targetNX - 0.5) * 40 * this.scale;
            const targetGazeY = (targetNY - 0.5) * 40 * this.scale;
            const shyOffsetX = smoothNoise(this.time * 0.5) * 8 * this.scale;

            this.gazeOffset.x = lerp(this.gazeOffset.x, targetGazeX + shyOffsetX, 0.03);
            this.gazeOffset.y = lerp(this.gazeOffset.y, targetGazeY, 0.03);
        } else {
            this.gazeOffset.x = lerp(this.gazeOffset.x, 0, 0.02);
            this.gazeOffset.y = lerp(this.gazeOffset.y, 0, 0.02);
        }
    }

    render() {
        const w = this.w;
        const h = this.h;
        const s = this.scale;

        const cx = w * 0.5;
        const cy = h * 0.5 + (40 * s); 

        const bgR = lerp(12, 22, this.presence);
        const bgG = lerp(10, 16, this.presence);
        const bgB = lerp(12, 15, this.presence);
        this.ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.globalCompositeOperation = "screen";
        this.phantoms.forEach(p => {
            if (p.warmth > 0.05) {
                const px = p.nx * w;
                const py = p.ny * h;
                const radius = 250 * s;
                const echoGrad = this.ctx.createRadialGradient(px, py, 10 * s, px, py, radius);
                echoGrad.addColorStop(0, `rgba(40, 25, 25, ${p.warmth * 0.15})`);
                echoGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
                this.ctx.fillStyle = echoGrad;
                this.ctx.fillRect(0, 0, w, h);
            }
        });
        this.ctx.globalCompositeOperation = "source-over";

        const bgGrad = this.ctx.createRadialGradient(cx, cy, 100 * s, cx, cy, 600 * s);
        bgGrad.addColorStop(0, `rgba(0,0,0,0)`);
        bgGrad.addColorStop(1, `rgba(5, 4, 4, 0.9)`);
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, w, h);


        this.motes.forEach(m => {
            m.update(this.time, 0.5, 0.5, this.phantoms, this.aspectRatio);
            m.draw(this.ctx, w, h, s, this.presence);
        });


        const breathAmp = lerp(7, 14, this.presence) * s;
        const breathY = Math.sin(this.breathPhase) * breathAmp;

        const geom = {
            headX: cx - (50 * s) + Math.cos(this.time * 0.1) * 4 * s,
            headY: cy - (40 * s) + breathY * 0.4,
            backY: cy - (60 * s) + breathY,
            earY: cy - (80 * s) + Math.sin(this.time * 0.2) * 3 * s + (1 - this.presence) * 12 * s,
            frontX: cx - (200 * s),
            tailX: cx + (250 * s),
            floorY: cy + (100 * s)
        };


        const shadowWidth = lerp(200, 350, this.presence) * s;
        const shadowGrad = this.ctx.createRadialGradient(cx, geom.floorY, 10 * s, cx, geom.floorY, shadowWidth);
        shadowGrad.addColorStop(0, `rgba(0,0,0,${lerp(0.4, 0.9, this.presence)})`);
        shadowGrad.addColorStop(1, `rgba(0,0,0,0)`);
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(0, geom.floorY - 100 * s, w, 200 * s);


        const lR = lerp(100, 140, this.presence);
        const lG = lerp(85, 105, this.presence);
        const lB = lerp(95, 110, this.presence);

        const bodyGrad = this.ctx.createRadialGradient(geom.headX, geom.headY, 20 * s, geom.headX + 100 * s, geom.backY, 350 * s);
        bodyGrad.addColorStop(0, `rgb(${lR}, ${lG}, ${lB})`);
        bodyGrad.addColorStop(1, `rgb(${lR - 35}, ${lG - 25}, ${lB - 25})`);

        this.ctx.fillStyle = bodyGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(geom.frontX, geom.floorY);
        this.ctx.quadraticCurveTo(geom.headX - 90 * s, geom.backY + 30 * s, geom.headX, geom.backY - 40 * s);
        this.ctx.quadraticCurveTo(cx + 100 * s, geom.backY - 100 * s, geom.tailX, geom.backY + 40 * s);
        this.ctx.quadraticCurveTo(geom.tailX + 50 * s, geom.floorY, cx + 50 * s, geom.floorY);
        this.ctx.fill();


        this.ctx.fillStyle = `rgb(${lR - 25}, ${lG - 20}, ${lB - 20})`;
        this.ctx.beginPath();
        this.ctx.moveTo(geom.headX + 10 * s, geom.headY - 60 * s);
        this.ctx.quadraticCurveTo(geom.headX - 70 * s, geom.earY - 10 * s, geom.headX - 90 * s, geom.earY + 50 * s);
        this.ctx.quadraticCurveTo(geom.headX - 50 * s, geom.headY + 40 * s, geom.headX - 10 * s, geom.headY - 10 * s);
        this.ctx.fill();


        const eyeX = geom.headX - 25 * s;
        const eyeY = geom.headY - 20 * s;

        this.ctx.strokeStyle = `rgb(${lR - 55}, ${lG - 45}, ${lB - 45})`;
        this.ctx.lineWidth = 3 * Math.max(0.5, s); 

        if (this.eyeOpenness < 0.02) {
            this.ctx.beginPath();
            this.ctx.moveTo(eyeX - 15 * s, eyeY);
            this.ctx.quadraticCurveTo(eyeX, eyeY + 8 * s, eyeX + 15 * s, eyeY + 2 * s);
            this.ctx.stroke();
        } else {
            const maxOpen = 7 * s;
            const eyeHeight = maxOpen * Math.min(1, this.eyeOpenness);

            this.ctx.fillStyle = `rgba(255, 235, 200, ${Math.min(1, this.eyeOpenness * 1.5)})`;
            this.ctx.beginPath();
            this.ctx.ellipse(eyeX, eyeY, 14 * s, eyeHeight, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = "#151010";
            this.ctx.beginPath();
            this.ctx.arc(eyeX + this.gazeOffset.x, eyeY + this.gazeOffset.y, 4 * s, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    loop(currentTime) {
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        this.time += deltaTime;

        const idleDuration = (currentTime - this.lastInteractionTime) / 1000;

        this.updateCharacter(deltaTime, idleDuration);
        this.render();

        requestAnimationFrame(this.loop.bind(this));
    }
}

new LoomPresence();