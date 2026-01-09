    <script>
        // --- Enhanced Audio System ---
        let audioCtx;
        let engineOsc1, engineOsc2;
        let engineGain;
        let engineFilter;

        function initAudio() {
            if (audioCtx) return;
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            engineFilter = audioCtx.createBiquadFilter();
            engineFilter.type = 'lowpass';
            engineFilter.frequency.setValueAtTime(400, audioCtx.currentTime);
            
            engineGain = audioCtx.createGain();
            engineGain.gain.setValueAtTime(0, audioCtx.currentTime); 
            
            // Layer 1: The "annnnnn" hum
            engineOsc1 = audioCtx.createOscillator();
            engineOsc1.type = 'sawtooth';
            engineOsc1.frequency.setValueAtTime(55, audioCtx.currentTime); // Low A
            
            // Layer 2: A bit of detune for that "mechanical" drone
            engineOsc2 = audioCtx.createOscillator();
            engineOsc2.type = 'square';
            engineOsc2.frequency.setValueAtTime(55.5, audioCtx.currentTime);
            
            engineOsc1.connect(engineFilter);
            engineOsc2.connect(engineFilter);
            engineFilter.connect(engineGain);
            engineGain.connect(audioCtx.destination);
            
            engineOsc1.start();
            engineOsc2.start();
        }

        function updateEngineSound(yPercent) {
            if (!engineOsc1) return;
            // Base frequency + vertical pitch shift
            const baseFreq = 50 + (1 - yPercent) * 30;
            engineOsc1.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.1);
            engineOsc2.frequency.setTargetAtTime(baseFreq + 0.5, audioCtx.currentTime, 0.1);
            
            // Filter follows height to make it "sharper" when higher
            engineFilter.frequency.setTargetAtTime(300 + (1 - yPercent) * 400, audioCtx.currentTime, 0.1);
        }

        function playCoinSound() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }

        function playCrashSound() {
            if (!audioCtx) return;
            const bufferSize = audioCtx.sampleRate * 0.5;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, audioCtx.currentTime);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start();
        }

        // --- Game Setup ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('score-display');
        const startScreen = document.getElementById('start-screen');
        const gameOverScreen = document.getElementById('game-over-screen');
        const finalScoreDisplay = document.getElementById('final-score');
        const startButton = document.getElementById('start-button');
        const restartButton = document.getElementById('restart-button');

        let canvasWidth, canvasHeight;
        let score = 0;
        let isGameOver = false, isGameStarted = false;
        let player, enemies = [], coins = [], stars = [], particles = [], mouse = { y: 0 };

        class Player {
            constructor() {
                this.width = 60; this.height = 20;
                this.x = 80; this.y = canvasHeight / 2;
            }
            update() {
                const dy = mouse.y - (this.y + this.height / 2);
                this.y += dy * 0.12;
                if (this.y < 20) this.y = 20;
                if (this.y > canvasHeight - this.height - 20) this.y = canvasHeight - this.height - 20;
                updateEngineSound(this.y / canvasHeight);
            }
            draw() {
                ctx.save();
                ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 15;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + this.width, this.y + this.height / 2);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.lineTo(this.x + 12, this.y + this.height / 2);
                ctx.closePath(); ctx.fill();
                // Flame
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + 5);
                ctx.lineTo(this.x - 15 - Math.random() * 10, this.y + this.height / 2);
                ctx.lineTo(this.x, this.y + this.height - 5);
                ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
                ctx.fill();
                ctx.restore();
            }
        }

        class Enemy {
            constructor() {
                this.width = 55; this.height = 18;
                this.x = canvasWidth + 100;
                this.y = Math.random() * (canvasHeight - 100) + 50;
                this.speed = Math.random() * 4 + 3 + (score * 0.1);
            }
            update() { this.x -= this.speed; }
            draw() {
                ctx.save();
                ctx.shadowColor = '#ff3366'; ctx.shadowBlur = 12;
                ctx.fillStyle = '#ff3366';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.height / 2);
                ctx.lineTo(this.x + this.width, this.y);
                ctx.lineTo(this.x + this.width - 15, this.y + this.height / 2);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }

        class Coin {
            constructor() {
                this.radius = 12; this.x = canvasWidth + 50;
                this.y = Math.random() * (canvasHeight - 100) + 50;
                this.speed = 4; this.angle = 0;
            }
            update() { this.x -= this.speed; this.angle += 0.1; }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.scale(Math.cos(this.angle), 1);
                ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, this.radius);
                grad.addColorStop(0, '#fff5ad'); grad.addColorStop(1, '#ffcc00');
                ctx.fillStyle = grad; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 10;
                ctx.fill(); ctx.restore();
            }
        }

        class Star {
            constructor() { this.reset(true); }
            reset(rx = false) {
                this.x = rx ? Math.random() * canvasWidth : canvasWidth;
                this.y = Math.random() * canvasHeight;
                this.radius = Math.random() * 1.2;
                this.speed = Math.random() * 0.8 + 0.2;
                this.opacity = Math.random() * 0.7 + 0.3;
            }
            update() { this.x -= this.speed; if (this.x < 0) this.reset(); }
            draw() {
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.fill();
            }
        }

        class Particle {
            constructor(x, y, color) {
                this.x = x; this.y = y; this.color = color;
                this.radius = Math.random() * 3 + 1;
                this.life = 1;
                this.vx = (Math.random() - 0.5) * 10; this.vy = (Math.random() - 0.5) * 10;
            }
            update() { this.x += this.vx; this.y += this.vy; this.life -= 0.02; }
            draw() {
                ctx.save(); ctx.globalAlpha = this.life;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
            }
        }

        function startGame() {
            initAudio();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            engineGain.gain.setTargetAtTime(0.08, audioCtx.currentTime, 0.5);

            isGameStarted = true; isGameOver = false;
            score = 0; enemies = []; coins = []; particles = [];
            player = new Player();
            scoreDisplay.style.display = 'block';
            scoreDisplay.textContent = `Score: 0`;
            startScreen.style.display = 'none';
            gameOverScreen.style.display = 'none';
            document.body.style.cursor = 'none';
        }

        function endGame() {
            isGameOver = true;
            playCrashSound();
            engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
            document.body.style.cursor = 'default';
            finalScoreDisplay.textContent = `Coins Collected: ${score}`;
            gameOverScreen.style.display = 'flex';
        }

        function gameLoop() {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            stars.forEach(s => { s.update(); s.draw(); });

            if (isGameStarted && !isGameOver) {
                if (Math.random() < 0.02) enemies.push(new Enemy());
                if (Math.random() < 0.015) coins.push(new Coin());
                player.update();
                player.draw();

                enemies = enemies.filter(e => {
                    e.update(); e.draw();
                    if (player.x < e.x + e.width && player.x + player.width > e.x &&
                        player.y < e.y + e.height && player.y + player.height > e.y) {
                        for(let i=0; i<40; i++) particles.push(new Particle(e.x, e.y, '#ff3366'));
                        endGame();
                    }
                    return e.x + e.width > -50;
                });

                coins = coins.filter(c => {
                    c.update(); c.draw();
                    const dx = (player.x + player.width / 2) - c.x;
                    const dy = (player.y + player.height / 2) - c.y;
                    if (Math.sqrt(dx*dx + dy*dy) < c.radius + 25) {
                        score++;
                        scoreDisplay.textContent = `Score: ${score}`;
                        playCoinSound();
                        for(let i=0; i<10; i++) particles.push(new Particle(c.x, c.y, '#ffcc00'));
                        return false;
                    }
                    return c.x + c.radius > -50;
                });
            }

            particles = particles.filter(p => { p.update(); p.draw(); return p.life > 0; });
            requestAnimationFrame(gameLoop);
        }

        function setCanvasSize() {
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            canvas.width = canvasWidth; canvas.height = canvasHeight;
        }

        window.addEventListener('resize', setCanvasSize);
        window.addEventListener('mousemove', (e) => mouse.y = e.clientY);
        window.addEventListener('touchmove', (e) => {
            e.preventDefault(); mouse.y = e.touches[0].clientY;
        }, { passive: false });

        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', startGame);

        setCanvasSize();
        for (let i = 0; i < 150; i++) stars.push(new Star());
        mouse.y = canvasHeight / 2;
        gameLoop();
    </script>