class ChristmasTreeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameArea = document.getElementById('gameArea');
        this.startButton = document.getElementById('startButton');
        this.modalOverlay = document.getElementById('modalOverlay');
        this.modalClose = document.getElementById('modalClose');
        this.lightsOnElement = document.getElementById('lightsOn');
        this.gameTimeElement = document.getElementById('gameTime');
        
        this.trees = [];
        this.santa = {
            x: 0,
            y: 0,
            width: 60,
            height: 80,
            speed: 0,
            image: null,
            direction: 0, // -1 left, 0 neutral, 1 right
            lastDirection: 0, // Track previous direction
            directionChangeTimer: 0, // Timer for direction change (0.2s)
            speedBoost: 1.0, // Speed multiplier (up to 1.1 = 10% boost)
            sameDirectionTime: 0 // Time moving in same direction
        };
        
        this.gameState = 'waiting'; // waiting, playing, paused, gameover
        this.lightsOn = 0;
        this.gameTime = 0;
        this.gameTimeRemaining = 20; // Countdown from 20 seconds
        this.lastTime = 0;
        this.tiltX = 0;
        this.tiltSensitivity = 0.02;
        this.gamePhase = 'initial'; // initial, turningOff, final
        this.treesTurnedOff = 0; // Track how many trees have been turned off
        
        this.setupCanvas();
        this.loadSantaImage();
        this.createTrees();
        this.setupEventListeners();
        this.setupDeviceOrientation();
        this.animate();
    }
    
    setupCanvas() {
        const resize = () => {
            const rect = this.gameArea.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.santa.x = this.canvas.width / 2;
            this.santa.y = this.canvas.height - 100;
        };
        
        resize();
        window.addEventListener('resize', resize);
    }
    
    loadSantaImage() {
        this.santa.image = new Image();
        this.santa.image.src = '3697198.png';
        this.santa.image.onload = () => {
            // Image loaded
        };
        this.santa.image.onerror = () => {
            // If image fails to load, we'll draw a simple Santa shape
            console.log('Santa image not found, using placeholder');
        };
    }
    
    createTrees() {
        this.trees = [];
        const treeCount = 10;
        const spacing = this.canvas.width / (treeCount + 1);
        
        for (let i = 0; i < treeCount; i++) {
            const x = spacing * (i + 1);
            const y = this.canvas.height - 150;
            const height = 80 + Math.random() * 40;
            const width = height * 0.6;
            
            this.trees.push({
                x: x,
                y: y,
                width: width,
                height: height,
                lightsOn: true, // Start with lights ON
                proximity: 0, // Distance to Santa
                index: i // Store index for tracking
            });
        }
    }
    
    setupDeviceOrientation() {
        // Request permission for device orientation (iOS 13+)
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            this.startButton.addEventListener('click', async () => {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.enableOrientation();
                    }
                } catch (error) {
                    console.error('Permission denied:', error);
                    // Fallback to touch controls
                    this.enableTouchControls();
                }
            });
        } else {
            // Android or older iOS
            this.enableOrientation();
        }
    }
    
    enableOrientation() {
        window.addEventListener('deviceorientation', (e) => {
            if (this.gameState === 'playing') {
                // Use gamma (left/right tilt) for movement
                this.tiltX = e.gamma || 0;
                // Clamp and normalize
                this.tiltX = Math.max(-90, Math.min(90, this.tiltX));
            }
        });
    }
    
    enableTouchControls() {
        let touchStartX = 0;
        let touchCurrentX = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameState === 'playing') {
                touchStartX = e.touches[0].clientX;
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.gameState === 'playing') {
                e.preventDefault();
                touchCurrentX = e.touches[0].clientX;
                const delta = touchCurrentX - touchStartX;
                this.tiltX = (delta / this.canvas.width) * 180; // Convert to tilt-like value
                this.tiltX = Math.max(-90, Math.min(90, this.tiltX));
            }
        });
    }
    
    setupEventListeners() {
        this.startButton.addEventListener('click', () => {
            this.startGame();
        });
        
        this.modalClose.addEventListener('click', () => {
            this.modalOverlay.classList.remove('show');
            this.resetGame();
        });
        
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.modalOverlay.classList.remove('show');
            }
        });
        
        // Keyboard controls for desktop testing
        let leftPressed = false;
        let rightPressed = false;
        
        window.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing') {
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    leftPressed = true;
                }
                if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    rightPressed = true;
                }
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                leftPressed = false;
            }
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                rightPressed = false;
            }
        });
        
        // Update tilt from keyboard
        setInterval(() => {
            if (this.gameState === 'playing') {
                if (leftPressed) {
                    this.tiltX = Math.max(-90, this.tiltX - 5);
                }
                if (rightPressed) {
                    this.tiltX = Math.min(90, this.tiltX + 5);
                }
                if (!leftPressed && !rightPressed) {
                    this.tiltX *= 0.9; // Decay
                }
            }
        }, 16);
    }
    
    startGame() {
        this.gameState = 'playing';
        this.gameTime = 0;
        this.gameTimeRemaining = 20;
        this.lastTime = Date.now();
        this.gamePhase = 'initial';
        this.treesTurnedOff = 0;
        this.startButton.disabled = true;
        this.startButton.textContent = 'Playing...';
        
        // All trees start with lights ON
        this.trees.forEach(tree => {
            tree.lightsOn = true;
        });
    }
    
    resetGame() {
        this.gameState = 'waiting';
        this.gameTime = 0;
        this.gameTimeRemaining = 20;
        this.gamePhase = 'initial';
        this.treesTurnedOff = 0;
        this.startButton.disabled = false;
        this.startButton.textContent = 'Start Game';
        this.santa.x = this.canvas.width / 2;
        this.tiltX = 0;
        
        // Reset Santa movement properties
        this.santa.speed = 0;
        this.santa.direction = 0;
        this.santa.lastDirection = 0;
        this.santa.directionChangeTimer = 0;
        this.santa.speedBoost = 1.0;
        this.santa.sameDirectionTime = 0;
        
        // Reset all trees with lights ON
        this.trees.forEach(tree => {
            tree.lightsOn = true;
        });
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Update game time (countdown from 20)
        this.gameTime += deltaTime;
        this.gameTimeRemaining = Math.max(0, 20 - this.gameTime);
        this.gameTimeElement.textContent = Math.ceil(this.gameTimeRemaining) + 's';
        
        // Determine game phase
        // 0-2s: All lights on
        // 2-10s: Every 1 second one tree turns off, Santa can turn them back on
        // 10-20s: Final phase - Santa can turn on remaining trees
        if (this.gameTime < 2) {
            this.gamePhase = 'initial'; // 0-2s: All lights on
        } else if (this.gameTime < 10) {
            this.gamePhase = 'turningOff'; // 2-10s: Trees turning off
        } else {
            this.gamePhase = 'final'; // 10-20s: Final phase
        }
        
        // Turn off trees every 1 second from 2s to 10s
        // At 2s, 3s, 4s, 5s, 6s, 7s, 8s, 9s - that's 8 trees
        if (this.gamePhase === 'turningOff') {
            const timeSince2 = this.gameTime - 2;
            const treesToTurnOff = Math.floor(timeSince2) + 1; // 1 at 2s, 2 at 3s, 3 at 4s, etc.
            const maxTreesToTurnOff = 8; // Turn off 8 trees (one every second from 2-10s)
            
            // Check if we need to turn off more trees
            if (treesToTurnOff > this.treesTurnedOff && treesToTurnOff <= maxTreesToTurnOff) {
                // Find trees that are still on
                const onTrees = this.trees.filter(t => t.lightsOn);
                if (onTrees.length > 0) {
                    // Turn off a random tree that's still on
                    const randomTree = onTrees[Math.floor(Math.random() * onTrees.length)];
                    randomTree.lightsOn = false;
                    this.treesTurnedOff = treesToTurnOff;
                }
            }
        }
        
        // Update Santa position based on tilt with speed boost mechanics
        const targetSpeed = this.tiltX * this.tiltSensitivity;
        
        // Determine current direction based on target speed
        let newDirection = 0;
        if (targetSpeed > 0.001) {
            newDirection = 1; // Moving right
        } else if (targetSpeed < -0.001) {
            newDirection = -1; // Moving left
        } else {
            newDirection = 0; // Neutral
        }
        
        // Check if direction changed
        if (newDirection !== this.santa.lastDirection && this.santa.lastDirection !== 0) {
            // Direction changed - start direction change timer
            this.santa.directionChangeTimer = 0.2; // 0.2 seconds to change direction
            this.santa.speedBoost = 1.0; // Reset speed boost
            this.santa.sameDirectionTime = 0;
        } else if (newDirection === this.santa.lastDirection && newDirection !== 0) {
            // Same direction - increase speed boost over time
            this.santa.sameDirectionTime += deltaTime;
            // Speed boost increases up to 10% (1.1) over 1 second
            this.santa.speedBoost = Math.min(1.1, 1.0 + (this.santa.sameDirectionTime * 0.1));
        }
        
        // Update direction change timer
        if (this.santa.directionChangeTimer > 0) {
            this.santa.directionChangeTimer -= deltaTime;
            // During direction change, reduce responsiveness
            const changeProgress = 1 - (this.santa.directionChangeTimer / 0.2);
            this.santa.speed += (targetSpeed - this.santa.speed) * 0.1 * changeProgress;
        } else {
            // Normal movement
            this.santa.speed += (targetSpeed - this.santa.speed) * 0.1;
        }
        
        // Apply speed boost
        const boostedSpeed = this.santa.speed * this.santa.speedBoost;
        this.santa.x += boostedSpeed * deltaTime * 100;
        
        // Update direction tracking
        this.santa.lastDirection = newDirection;
        
        // Keep Santa in bounds
        this.santa.x = Math.max(this.santa.width / 2, 
                       Math.min(this.canvas.width - this.santa.width / 2, this.santa.x));
        
        // Update trees and lights based on phase
        let lightsOnCount = 0;
        const touchDistance = 80; // Distance for Santa to touch tree
        
        this.trees.forEach(tree => {
            // Calculate distance to Santa
            const dx = tree.x - this.santa.x;
            const dy = tree.y - this.santa.y;
            tree.proximity = Math.sqrt(dx * dx + dy * dy);
            
            if (this.gamePhase === 'initial') {
                // 0-2s: All lights stay ON
                tree.lightsOn = true;
            } else if (this.gamePhase === 'turningOff') {
                // 2-12s: Trees can be turned off, but Santa can touch to turn them back on
                if (tree.proximity < touchDistance) {
                    // Santa touches tree - turn lights on
                    tree.lightsOn = true;
                }
                // Trees that are off stay off unless Santa touches them
            } else if (this.gamePhase === 'final') {
                // 12-20s: Santa can turn on any remaining off trees
                if (tree.proximity < touchDistance) {
                    // Santa touches tree - turn lights on
                    tree.lightsOn = true;
                }
                // Lights that are on stay on (no decay)
            }
            
            if (tree.lightsOn) {
                lightsOnCount++;
            }
        });
        
        this.lightsOn = lightsOnCount;
        this.lightsOnElement.textContent = lightsOnCount + '/' + this.trees.length;
        
        // Check game end condition
        if (this.gameTimeRemaining <= 0) {
            this.endGame();
        }
    }
    
    endGame() {
        this.gameState = 'gameover';
        const allLightsOn = this.lightsOn === this.trees.length;
        
        if (allLightsOn) {
            // Victory!
            document.getElementById('modalTitle').textContent = '🎄 Congratulations! 🎄';
            document.getElementById('modalMessage').textContent = 'You kept all the lights on!';
            document.getElementById('modalStats').textContent = `All ${this.trees.length} trees are lit!`;
            this.modalOverlay.classList.add('show');
        } else {
            // Game over - reset
            setTimeout(() => {
                this.resetGame();
                this.startGame();
            }, 1000);
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ground
        this.ctx.fillStyle = '#1a3a1a';
        this.ctx.fillRect(0, this.canvas.height - 50, this.canvas.width, 50);
        
        // Draw trees
        this.trees.forEach(tree => {
            this.drawTree(tree);
        });
        
        // Draw Santa
        this.drawSanta();
        
        // Draw phase indicator
        if (this.gameState === 'playing') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(10, 10, 200, 30);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'left';
            
            let phaseText = '';
            if (this.gamePhase === 'initial') {
                phaseText = 'Phase: All Lights On';
            } else if (this.gamePhase === 'turningOff') {
                phaseText = 'Phase: Trees Turning Off - Touch to Turn On!';
            } else {
                phaseText = 'Phase: Final - Turn On Remaining Trees!';
            }
            this.ctx.fillText(phaseText, 15, 30);
        }
        
        // Draw instructions if waiting
        if (this.gameState === 'waiting') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Press Start to Begin!', this.canvas.width / 2, this.canvas.height / 2);
        }
        
        // Draw game over message briefly
        if (this.gameState === 'gameover' && this.lightsOn < this.trees.length) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Resetting...', this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
    }
    
    drawTree(tree) {
        const { x, y, width, height, lightsOn, lightTimer } = tree;
        
        // Draw tree trunk
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(x - 8, y + height - 20, 16, 20);
        
        // Draw tree layers (triangles)
        const layers = 3;
        const layerHeight = height / layers;
        
        for (let i = 0; i < layers; i++) {
            const layerY = y + (layers - i - 1) * layerHeight;
            const layerWidth = width * (1 - i * 0.2);
            
            this.ctx.fillStyle = lightsOn ? '#0f5f0f' : '#1a3a1a';
            this.ctx.beginPath();
            this.ctx.moveTo(x, layerY);
            this.ctx.lineTo(x - layerWidth / 2, layerY + layerHeight);
            this.ctx.lineTo(x + layerWidth / 2, layerY + layerHeight);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Draw lights if on
            if (lightsOn) {
                const lightCount = 5;
                for (let j = 0; j < lightCount; j++) {
                    const lightX = x - layerWidth / 2 + (layerWidth / lightCount) * j;
                    const lightY = layerY + layerHeight * 0.5;
                    const lightSize = 4 + Math.sin(Date.now() / 200 + j) * 2;
                    
                    // Random colors for lights
                    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
                    this.ctx.fillStyle = colors[j % colors.length];
                    this.ctx.beginPath();
                    this.ctx.arc(lightX, lightY, lightSize, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Glow effect
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = colors[j % colors.length];
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                }
            }
        }
        
        // Draw star on top
        if (lightsOn) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - 5);
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const x1 = x + Math.cos(angle) * 8;
                const y1 = y - 5 + Math.sin(angle) * 8;
                this.ctx.lineTo(x1, y1);
            }
            this.ctx.closePath();
            this.ctx.fill();
        }
    }
    
    drawSanta() {
        const { x, y, width, height } = this.santa;
        
        if (this.santa.image && this.santa.image.complete) {
            // Draw Santa image
            this.ctx.drawImage(
                this.santa.image,
                x - width / 2,
                y - height,
                width,
                height
            );
        } else {
            // Draw placeholder Santa (red rectangle with hat)
            // Hat
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(x - width / 2, y - height, width, height * 0.3);
            // White trim
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(x - width / 2, y - height + height * 0.25, width, 5);
            // Body
            this.ctx.fillStyle = '#ff4444';
            this.ctx.fillRect(x - width / 2, y - height + height * 0.3, width, height * 0.7);
            // Face
            this.ctx.fillStyle = '#ffdbac';
            this.ctx.beginPath();
            this.ctx.arc(x, y - height * 0.4, width * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    animate() {
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = now;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize game when page loads
(function() {
    function initGame() {
        try {
            new ChristmasTreeGame();
        } catch (error) {
            console.error('Failed to initialize game:', error);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        setTimeout(initGame, 0);
    }
})();
