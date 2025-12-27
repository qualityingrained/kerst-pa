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
            wanderTimer: 0 // Timer for random wandering when all trees are lit
        };
        
        this.gameState = 'waiting'; // waiting, playing, gameover
        this.lightsOn = 0;
        this.gameTime = 0;
        this.lastTime = 0;
        this.treesToTurnOff = []; // Queue of trees to turn off
        this.lastTurnOffTime = 0;
        this.santaTapped = false; // Track if Santa was tapped
        
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
            // Use display size for coordinate system (simpler for mobile)
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            console.log('Canvas resized:', {
                displayWidth: rect.width,
                displayHeight: rect.height,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height
            });
            
            // Recreate trees if game hasn't started
            if (this.gameState === 'waiting' && this.canvas.width > 0 && this.canvas.height > 0) {
                this.createTrees();
            }
        };
        
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', () => {
            setTimeout(resize, 200); // Longer delay for mobile orientation change
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
        // Reduced padding for mobile - trees are easier to tap on touch screens
        return Math.max(tree.width / 2, tree.height / 2) + 20;
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
        // Tree centers - same calculation as in handleTreeTap
        const center1X = tree1.x;
        const center1Y = tree1.y + tree1.height / 3;
        const center2X = tree2.x;
        const center2Y = tree2.y + tree2.height / 3;
        
        const dx = center1X - center2X;
        const dy = center1Y - center2Y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const r1 = this.getHitboxRadius(tree1);
        const r2 = this.getHitboxRadius(tree2);
        
        // Calculate overlap area
        const overlapArea = this.calculateCircleOverlap(r1, r2, distance);
        
        // Calculate area of smaller hitbox
        const smallerRadius = Math.min(r1, r2);
        const smallerArea = Math.PI * smallerRadius * smallerRadius;
        
        // Check if overlap is more than 10% of smaller hitbox
        // Use a small tolerance to account for floating point precision
        const overlapPercentage = (overlapArea / smallerArea) * 100;
        
        // Allow up to 10.5% to account for rounding and ensure trees can be placed
        return overlapPercentage > 10.5;
    }
    
    createTrees() {
        this.trees = [];
        const treeCount = 10; // Default, but will use actual count placed
        const maxAttempts = 5000; // Increased attempts for better placement
        const treeWidth = 60;
        const treeHeight = 80;
        
        // Reduced padding for mobile to maximize usable space
        // Allow trees higher up on screen
        const padding = 30;
        const minX = padding;
        const maxX = this.canvas.width - padding;
        const minY = padding + 20; // Allow trees much higher up
        const maxY = this.canvas.height - padding - 30; // Reduced bottom space
        
        console.log('Creating trees in area:', {
            width: maxX - minX,
            height: maxY - minY,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        });
        
        for (let i = 0; i < treeCount; i++) {
            let attempts = 0;
            let validPosition = false;
            let x, y;
            
            // Try grid-based placement first for better distribution
            if (i < 6) {
                // First 6 trees: try grid positions
                const cols = 3;
                const rows = 2;
                const col = i % cols;
                const row = Math.floor(i / cols);
                const gridX = minX + (col + 0.5) * (maxX - minX) / cols;
                const gridY = minY + (row + 0.5) * (maxY - minY) / rows;
                
                // Add some randomness to grid position
                x = gridX + (Math.random() - 0.5) * ((maxX - minX) / cols * 0.6);
                y = gridY + (Math.random() - 0.5) * ((maxY - minY) / rows * 0.6);
                
                // Check if this grid position is valid
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
            }
            
            // If grid placement didn't work or we're past 6 trees, use random placement
            if (!validPosition || i >= 6) {
                // Try with strict overlap first
                while (!validPosition && attempts < maxAttempts * 0.7) {
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
                
                // If still no valid position, relax overlap requirement slightly
                if (!validPosition) {
                    console.log(`Relaxing overlap requirement for tree ${i + 1}`);
                    while (!validPosition && attempts < maxAttempts) {
                        x = minX + Math.random() * (maxX - minX);
                        y = minY + Math.random() * (maxY - minY);
                        
                        // Check overlap with existing trees using relaxed check
                        validPosition = true;
                        for (const existingTree of this.trees) {
                            // Use tree centers for distance calculation
                            const center1X = x;
                            const center1Y = y + treeHeight / 3;
                            const center2X = existingTree.x;
                            const center2Y = existingTree.y + existingTree.height / 3;
                            const dx = center1X - center2X;
                            const dy = center1Y - center2Y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const r1 = this.getHitboxRadius({ x, y, width: treeWidth, height: treeHeight });
                            const r2 = this.getHitboxRadius(existingTree);
                            // Relaxed: allow up to 15% overlap if needed
                            const minDistance = (r1 + r2) * 0.85;
                            if (distance < minDistance) {
                                validPosition = false;
                                break;
                            }
                        }
                        
                        attempts++;
                    }
                }
            }
            
            // Always place the tree, even if overlap is slightly more than ideal
            if (!validPosition) {
                console.warn(`Could not place tree ${i + 1} optimally, placing anyway`);
                // Find position with minimum overlap
                let bestX = minX + Math.random() * (maxX - minX);
                let bestY = minY + Math.random() * (maxY - minY);
                let minOverlap = Infinity;
                
                for (let tryAttempt = 0; tryAttempt < 100; tryAttempt++) {
                    const testX = minX + Math.random() * (maxX - minX);
                    const testY = minY + Math.random() * (maxY - minY);
                    let maxOverlap = 0;
                    
                    for (const existingTree of this.trees) {
                        // Use tree centers for distance calculation
                        const center1X = testX;
                        const center1Y = testY + treeHeight / 3;
                        const center2X = existingTree.x;
                        const center2Y = existingTree.y + existingTree.height / 3;
                        const dx = center1X - center2X;
                        const dy = center1Y - center2Y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const r1 = this.getHitboxRadius({ x: testX, y: testY, width: treeWidth, height: treeHeight });
                        const r2 = this.getHitboxRadius(existingTree);
                        const overlapArea = this.calculateCircleOverlap(r1, r2, distance);
                        const smallerRadius = Math.min(r1, r2);
                        const smallerArea = Math.PI * smallerRadius * smallerRadius;
                        const overlapPct = (overlapArea / smallerArea) * 100;
                        maxOverlap = Math.max(maxOverlap, overlapPct);
                    }
                    
                    if (maxOverlap < minOverlap) {
                        minOverlap = maxOverlap;
                        bestX = testX;
                        bestY = testY;
                    }
                }
                
                x = bestX;
                y = bestY;
                console.log(`Placed tree ${i + 1} at (${Math.round(x)}, ${Math.round(y)}) with ${Math.round(minOverlap)}% max overlap`);
            }
            
            this.trees.push({
                x: x,
                y: y,
                width: treeWidth,
                height: treeHeight,
                lightsOn: true,
                index: i
            });
            console.log(`Placed tree ${i + 1} at (${Math.round(x)}, ${Math.round(y)})`);
        }
        
        console.log(`Created ${this.trees.length} trees`);
        
        // Update display to show correct tree count
        if (this.lightsOnElement) {
            const lightsOnCount = this.trees.filter(t => t.lightsOn).length;
            this.lightsOnElement.textContent = lightsOnCount + '/' + this.trees.length;
        }
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
        // First check if tap is on Santa - instant game over!
        const santaCenterX = this.santa.x;
        const santaCenterY = this.santa.y - this.santa.height / 2;
        const santaDx = x - santaCenterX;
        const santaDy = y - santaCenterY;
        const santaDistance = Math.sqrt(santaDx * santaDx + santaDy * santaDy);
        const santaHitRadius = Math.max(this.santa.width / 2, this.santa.height / 2) + 20;
        
        if (santaDistance < santaHitRadius) {
            console.log('Santa tapped! Game over!');
            this.santaTapped = true;
            this.gameState = 'gameover';
            this.endGame();
            return;
        }
        
        // Check if tap is on a tree
        let tapped = false;
        for (const tree of this.trees) {
            // Tree is drawn with base at (x, y), trunk at bottom, star at top
            // Tree extends from y - 5 (star) to y + height (trunk bottom)
            // Visual center is approximately at y + height/2
            const treeCenterX = tree.x;
            // Center is between the base (y) and the middle of the tree
            // Since tree layers go from y to y + 2*height/3, and star is at y-5,
            // the center is approximately at y + height/3
            const treeCenterY = tree.y + tree.height / 3;
            
            const dx = x - treeCenterX;
            const dy = y - treeCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if tap is within tree hitbox (same calculation as in checkOverlap)
            const hitRadius = this.getHitboxRadius(tree);
            if (distance < hitRadius) {
                tree.lightsOn = true;
                tapped = true;
                console.log('Tree tapped!', tree.index, 'center at', treeCenterX, treeCenterY, 'click at', x, y, 'distance', distance, 'hitRadius', hitRadius);
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
        
        // Update display with correct tree count
        const lightsOnCount = this.trees.filter(t => t.lightsOn).length;
        this.lightsOnElement.textContent = lightsOnCount + '/' + this.trees.length;
        
        this.gameState = 'playing';
        this.gameTime = 0;
        this.lastTime = Date.now();
        this.lastTurnOffTime = 0;
        this.treesToTurnOff = [];
        this.santaTapped = false;
        
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
        
        // Schedule trees to turn off: one per second from 2s until 1 second before end (19s)
        // Game ends at 20s, so trees turn off until 19s
        // Schedule based on actual number of trees placed
        const treeCount = this.trees.length;
        const gameDuration = 20; // Total game time in seconds
        const lastTurnOffSecond = gameDuration - 1; // 19 seconds (1 second before end)
        
        // Calculate how many seconds we have to turn off trees (from 2s to 19s = 18 seconds)
        const turnOffDuration = lastTurnOffSecond - 2 + 1; // 18 seconds (2, 3, 4, ..., 19)
        
        // Turn off trees one per second, but if we have more trees than seconds,
        // we'll turn off multiple trees in the same second
        for (let i = 0; i < treeCount; i++) {
            // Distribute trees across the available seconds
            const secondIndex = i % turnOffDuration;
            const turnOffTime = 2 + secondIndex;
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
        this.santaTapped = false;
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
        // Trees turn off from 2s until 1 second before end (19s)
        const currentSecond = Math.floor(this.gameTime);
        const lastTurnOffSecond = 19; // 1 second before game ends at 20s
        
        if (currentSecond >= 2 && currentSecond <= lastTurnOffSecond && currentSecond !== this.lastTurnOffTime) {
            // Find all trees scheduled to turn off at this second
            const treesToTurnOffNow = this.treesToTurnOff.filter(time => time === currentSecond);
            
            if (treesToTurnOffNow.length > 0) {
                // Find trees that are still on
                const onTrees = this.trees.filter(t => t.lightsOn);
                
                // Turn off as many trees as scheduled for this second (or as many as are available)
                const treesToTurnOff = Math.min(treesToTurnOffNow.length, onTrees.length);
                
                for (let i = 0; i < treesToTurnOff; i++) {
                    if (onTrees.length > 0) {
                        const randomTree = onTrees[Math.floor(Math.random() * onTrees.length)];
                        randomTree.lightsOn = false;
                        // Remove from onTrees array
                        const index = onTrees.indexOf(randomTree);
                        onTrees.splice(index, 1);
                    }
                }
                
                // Remove all instances of this second from the schedule
                this.treesToTurnOff = this.treesToTurnOff.filter(time => time !== currentSecond);
                this.lastTurnOffTime = currentSecond;
            }
        }
        
        // Update Santa's movement - move towards unlit trees
        const unlitTrees = this.trees.filter(t => !t.lightsOn);
        
        if (unlitTrees.length > 0) {
            // Find the nearest unlit tree
            let nearestTree = null;
            let nearestDistance = Infinity;
            
            for (const tree of unlitTrees) {
                const treeCenterX = tree.x;
                const treeCenterY = tree.y + tree.height / 3;
                const dx = treeCenterX - this.santa.x;
                const dy = treeCenterY - this.santa.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestTree = tree;
                }
            }
            
            // Move towards the nearest unlit tree
            if (nearestTree) {
                const treeCenterX = nearestTree.x;
                const treeCenterY = nearestTree.y + nearestTree.height / 3;
                const dx = treeCenterX - this.santa.x;
                const dy = treeCenterY - this.santa.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 10) {
                    // Increased speed - Santa moves faster
                    const speed = 120; // pixels per second (increased from 80)
                    this.santa.speedX = (dx / distance) * speed;
                    this.santa.speedY = (dy / distance) * speed;
                    
                    this.santa.x += this.santa.speedX * deltaTime;
                    this.santa.y += this.santa.speedY * deltaTime;
                } else {
                    this.santa.speedX = 0;
                    this.santa.speedY = 0;
                }
            }
        } else {
            // All trees are lit - Santa wanders randomly
            this.santa.wanderTimer -= deltaTime;
            if (this.santa.wanderTimer <= 0) {
                // Pick a new random target
                const padding = 50;
                this.santa.targetX = padding + Math.random() * (this.canvas.width - 2 * padding);
                this.santa.targetY = padding + Math.random() * (this.canvas.height - 2 * padding);
                this.santa.wanderTimer = 2 + Math.random() * 3; // Wander for 2-5 seconds
            }
            
            // Move Santa towards random target
            const dx = this.santa.targetX - this.santa.x;
            const dy = this.santa.targetY - this.santa.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) {
                const speed = 120; // pixels per second (increased from 80)
                this.santa.speedX = (dx / distance) * speed;
                this.santa.speedY = (dy / distance) * speed;
                
                this.santa.x += this.santa.speedX * deltaTime;
                this.santa.y += this.santa.speedY * deltaTime;
            } else {
                this.santa.speedX = 0;
                this.santa.speedY = 0;
            }
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
        this.lightsOnElement.textContent = lightsOnCount + '/' + this.trees.length;
        
        // Check game end condition at 20 seconds
        if (this.gameTime >= 20) {
            this.endGame();
        }
    }
    
    endGame() {
        this.gameState = 'gameover';
        const treeCount = this.trees.length;
        const allLightsOn = this.lightsOn === treeCount;
        
        if (this.santaTapped) {
            // Santa was tapped - instant game over
            document.getElementById('modalTitle').textContent = '🎄 Oh No! 🎄';
            document.getElementById('modalMessage').textContent = "You tapped Santa! Don't let him catch you - he's trying to turn off the lights!";
            document.getElementById('modalStats').textContent = `You had ${this.lightsOn} out of ${treeCount} trees lit.`;
            const vrButton = document.getElementById('vrButton');
            if (vrButton) {
                vrButton.style.display = 'none';
            }
            this.modalOverlay.classList.add('show');
        } else if (allLightsOn) {
            // Victory!
            document.getElementById('modalTitle').textContent = '🎄 Congratulations! 🎄';
            document.getElementById('modalMessage').textContent = "We're going to a VR Game in Antwerp with the entire family! Just need to pick a date... it's going to be awesome.";
            document.getElementById('modalStats').textContent = `All ${treeCount} trees are lit!`;
            // Show VR button
            const vrButton = document.getElementById('vrButton');
            if (vrButton) {
                vrButton.style.display = 'inline-block';
            }
            this.modalOverlay.classList.add('show');
        } else {
            // Game over - time ran out
            document.getElementById('modalTitle').textContent = '🎄 Try Again! 🎄';
            document.getElementById('modalMessage').textContent = `You had ${this.lightsOn} out of ${treeCount} trees lit. Keep all trees lit by 20 seconds to win!`;
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
