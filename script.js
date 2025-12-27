class LaserGame {
    constructor() {
        this.gameArea = document.getElementById('gameArea');
        this.laserCanvas = document.getElementById('laserCanvas');
        this.ctx = this.laserCanvas.getContext('2d');
        this.endpoint = document.getElementById('endpoint');
        this.endpointGlow = document.getElementById('endpointGlow');
        this.endpointCore = document.getElementById('endpointCore');
        this.modalOverlay = document.getElementById('modalOverlay');
        this.modalClose = document.getElementById('modalClose');
        
        this.mirrors = [];
        this.laserPath = [];
        this.isCharging = false;
        this.chargeProgress = 0;
        this.chargeStartTime = null;
        this.animationFrame = null;
        
        this.setupCanvas();
        this.createMirrors();
        this.setupEventListeners();
        this.startLaser();
    }
    
    setupCanvas() {
        const rect = this.gameArea.getBoundingClientRect();
        this.laserCanvas.width = rect.width;
        this.laserCanvas.height = rect.height;
        this.gameWidth = rect.width;
        this.gameHeight = rect.height;
        
        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            const rect = this.gameArea.getBoundingClientRect();
            this.laserCanvas.width = rect.width;
            this.laserCanvas.height = rect.height;
            this.gameWidth = rect.width;
            this.gameHeight = rect.height;
            this.updateLaser();
        });
    }
    
    createMirrors() {
        // Create 3-4 mirrors at random positions
        const mirrorCount = 4;
        for (let i = 0; i < mirrorCount; i++) {
            const mirror = document.createElement('div');
            mirror.className = 'mirror';
            
            // Random position, avoiding center and edges
            const x = Math.random() * (this.gameWidth - 200) + 100;
            const y = Math.random() * (this.gameHeight - 200) + 100;
            
            // Random angle
            const angle = Math.random() * 360;
            
            mirror.style.left = x + 'px';
            mirror.style.top = y + 'px';
            mirror.style.transform = `rotate(${angle}deg)`;
            
            // Store mirror data
            const mirrorData = {
                element: mirror,
                x: x + 40, // center x
                y: y + 4,  // center y
                angle: angle * Math.PI / 180,
                width: 80,
                height: 8,
                isDragging: false,
                dragOffset: { x: 0, y: 0 }
            };
            
            this.mirrors.push(mirrorData);
            this.gameArea.appendChild(mirror);
            
            this.setupMirrorDrag(mirror, mirrorData);
        }
    }
    
    setupMirrorDrag(mirror, mirrorData) {
        let isDragging = false;
        let startX, startY, startAngle;
        
        mirror.addEventListener('mousedown', (e) => {
            if (e.target === mirror || mirror.contains(e.target)) {
                isDragging = true;
                mirror.classList.add('dragging');
                const rect = mirror.getBoundingClientRect();
                const gameRect = this.gameArea.getBoundingClientRect();
                
                startX = e.clientX - gameRect.left;
                startY = e.clientY - gameRect.top;
                startAngle = mirrorData.angle;
                
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const gameRect = this.gameArea.getBoundingClientRect();
                const newX = e.clientX - gameRect.left;
                const newY = e.clientY - gameRect.top;
                
                // Update position
                mirrorData.x = newX;
                mirrorData.y = newY;
                mirror.style.left = (newX - 40) + 'px';
                mirror.style.top = (newY - 4) + 'px';
                
                this.updateLaser();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                mirror.classList.remove('dragging');
                this.updateLaser();
            }
        });
        
        // Rotation on right click or double click
        mirror.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            mirrorData.angle += Math.PI / 4; // 45 degrees
            mirror.style.transform = `rotate(${mirrorData.angle * 180 / Math.PI}deg)`;
            this.updateLaser();
        });
    }
    
    startLaser() {
        // Laser starts from top center, pointing down
        const startX = this.gameWidth / 2;
        const startY = 20;
        const angle = Math.PI / 2; // Pointing down
        
        this.updateLaser();
        this.animate();
    }
    
    updateLaser() {
        this.laserPath = [];
        
        const startX = this.gameWidth / 2;
        const startY = 20;
        let currentX = startX;
        let currentY = startY;
        let currentAngle = Math.PI / 2; // Pointing down
        const maxBounces = 20;
        const stepSize = 2;
        
        this.laserPath.push({ x: currentX, y: currentY });
        
        for (let bounce = 0; bounce < maxBounces; bounce++) {
            let hitMirror = null;
            let minDist = Infinity;
            let hitPoint = null;
            let hitType = null; // 'mirror' or 'endpoint'
            
            // Check collision with mirrors
            for (let mirror of this.mirrors) {
                const intersection = this.lineMirrorIntersection(
                    currentX, currentY, currentAngle, mirror
                );
                
                if (intersection) {
                    const dist = Math.sqrt(
                        Math.pow(intersection.x - currentX, 2) + 
                        Math.pow(intersection.y - currentY, 2)
                    );
                    
                    if (dist < minDist && dist > 5) {
                        minDist = dist;
                        hitMirror = mirror;
                        hitPoint = intersection;
                        hitType = 'mirror';
                    }
                }
            }
            
            // Check collision with endpoint
            const endpointRect = this.endpoint.getBoundingClientRect();
            const gameRect = this.gameArea.getBoundingClientRect();
            const endpointX = endpointRect.left - gameRect.left + endpointRect.width / 2;
            const endpointY = endpointRect.top - gameRect.top + endpointRect.height / 2;
            const endpointRadius = endpointRect.width / 2;
            
            // Check if laser hits endpoint
            const dx = Math.cos(currentAngle);
            const dy = Math.sin(currentAngle);
            const t = ((endpointX - currentX) * dx + (endpointY - currentY) * dy) / (dx * dx + dy * dy);
            
            if (t > 5 && t < 2000) {
                const closestX = currentX + t * dx;
                const closestY = currentY + t * dy;
                const distToClosest = Math.sqrt(
                    Math.pow(endpointX - closestX, 2) + 
                    Math.pow(endpointY - closestY, 2)
                );
                
                if (distToClosest < endpointRadius + 5) {
                    const distToEndpoint = Math.sqrt(
                        Math.pow(closestX - currentX, 2) + 
                        Math.pow(closestY - currentY, 2)
                    );
                    
                    // Check if endpoint is closer than any mirror
                    if (distToEndpoint < minDist) {
                        // Hit endpoint
                        this.laserPath.push({ x: endpointX, y: endpointY });
                        this.startCharging();
                        return;
                    }
                }
            }
            
            if (hitMirror && hitPoint && hitType === 'mirror') {
                // Add point before mirror
                this.laserPath.push({ x: hitPoint.x, y: hitPoint.y });
                
                // Calculate reflection
                const normalAngle = hitMirror.angle + Math.PI / 2;
                const incidentAngle = currentAngle;
                const reflectionAngle = 2 * normalAngle - incidentAngle;
                
                currentX = hitPoint.x;
                currentY = hitPoint.y;
                currentAngle = reflectionAngle;
            } else {
                // No hit, continue in current direction until wall
                const dx = Math.cos(currentAngle);
                const dy = Math.sin(currentAngle);
                
                // Find which wall is hit first
                let wallHit = null;
                let minWallDist = Infinity;
                
                // Bottom wall
                if (dy > 0) {
                    const t = (this.gameHeight - currentY) / dy;
                    const wallX = currentX + t * dx;
                    if (wallX >= 0 && wallX <= this.gameWidth && t > 0) {
                        if (t < minWallDist) {
                            minWallDist = t;
                            wallHit = { x: wallX, y: this.gameHeight };
                        }
                    }
                }
                
                // Top wall
                if (dy < 0) {
                    const t = (0 - currentY) / dy;
                    const wallX = currentX + t * dx;
                    if (wallX >= 0 && wallX <= this.gameWidth && t > 0) {
                        if (t < minWallDist) {
                            minWallDist = t;
                            wallHit = { x: wallX, y: 0 };
                        }
                    }
                }
                
                // Left wall
                if (dx < 0) {
                    const t = (0 - currentX) / dx;
                    const wallY = currentY + t * dy;
                    if (wallY >= 0 && wallY <= this.gameHeight && t > 0) {
                        if (t < minWallDist) {
                            minWallDist = t;
                            wallHit = { x: 0, y: wallY };
                        }
                    }
                }
                
                // Right wall
                if (dx > 0) {
                    const t = (this.gameWidth - currentX) / dx;
                    const wallY = currentY + t * dy;
                    if (wallY >= 0 && wallY <= this.gameHeight && t > 0) {
                        if (t < minWallDist) {
                            minWallDist = t;
                            wallHit = { x: this.gameWidth, y: wallY };
                        }
                    }
                }
                
                if (wallHit) {
                    this.laserPath.push(wallHit);
                }
                break;
            }
        }
        
        this.stopCharging();
    }
    
    lineMirrorIntersection(x, y, angle, mirror) {
        // Mirror endpoints
        const halfWidth = mirror.width / 2;
        const mirrorX1 = mirror.x - halfWidth * Math.cos(mirror.angle);
        const mirrorY1 = mirror.y - halfWidth * Math.sin(mirror.angle);
        const mirrorX2 = mirror.x + halfWidth * Math.cos(mirror.angle);
        const mirrorY2 = mirror.y + halfWidth * Math.sin(mirror.angle);
        
        // Laser ray (extended far)
        const rayX1 = x;
        const rayY1 = y;
        const rayX2 = x + Math.cos(angle) * 2000;
        const rayY2 = y + Math.sin(angle) * 2000;
        
        // Line segment intersection algorithm
        const denom = (rayX1 - rayX2) * (mirrorY1 - mirrorY2) - (rayY1 - rayY2) * (mirrorX1 - mirrorX2);
        
        if (Math.abs(denom) < 0.0001) {
            return null; // Lines are parallel
        }
        
        const t = ((rayX1 - mirrorX1) * (mirrorY1 - mirrorY2) - (rayY1 - mirrorY1) * (mirrorX1 - mirrorX2)) / denom;
        const u = -((rayX1 - rayX2) * (rayY1 - mirrorY1) - (rayY1 - rayY2) * (rayX1 - mirrorX1)) / denom;
        
        // Check if intersection is within both segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const intersectionX = rayX1 + t * (rayX2 - rayX1);
            const intersectionY = rayY1 + t * (rayY2 - rayY1);
            
            // Make sure the intersection is in the forward direction
            const dist = Math.sqrt(Math.pow(intersectionX - x, 2) + Math.pow(intersectionY - y, 2));
            if (dist > 5) { // Minimum distance to avoid self-intersection
                return { x: intersectionX, y: intersectionY };
            }
        }
        
        return null;
    }
    
    startCharging() {
        if (this.isCharging) return;
        
        this.isCharging = true;
        this.chargeStartTime = Date.now();
        this.endpointGlow.classList.add('charging');
        this.endpointCore.classList.add('charged');
    }
    
    stopCharging() {
        if (!this.isCharging) return;
        
        this.isCharging = false;
        this.chargeProgress = 0;
        this.chargeStartTime = null;
        this.endpointGlow.classList.remove('charging');
        this.endpointCore.classList.remove('charged');
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);
        
        // Draw laser path
        if (this.laserPath.length > 1) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ff0000';
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.laserPath[0].x, this.laserPath[0].y);
            
            for (let i = 1; i < this.laserPath.length; i++) {
                this.ctx.lineTo(this.laserPath[i].x, this.laserPath[i].y);
            }
            
            this.ctx.stroke();
            
            // Draw laser source
            this.ctx.fillStyle = '#ff0000';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(this.laserPath[0].x, this.laserPath[0].y, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Update charging progress
        if (this.isCharging) {
            const elapsed = Date.now() - this.chargeStartTime;
            this.chargeProgress = Math.min(elapsed / 2000, 1); // 2 seconds
            
            if (this.chargeProgress >= 1) {
                this.showModal();
                this.stopCharging();
            }
        }
        
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    showModal() {
        this.modalOverlay.classList.add('show');
    }
    
    setupEventListeners() {
        this.modalClose.addEventListener('click', () => {
            this.modalOverlay.classList.remove('show');
        });
        
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.modalOverlay.classList.remove('show');
            }
        });
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new LaserGame();
});

