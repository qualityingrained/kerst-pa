class ChristmasTreeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.gameArea = document.getElementById('gameArea');
        this.startButton = document.getElementById('startButton');
        this.modalOverlay = document.getElementById('modalOverlay');
        this.modalClose = document.getElementById('modalClose');
        this.lightsOnElement = document.getElementById('lightsOn');
        this.gameTimeElement = document.getElementById('gameTime');
        
        // Check if all required elements exist
        if (!this.canvas || !this.gameArea || !this.startButton) {
            console.error('Required game elements not found!');
            return;
        }
        
        // Get canvas context
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Could not get canvas context!');
            return;
        }
        
        // Screen dimensions (will be set on load)
        this.screenWidth = 0;
        this.screenHeight = 0;
        
        this.trees = [];
        this.santa = {
            x: 0,
            y: 0,
            width: 50,
            height: 70,
            speedX: 0,
            speedY: 0,
            targetX: 0,
            targetY: 0,
            image: null,
            wanderTimer: 0
        };
        
        this.gameState = 'waiting'; // waiting, playing, gameover
        this.lightsOn = 0;
        this.gameTime = 0;
        this.lastTime = 0;
        this.treesToTurnOff = []; // Queue of trees to turn off
        this.lastTurnOffTime = 0;
        
        this.setupCanvas();
        this.loadSantaImage();
        this.setupEventListeners();
        this.animate();
    }
    
    setupCanvas() {
        const resize = () => {
            // Detect actual screen frame size
            this.screenWidth = window.innerWidth;
            this.screenHeight = window.innerHeight;
            
            const rect = this.gameArea.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            // Recreate trees if game hasn't started
            if (this.gameState === 'waiting' && this.canvas.width > 0 && this.canvas.height > 0) {
                this.createTrees();
            }
        };
        
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', () => {
            setTimeout(resize, 100); // Delay to ensure correct dimensions after rotation
        });
    }
    
    loadSantaImage() {
        this.santa.image = new Image();
        this.santa.image.src = '3697198.png';
        this.santa.image.onload = () => {
            // Image loaded
        };
        this.santa.image.onerror = () => {
            console.log('Santa image not found, using placeholder');
        };
    }
    
    // Calculate hitbox radius for a tree (same as in handleTreeTap)
    getHitboxRadius(tree) {
        return Math.max(tree.width / 2, tree.height / 2) + 30;
    }
    
    // Calculate overlap area of two circles
    calculateCircleOverlap(r1, r2, distance) {
        if (distance >= r1 + r2) return 0; // No overlap
        if (distance <= Math.abs(r1 - r2)) {
            // One circle is inside the other
            const smallerRadius = Math.min(r1, r2);
            return Math.PI * smallerRadius * smallerRadius;
        }
        
        // Calculate intersection area of two circles
        const d = distance;
        const r1Sq = r1 * r1;
        const r2Sq = r2 * r2;
        
        const d1 = (r1Sq - r2Sq + d * d) / (2 * d);
        const d2 = d - d1;
        
        const h = Math.sqrt(r1Sq - d1 * d1);
        
        const area1 = r1Sq * Math.acos(d1 / r1) - d1 * h;
        const area2 = r2Sq * Math.acos(d2 / r2) - d2 * h;
        
        return area1 + area2;
    }
    
    // Check if two trees' hitboxes overlap more than 10%
    checkOverlap(tree1, tree2) {
        const dx = tree1.x - tree2.x;
        const dy = tree1.y - tree2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const r1 = this.getHitboxRadius(tree1);
        const r2 = this.getHitboxRadius(tree2);
        
        // Calculate overlap area
        const overlapArea = this.calculateCircleOverlap(r1, r2, distance);
        
        // Calculate area of smaller hitbox
        const smallerRadius = Math.min(r1, r2);
        const smallerArea = Math.PI * smallerRadius * smallerRadius;
        
        // Check if overlap is more than 10% of smaller hitbox
        const overlapPercentage = (overlapArea / smallerArea) * 100;
        
        return overlapPercentage > 10;
    }
    
    createTrees() {
        this.trees = [];
        const treeCount = 10;
        const maxAttempts = 1000; // Prevent infinite loops
        const treeWidth = 60;
        const treeHeight = 80;
        
        // Padding from edges
        const padding = 40;
        const minX = padding;
        const maxX = this.canvas.width - padding;
        const minY = padding + 100; // Leave space at top for UI
        const maxY = this.canvas.height - padding - 50; // Leave space at bottom
        
        for (let i = 0; i < treeCount; i++) {
            let attempts = 0;
            let validPosition = false;
            let x, y;
            
            while (!validPosition && attempts < maxAttempts) {
                x = minX + Math.random() * (maxX - minX);
                y = minY + Math.random() * (maxY - minY);
                
                // Check overlap with existing trees
                validPosition = true;
                for (const existingTree of this.trees) {
                    if (this.checkOverlap(
                        { x, y, width: treeWidth, height: treeHeight },
                        existingTree
                    )) {
                        validPosition = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            if (validPosition) {
                this.trees.push({
                    x: x,
                    y: y,
                    width: treeWidth,
                    height: treeHeight,
                    lightsOn: true,
                    index: i
                });
            } else {
                console.warn(`Could not place tree ${i + 1} without overlap`);
            }
        }
        
        console.log(`Created ${this.trees.length} trees`);
    }
    
    setupEventListeners() {
        if (!this.startButton) {
            console.error('Start button not found!');
            return;
        }
        
        this.startButton.addEventListener('click', () => {
            this.startGame();
        });
        
        this.startButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.startGame();
        });
        
        this.modalClose.addEventListener('click', () => {
            this.modalOverlay.classList.remove('show');
            const vrButton = document.getElementById('vrButton');
            if (vrButton) {
                vrButton.style.display = 'none';
            }
            this.resetGame();
        });
        
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.modalOverlay.classList.remove('show');
                const vrButton = document.getElementById('vrButton');
                if (vrButton) {
                    vrButton.style.display = 'none';
                }
            }
        });
        
        // Touch events for tapping trees
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameState === 'playing') {
                const rect = this.canvas.getBoundingClientRect();
                const touch = e.touches[0];
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;
                this.handleTreeTap(x, y);
            }
        });
        
        // Mouse events for desktop testing
        this.canvas.addEventListener('click', (e) => {
            if (this.gameState === 'playing') {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                console.log('Click at:', x, y, 'Canvas size:', this.canvas.width, this.canvas.height, 'Display size:', rect.width, rect.height);
                this.handleTreeTap(x, y);
            }
        });
    }
    
    handleTreeTap(x, y) {
        // Check if tap is on a tree
        let tapped = false;
        for (const tree of this.trees) {
            const dx = x - tree.x;
            const dy = y - tree.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if tap is within tree hitbox (same calculation as in checkOverlap)
            const hitRadius = this.getHitboxRadius(tree);
            if (distance < hitRadius) {
                tree.lightsOn = true;
                tapped = true;
                console.log('Tree tapped!', tree.index, 'at', tree.x, tree.y, 'click at', x, y, 'distance', distance);
                break;
            }
        }
        if (!tapped) {
            console.log('No tree tapped at', x, y);
        }
    }
    
    startGame() {
        console.log('Starting game...');
        
        // Make sure trees are created
        if (this.trees.length === 0) {
            this.createTrees();
        }
        
        this.gameState = 'playing';
        this.gameTime = 0;
        this.lastTime = Date.now();
        this.lastTurnOffTime = 0;
        this.treesToTurnOff = [];
        
        // Initialize Santa position
        this.santa.x = this.canvas.width / 2;
        this.santa.y = this.canvas.height / 2;
        this.santa.targetX = this.santa.x;
        this.santa.targetY = this.santa.y;
        this.santa.wanderTimer = 0;
        
        if (this.startButton) {
            this.startButton.disabled = true;
            this.startButton.textContent = 'Playing...';
        }
        
        // All trees start with lights ON
        this.trees.forEach(tree => {
            tree.lightsOn = true;
        });
        
        console.log('Game started with', this.trees.length, 'trees');
        
        // Schedule trees to turn off: one per second from 2s to 18s
        // We have 10 trees, so they'll turn off at 2s, 3s, 4s, ..., 11s
        for (let i = 0; i < 10; i++) {
            const turnOffTime = 2 + i; // 2s, 3s, 4s, ..., 11s
            this.treesToTurnOff.push(turnOffTime);
        }
        
        console.log('Game started!', {
            gameState: this.gameState,
            treesCount: this.trees.length,
            treesToTurnOff: this.treesToTurnOff.length
        });
    }
    
    resetGame() {
        this.gameState = 'waiting';
        this.gameTime = 0;
        this.lastTurnOffTime = 0;
        this.treesToTurnOff = [];
        this.startButton.disabled = false;
        this.startButton.textContent = 'Start Game';
        
        // Reset all trees with lights ON
        this.trees.forEach(tree => {
            tree.lightsOn = true;
        });
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Update game time
        this.gameTime += deltaTime;
        const timeRemaining = Math.max(0, 20 - this.gameTime);
        this.gameTimeElement.textContent = Math.ceil(timeRemaining) + 's';
        
        // Turn off trees according to schedule
        // Check if it's time to turn off the next tree
        const currentSecond = Math.floor(this.gameTime);
        if (currentSecond >= 2 && currentSecond <= 18 && currentSecond !== this.lastTurnOffTime) {
            // Find the next tree to turn off at this second
            const turnOffIndex = this.treesToTurnOff.indexOf(currentSecond);
            if (turnOffIndex !== -1) {
                // Find a random tree that's still on
                const onTrees = this.trees.filter(t => t.lightsOn);
                if (onTrees.length > 0) {
                    const randomTree = onTrees[Math.floor(Math.random() * onTrees.length)];
                    randomTree.lightsOn = false;
                    this.treesToTurnOff.splice(turnOffIndex, 1);
                    this.lastTurnOffTime = currentSecond;
                }
            }
        }
        
        // Update Santa's random wandering
        this.santa.wanderTimer -= deltaTime;
        if (this.santa.wanderTimer <= 0) {
            // Pick a new random target
            const padding = 50;
            this.santa.targetX = padding + Math.random() * (this.canvas.width - 2 * padding);
            this.santa.targetY = padding + Math.random() * (this.canvas.height - 2 * padding);
            this.santa.wanderTimer = 2 + Math.random() * 3; // Wander for 2-5 seconds
        }
        
        // Move Santa towards target
        const dx = this.santa.targetX - this.santa.x;
        const dy = this.santa.targetY - this.santa.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            const speed = 30; // pixels per second
            this.santa.speedX = (dx / distance) * speed;
            this.santa.speedY = (dy / distance) * speed;
            
            this.santa.x += this.santa.speedX * deltaTime;
            this.santa.y += this.santa.speedY * deltaTime;
        } else {
            this.santa.speedX = 0;
            this.santa.speedY = 0;
        }
        
        // Keep Santa in bounds
        this.santa.x = Math.max(this.santa.width / 2, 
                       Math.min(this.canvas.width - this.santa.width / 2, this.santa.x));
        this.santa.y = Math.max(this.santa.height / 2, 
                       Math.min(this.canvas.height - this.santa.height / 2, this.santa.y));
        
        // Count lights on
        let lightsOnCount = 0;
        this.trees.forEach(tree => {
            if (tree.lightsOn) {
                lightsOnCount++;
            }
        });
        
        this.lightsOn = lightsOnCount;
        this.lightsOnElement.textContent = lightsOnCount + '/10';
        
        // Check game end condition at 20 seconds
        if (this.gameTime >= 20) {
            this.endGame();
        }
    }
    
    endGame() {
        this.gameState = 'gameover';
        const allLightsOn = this.lightsOn === 10;
        
        if (allLightsOn) {
            // Victory!
            document.getElementById('modalTitle').textContent = '🎄 Congratulations! 🎄';
            document.getElementById('modalMessage').textContent = "We're going to a VR Game in Antwerp with the entire family! Just need to pick a date... it's going to be awesome.";
            document.getElementById('modalStats').textContent = `All 10 trees are lit!`;
            // Show VR button
            const vrButton = document.getElementById('vrButton');
            if (vrButton) {
                vrButton.style.display = 'inline-block';
            }
            this.modalOverlay.classList.add('show');
        } else {
            // Game over - show message and allow replay
            document.getElementById('modalTitle').textContent = '🎄 Try Again! 🎄';
            document.getElementById('modalMessage').textContent = `You had ${this.lightsOn} out of 10 trees lit. Keep all trees lit by 20 seconds to win!`;
            document.getElementById('modalStats').textContent = '';
            const vrButton = document.getElementById('vrButton');
            if (vrButton) {
                vrButton.style.display = 'none';
            }
            this.modalOverlay.classList.add('show');
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
        
        // Draw Santa (just visual, no game impact)
        this.drawSanta();
        
        // Draw instructions if waiting
        if (this.gameState === 'waiting') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Press Start to Begin!', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    drawTree(tree) {
        const { x, y, width, height, lightsOn } = tree;
        
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
    let gameInstance = null;
    
    function initGame() {
        try {
            console.log('Initializing game...');
            if (!gameInstance) {
                gameInstance = new ChristmasTreeGame();
                console.log('Game instance created:', gameInstance);
            }
        } catch (error) {
            console.error('Failed to initialize game:', error);
            console.error('Stack:', error.stack);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM loaded');
            setTimeout(initGame, 100);
        });
    } else {
        console.log('DOM already loaded');
        setTimeout(initGame, 100);
    }
})();
