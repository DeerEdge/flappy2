import {
  GameState,
  GameConfig,
  GameMode,
  Pipe,
  Bird,
  PowerUp,
  PowerUpType,
  Obstacle,
  ObstacleType,
  DEFAULT_CONFIG,
  BIRD_CONFIG,
  COLORS,
  MODE_NAMES,
  MODE_COLORS,
} from './types';

export class FlappyEngine {
  private state: GameState;
  private config: GameConfig;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private onScoreChange?: (score: number) => void;
  private onGameOver?: (score: number) => void;
  private lastObstacleSpawn: number = 0;

  constructor(
    ctx: CanvasRenderingContext2D,
    gameMode: GameMode,
    onScoreChange?: (score: number) => void,
    onGameOver?: (score: number) => void,
    debugState?: 'start' | 'playing' | 'gameover'
  ) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG };
    this.onScoreChange = onScoreChange;
    this.onGameOver = onGameOver;
    this.state = this.createInitialState(gameMode);
    
    if (debugState) {
      this.state.debugMode = true;
      this.state.forcedState = debugState;
      this.setupDebugState(debugState);
    }
  }

  private setupDebugState(debugState: 'start' | 'playing' | 'gameover'): void {
    switch (debugState) {
      case 'playing':
        this.state.isPlaying = true;
        this.state.score = 5;
        this.state.frameCount = 100;
        if (this.state.gameMode !== 'obstacles') {
          this.spawnPipe();
          this.state.pipes[0].x = 200;
        } else {
          this.spawnObstacle();
        }
        break;
      case 'gameover':
        this.state.gameOver = true;
        this.state.isPlaying = false;
        this.state.score = 42;
        this.state.highScore = 100;
        this.state.frameCount = 100;
        break;
    }
  }

  private createInitialState(gameMode: GameMode): GameState {
    return {
      bird: {
        x: BIRD_CONFIG.x,
        y: BIRD_CONFIG.startY,
        width: BIRD_CONFIG.width,
        height: BIRD_CONFIG.height,
        velocity: 0,
        rotation: 0,
      },
      pipes: [],
      obstacles: [],
      score: 0,
      highScore: 0,
      gameOver: false,
      isPlaying: false,
      frameCount: 0,
      gameMode,
      activePowerUps: [],
      hasShield: false,
      collectEffect: null,
    };
  }

  public start(): void {
    this.state.isPlaying = true;
    this.state.gameOver = false;
    this.lastTime = performance.now();
    this.lastObstacleSpawn = 0;
    this.gameLoop();
  }

  public reset(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    const highScore = Math.max(this.state.highScore, this.state.score);
    this.state = this.createInitialState(this.state.gameMode);
    this.state.highScore = highScore;
    this.lastObstacleSpawn = 0;
    this.render();
  }

  public flap(): void {
    if (this.state.gameOver) return;
    
    if (!this.state.isPlaying) {
      this.start();
    }
    
    this.state.bird.velocity = this.config.flapStrength;
  }

  public isGameOver(): boolean {
    return this.state.gameOver;
  }

  public setGameMode(mode: GameMode): void {
    this.state.gameMode = mode;
    this.reset();
  }

  public getState(): GameState {
    return this.state;
  }

  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    if (deltaTime >= 16.67) {
      this.update();
      this.render();
      this.lastTime = currentTime;
    }
    
    if (!this.state.gameOver) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  private update(): void {
    if (!this.state.isPlaying || this.state.gameOver) return;

    this.state.frameCount++;
    
    // Clear expired collect effects
    if (this.state.collectEffect) {
      const elapsed = Date.now() - this.state.collectEffect.startTime;
      if (elapsed > this.state.collectEffect.duration) {
        this.state.collectEffect = null;
      }
    }
    
    this.updatePowerUps();
    const speedMod = this.getSpeedModifier();
    this.updateBird(speedMod);
    
    // Different update logic based on mode
    if (this.state.gameMode === 'obstacles') {
      this.updateObstaclesMode(speedMod);
      // Time-based scoring for survival mode
      if (this.state.frameCount % 60 === 0) {
        this.state.score++;
        if (this.onScoreChange) {
          this.onScoreChange(this.state.score);
        }
      }
    } else {
      this.updatePipes(speedMod);
      if (this.state.frameCount % this.config.pipeSpawnInterval === 0) {
        this.spawnPipe();
      }
      this.checkPipeCollisions();
      this.checkScore();
    }
  }

  private updateBird(speedMod: number): void {
    const bird = this.state.bird;
    
    bird.velocity += this.config.gravity * speedMod;
    bird.y += bird.velocity * speedMod;
    bird.rotation = Math.min(Math.max(bird.velocity * 3, -30), 90);
    
    const groundY = this.config.canvasHeight - this.config.groundHeight;
    if (bird.y + bird.height > groundY) {
      bird.y = groundY - bird.height;
      this.handleCollision();
    }
    
    if (bird.y < 0) {
      bird.y = 0;
      bird.velocity = 0;
    }
  }

  private updatePipes(speedMod: number): void {
    const speed = this.config.pipeSpeed * speedMod;
    
    this.state.pipes = this.state.pipes.filter(pipe => {
      pipe.x -= speed;
      
      if (pipe.powerUp && !pipe.powerUp.collected) {
        pipe.powerUp.x = pipe.x + this.config.pipeWidth + 20;
      }
      
      return pipe.x + pipe.width > -50;
    });
  }

  // ========== OBSTACLES MODE ==========
  
  private updateObstaclesMode(speedMod: number): void {
    const speed = this.config.pipeSpeed * speedMod;
    
    // Update existing obstacles
    this.state.obstacles = this.state.obstacles.filter(obs => {
      obs.x -= speed;
      
      switch (obs.type) {
        case 'laser':
          this.updateLaser(obs);
          break;
        case 'meteor':
          this.updateMeteor(obs, speedMod);
          break;
        case 'barrier':
          this.updateBarrier(obs);
          break;
      }
      
      return obs.x + obs.width > -50;
    });
    
    // Spawn new obstacles - slower spawn rate for easier gameplay
    this.lastObstacleSpawn++;
    const spawnInterval = 120 + Math.random() * 60; // Longer intervals between obstacles
    if (this.lastObstacleSpawn > spawnInterval) {
      this.spawnObstacle();
      this.lastObstacleSpawn = 0;
    }
    
    // Check collisions
    this.checkObstacleCollisions();
  }

  private updateLaser(obs: Obstacle): void {
    if (obs.toggleTimer === undefined) obs.toggleTimer = 0;
    obs.toggleTimer++;
    
    const onTime = obs.onTime || 90;
    const offTime = obs.offTime || 60;
    const cycle = onTime + offTime;
    const inCycle = obs.toggleTimer % cycle;
    
    obs.isOn = inCycle < onTime;
  }

  private updateMeteor(obs: Obstacle, speedMod: number): void {
    if (obs.velocityY !== undefined) {
      obs.y += obs.velocityY * speedMod;
    }
  }

  private updateBarrier(obs: Obstacle): void {
    if (obs.gapY !== undefined && obs.direction !== undefined && obs.speed !== undefined) {
      obs.gapY += obs.direction * obs.speed;
      
      if (obs.minY !== undefined && obs.maxY !== undefined) {
        if (obs.gapY <= obs.minY || obs.gapY >= obs.maxY) {
          obs.direction *= -1;
        }
      }
    }
  }

  private spawnObstacle(): void {
    const types: ObstacleType[] = ['spike', 'laser', 'portal', 'meteor', 'barrier'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const groundY = this.config.canvasHeight - this.config.groundHeight;
    
    let obstacle: Obstacle;
    
    switch (type) {
      case 'spike':
        const onGround = Math.random() > 0.5;
        obstacle = {
          type: 'spike',
          x: this.config.canvasWidth,
          y: onGround ? groundY - 30 : 0, // Smaller spikes
          width: 30,
          height: 30,
          active: true,
          passed: false,
          position: onGround ? 'ground' : 'ceiling',
        };
        break;
        
      case 'laser':
        const laserY = 100 + Math.random() * (groundY - 200);
        obstacle = {
          type: 'laser',
          x: this.config.canvasWidth,
          y: laserY,
          width: 80,
          height: 8,
          active: true,
          passed: false,
          onTime: 90,
          offTime: 60,
          isOn: true,
          toggleTimer: 0,
        };
        break;
        
      case 'portal':
        const portalY = 80 + Math.random() * (groundY - 160);
        obstacle = {
          type: 'portal',
          x: this.config.canvasWidth,
          y: portalY,
          width: 50,
          height: 50,
          active: true,
          passed: false,
          teleported: false,
        };
        break;
        
      case 'meteor':
        obstacle = {
          type: 'meteor',
          x: this.config.canvasWidth,
          y: -30,
          width: 25, // Slightly smaller
          height: 25,
          active: true,
          passed: false,
          velocityX: -1.5,
          velocityY: 2 + Math.random() * 1.5, // Slower fall
        };
        break;
        
      case 'barrier':
        const gapHeight = 150; // Larger gap for easier passage
        const gapY = 80 + Math.random() * (groundY - gapHeight - 120);
        obstacle = {
          type: 'barrier',
          x: this.config.canvasWidth,
          y: 0,
          width: 30,
          height: groundY,
          active: true,
          passed: false,
          gapY,
          gapHeight,
          direction: Math.random() > 0.5 ? 1 : -1,
          speed: 1, // Slower movement
          minY: 50,
          maxY: groundY - gapHeight - 50,
        };
        break;
        
      default:
        return;
    }
    
    this.state.obstacles.push(obstacle);
  }

  private checkObstacleCollisions(): void {
    const bird = this.state.bird;
    const birdBox = {
      x: bird.x + 4,
      y: bird.y + 4,
      width: bird.width - 8,
      height: bird.height - 8,
    };
    
    for (const obs of this.state.obstacles) {
      if (!obs.active) continue;
      
      switch (obs.type) {
        case 'spike':
          if (this.checkAABBCollision(birdBox, obs)) {
            this.handleCollision();
            return;
          }
          break;
          
        case 'laser':
          if (obs.isOn && this.checkAABBCollision(birdBox, obs)) {
            this.handleCollision();
            return;
          }
          break;
          
        case 'portal':
          if (!obs.teleported && this.checkAABBCollision(birdBox, obs)) {
            // Teleport bird to random Y position
            const groundY = this.config.canvasHeight - this.config.groundHeight;
            this.state.bird.y = 50 + Math.random() * (groundY - 150);
            this.state.bird.velocity = 0;
            obs.teleported = true;
            // Bonus points for portal
            this.state.score += 3;
            if (this.onScoreChange) {
              this.onScoreChange(this.state.score);
            }
          }
          break;
          
        case 'meteor':
          if (this.checkAABBCollision(birdBox, obs)) {
            this.handleCollision();
            return;
          }
          break;
          
        case 'barrier':
          if (obs.gapY !== undefined && obs.gapHeight !== undefined) {
            // Check if bird is NOT in the gap
            const inGap = birdBox.y > obs.gapY && 
                          birdBox.y + birdBox.height < obs.gapY + obs.gapHeight;
            
            if (this.checkAABBCollision(birdBox, { x: obs.x, y: obs.y, width: obs.width, height: this.config.canvasHeight }) && !inGap) {
              this.handleCollision();
              return;
            }
          }
          break;
      }
    }
  }

  private checkAABBCollision(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // ========== PIPE MODE (Classic & Power-ups) ==========

  private spawnPipe(): void {
    const minHeight = 50;
    const maxHeight = this.config.canvasHeight - this.config.groundHeight - this.config.pipeGap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    
    const pipe: Pipe = {
      x: this.config.canvasWidth,
      topHeight,
      bottomY: topHeight + this.config.pipeGap,
      width: this.config.pipeWidth,
      passed: false,
    };
    
    // Power-ups for modified mode (higher spawn rate)
    if (this.state.gameMode === 'modified' && Math.random() < 0.4) {
      const powerUpTypes: PowerUpType[] = ['shield', 'slowmo', 'double'];
      const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      
      pipe.powerUp = {
        type,
        x: this.config.canvasWidth + this.config.pipeWidth + 20,
        y: topHeight + this.config.pipeGap / 2 - 15,
        width: 30,
        height: 30,
        collected: false,
      };
    }
    
    this.state.pipes.push(pipe);
  }

  private checkPipeCollisions(): void {
    const bird = this.state.bird;
    
    // First pass: check power-up collection (separate from pipe collision)
    for (const pipe of this.state.pipes) {
      if (pipe.powerUp && !pipe.powerUp.collected) {
        if (this.checkPowerUpCollision(bird, pipe.powerUp)) {
          this.collectPowerUp(pipe.powerUp);
        }
      }
    }
    
    // Second pass: check pipe collisions
    const birdBox = {
      x: bird.x + 4,
      y: bird.y + 4,
      width: bird.width - 8,
      height: bird.height - 8,
    };
    
    for (const pipe of this.state.pipes) {
      // Top pipe collision
      if (
        birdBox.x < pipe.x + pipe.width &&
        birdBox.x + birdBox.width > pipe.x &&
        birdBox.y < pipe.topHeight
      ) {
        this.handleCollision();
        return;
      }
      
      // Bottom pipe collision
      if (
        birdBox.x < pipe.x + pipe.width &&
        birdBox.x + birdBox.width > pipe.x &&
        birdBox.y + birdBox.height > pipe.bottomY
      ) {
        this.handleCollision();
        return;
      }
    }
  }

  private checkPowerUpCollision(bird: Bird, powerUp: PowerUp): boolean {
    return (
      bird.x < powerUp.x + powerUp.width &&
      bird.x + bird.width > powerUp.x &&
      bird.y < powerUp.y + powerUp.height &&
      bird.y + bird.height > powerUp.y
    );
  }

  private collectPowerUp(powerUp: PowerUp): void {
    powerUp.collected = true;
    
    // Add visual feedback effect
    this.state.collectEffect = {
      type: powerUp.type,
      startTime: Date.now(),
      duration: 500,
    };
    
    const duration = powerUp.type === 'shield' ? 0 : 5000;
    
    if (powerUp.type === 'shield') {
      this.state.hasShield = true;
    } else {
      // Remove existing power-up of same type
      this.state.activePowerUps = this.state.activePowerUps.filter(
        p => p.type !== powerUp.type
      );
      
      this.state.activePowerUps.push({
        type: powerUp.type,
        endTime: Date.now() + duration,
      });
    }
  }

  private updatePowerUps(): void {
    const now = Date.now();
    this.state.activePowerUps = this.state.activePowerUps.filter(
      p => p.endTime > now
    );
  }

  private getSpeedModifier(): number {
    const hasSlowMo = this.state.activePowerUps.some(p => p.type === 'slowmo');
    return hasSlowMo ? 0.5 : 1;
  }

  private getScoreMultiplier(): number {
    const hasDouble = this.state.activePowerUps.some(p => p.type === 'double');
    return hasDouble ? 2 : 1;
  }

  private handleCollision(): void {
    if (this.state.hasShield) {
      this.state.hasShield = false;
      return;
    }
    
    this.state.gameOver = true;
    this.state.isPlaying = false;
    this.state.highScore = Math.max(this.state.highScore, this.state.score);
    
    if (this.onGameOver) {
      this.onGameOver(this.state.score);
    }
  }

  private checkScore(): void {
    const bird = this.state.bird;
    
    for (const pipe of this.state.pipes) {
      if (!pipe.passed && pipe.x + pipe.width < bird.x) {
        pipe.passed = true;
        const points = 1 * this.getScoreMultiplier();
        this.state.score += points;
        
        if (this.onScoreChange) {
          this.onScoreChange(this.state.score);
        }
      }
    }
  }

  // ========== RENDERING ==========

  public render(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Dark arcade sky with gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight - groundHeight);
    skyGradient.addColorStop(0, '#0a0a1a');
    skyGradient.addColorStop(0.5, COLORS.sky);
    skyGradient.addColorStop(1, COLORS.skyLight);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight - groundHeight);
    
    this.renderStars();
    this.renderGrid();
    
    // Render mode-specific elements
    if (this.state.gameMode === 'obstacles') {
      this.renderObstacles();
    } else {
      this.renderPipes();
    }
    
    this.renderGround();
    this.renderBird();
    
    // Render power-up collection effect
    this.renderCollectEffect();
    
    // Slow-mo screen tint
    if (this.state.activePowerUps.some(p => p.type === 'slowmo')) {
      ctx.fillStyle = 'rgba(255, 0, 255, 0.1)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    
    // Double points indicator
    if (this.state.activePowerUps.some(p => p.type === 'double')) {
      this.renderDoublePointsIndicator();
    }
    
    // Score during gameplay
    if (this.state.isPlaying && !this.state.gameOver) {
      this.renderScore();
    }
    
    if (this.state.gameMode === 'modified') {
      this.renderPowerUpIndicators();
    }
    
    if (this.state.gameOver) {
      this.renderGameOver();
    } else if (!this.state.isPlaying) {
      this.renderStartScreen();
    }
  }

  private renderCollectEffect(): void {
    if (!this.state.collectEffect) return;
    
    const ctx = this.ctx;
    const elapsed = Date.now() - this.state.collectEffect.startTime;
    const progress = elapsed / this.state.collectEffect.duration;
    
    if (progress >= 1) return;
    
    const alpha = 0.3 * (1 - progress);
    const color = COLORS[this.state.collectEffect.type];
    
    // Flash screen with power-up color
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
    ctx.globalAlpha = 1;
  }

  private renderDoublePointsIndicator(): void {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.shadowColor = COLORS.double;
    ctx.shadowBlur = 15;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.double;
    ctx.fillText('×2', this.config.canvasWidth / 2, 100);
    ctx.restore();
  }

  private renderStars(): void {
    const ctx = this.ctx;
    const { canvasHeight, groundHeight } = this.config;
    
    ctx.fillStyle = '#ffffff';
    const starPositions = [
      [50, 30], [120, 80], [200, 45], [280, 100], [350, 60],
      [80, 150], [160, 120], [240, 180], [320, 140], [380, 90],
      [30, 200], [100, 250], [180, 220], [260, 280], [340, 240],
    ];
    
    for (const [x, y] of starPositions) {
      if (y < canvasHeight - groundHeight - 50) {
        const twinkle = Math.sin(this.state.frameCount * 0.1 + x) > 0.5 ? 2 : 1;
        ctx.fillRect(x, y, twinkle, twinkle);
      }
    }
  }

  private renderGrid(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.05)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < canvasWidth; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight - groundHeight);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvasHeight - groundHeight; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  // ========== OBSTACLE RENDERING ==========

  private renderObstacles(): void {
    for (const obs of this.state.obstacles) {
      switch (obs.type) {
        case 'spike':
          this.renderSpike(obs);
          break;
        case 'laser':
          this.renderLaser(obs);
          break;
        case 'portal':
          this.renderPortal(obs);
          break;
        case 'meteor':
          this.renderMeteor(obs);
          break;
        case 'barrier':
          this.renderBarrier(obs);
          break;
      }
    }
  }

  private renderSpike(obs: Obstacle): void {
    const ctx = this.ctx;
    const isGround = obs.position === 'ground';
    
    ctx.save();
    ctx.shadowColor = COLORS.spike;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.spike;
    
    ctx.beginPath();
    if (isGround) {
      // Triangle pointing up
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
    } else {
      // Triangle pointing down
      ctx.moveTo(obs.x, obs.y);
      ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width, obs.y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Inner highlight
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }

  private renderLaser(obs: Obstacle): void {
    const ctx = this.ctx;
    
    ctx.save();
    
    if (obs.isOn) {
      // Active laser beam
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COLORS.laser;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      
      // Core bright line
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(obs.x, obs.y + obs.height / 2 - 1, obs.width, 2);
    } else {
      // Inactive - just show emitter
      ctx.fillStyle = '#333333';
      ctx.fillRect(obs.x, obs.y, 10, obs.height);
      
      // Blinking warning
      if (Math.floor(this.state.frameCount / 15) % 2 === 0) {
        ctx.fillStyle = COLORS.laser;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.globalAlpha = 1;
      }
    }
    
    ctx.restore();
  }

  private renderPortal(obs: Obstacle): void {
    const ctx = this.ctx;
    const centerX = obs.x + obs.width / 2;
    const centerY = obs.y + obs.height / 2;
    const radius = obs.width / 2;
    
    ctx.save();
    ctx.shadowColor = COLORS.portal;
    ctx.shadowBlur = 25;
    
    // Swirling effect
    const rotation = this.state.frameCount * 0.1;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.portal;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Inner swirl
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rotation + (i * Math.PI * 2) / 3;
      const innerRadius = radius * 0.3;
      const outerRadius = radius * 0.8;
      
      ctx.moveTo(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius
      );
      ctx.lineTo(
        centerX + Math.cos(angle + 0.5) * outerRadius,
        centerY + Math.sin(angle + 0.5) * outerRadius
      );
    }
    ctx.strokeStyle = COLORS.portal;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Center glow
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 0, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 0, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }

  private renderMeteor(obs: Obstacle): void {
    const ctx = this.ctx;
    const centerX = obs.x + obs.width / 2;
    const centerY = obs.y + obs.height / 2;
    
    ctx.save();
    ctx.shadowColor = COLORS.meteor;
    ctx.shadowBlur = 15;
    
    // Trail
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 30, centerY - 20);
    ctx.lineTo(centerX + 25, centerY - 15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 102, 0, 0.5)';
    ctx.fill();
    
    // Main body
    ctx.beginPath();
    ctx.arc(centerX, centerY, obs.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.meteor;
    ctx.fill();
    
    // Hot core
    ctx.beginPath();
    ctx.arc(centerX - 3, centerY - 3, obs.width / 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.textYellow;
    ctx.fill();
    
    ctx.restore();
  }

  private renderBarrier(obs: Obstacle): void {
    const ctx = this.ctx;
    const groundY = this.config.canvasHeight - this.config.groundHeight;
    
    if (obs.gapY === undefined || obs.gapHeight === undefined) return;
    
    ctx.save();
    ctx.shadowColor = COLORS.barrier;
    ctx.shadowBlur = 10;
    
    // Top section
    ctx.fillStyle = '#1a3d1a';
    ctx.fillRect(obs.x, 0, obs.width, obs.gapY);
    ctx.strokeStyle = COLORS.barrier;
    ctx.lineWidth = 3;
    ctx.strokeRect(obs.x, 0, obs.width, obs.gapY);
    
    // Bottom section
    const bottomY = obs.gapY + obs.gapHeight;
    ctx.fillRect(obs.x, bottomY, obs.width, groundY - bottomY);
    ctx.strokeRect(obs.x, bottomY, obs.width, groundY - bottomY);
    
    ctx.restore();
  }

  // ========== PIPE RENDERING ==========

  private renderPipes(): void {
    for (const pipe of this.state.pipes) {
      this.drawPipe(pipe.x, 0, pipe.width, pipe.topHeight, true);
      this.drawPipe(
        pipe.x,
        pipe.bottomY,
        pipe.width,
        this.config.canvasHeight - pipe.bottomY - this.config.groundHeight,
        false
      );
      
      if (pipe.powerUp && !pipe.powerUp.collected) {
        this.renderPowerUp(pipe.powerUp);
      }
    }
  }

  private drawPipe(x: number, y: number, width: number, height: number, isTop: boolean): void {
    const ctx = this.ctx;
    const capHeight = 20;
    const capOverhang = 6;
    
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = '#1a3d1a';
    ctx.fillRect(x + 2, y, width - 4, height);
    
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y, width - 4, height);
    
    const capY = isTop ? y + height - capHeight : y;
    
    ctx.fillStyle = '#1a3d1a';
    ctx.fillRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
    
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
    
    ctx.strokeStyle = COLORS.pipeHighlight;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 2, width - 8, height - 4);
    
    ctx.shadowBlur = 0;
  }

  private renderPowerUp(powerUp: PowerUp): void {
    const ctx = this.ctx;
    const { x, y, width, height, type } = powerUp;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    const pulse = Math.sin(this.state.frameCount * 0.15) * 0.3 + 0.7;
    
    ctx.shadowColor = COLORS[type];
    ctx.shadowBlur = 20 * pulse;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2 + 4, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS[type];
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Inner fill
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[type];
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Icon
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons: Record<PowerUpType, string> = {
      shield: 'S',
      slowmo: 'T',
      double: '2',
    };
    
    ctx.fillText(icons[type], centerX, centerY);
    ctx.shadowBlur = 0;
  }

  private renderGround(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    const groundY = canvasHeight - groundHeight;
    
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, groundY, canvasWidth, groundHeight);
    
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 5;
    ctx.fillStyle = COLORS.pipe;
    ctx.fillRect(0, groundY, canvasWidth, 4);
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = COLORS.groundLight;
    ctx.lineWidth = 1;
    for (let i = 0; i < canvasWidth; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, groundY + 4);
      ctx.lineTo(i + 10, groundY + groundHeight);
      ctx.stroke();
    }
  }

  private renderBird(): void {
    const ctx = this.ctx;
    const bird = this.state.bird;
    
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate((bird.rotation * Math.PI) / 180);
    
    // Shield effect - more prominent
    if (this.state.hasShield) {
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 20;
      
      // Solid bubble
      ctx.beginPath();
      ctx.arc(0, 0, bird.width / 2 + 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.fill();
      
      // Animated ring
      ctx.beginPath();
      ctx.arc(0, 0, bird.width / 2 + 12, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.lineDashOffset = -this.state.frameCount * 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }
    
    // Bird glow
    ctx.shadowColor = COLORS.bird;
    ctx.shadowBlur = 8;
    
    // Bird body
    ctx.fillStyle = COLORS.bird;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = COLORS.birdDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Wing
    const wingY = Math.sin(this.state.frameCount * 0.3) * 3;
    ctx.fillStyle = COLORS.birdDark;
    ctx.beginPath();
    ctx.ellipse(-2, wingY, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye
    ctx.fillStyle = COLORS.birdEye;
    ctx.beginPath();
    ctx.arc(8, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Beak
    ctx.fillStyle = COLORS.birdBeak;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  private renderScore(): void {
    const ctx = this.ctx;
    const hasDouble = this.state.activePowerUps.some(p => p.type === 'double');
    
    ctx.shadowColor = hasDouble ? COLORS.double : COLORS.text;
    ctx.shadowBlur = hasDouble ? 15 : 10;
    
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.state.score.toString(), this.config.canvasWidth / 2, 50);
    
    ctx.fillStyle = hasDouble ? COLORS.double : COLORS.text;
    ctx.fillText(this.state.score.toString(), this.config.canvasWidth / 2, 50);
    
    ctx.shadowBlur = 0;
  }

  private renderPowerUpIndicators(): void {
    const ctx = this.ctx;
    const now = Date.now();
    let offsetX = 10;
    
    for (const powerUp of this.state.activePowerUps) {
      const remaining = Math.max(0, (powerUp.endTime - now) / 1000);
      
      ctx.shadowColor = COLORS[powerUp.type];
      ctx.shadowBlur = 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(offsetX, 10, 35, 35);
      
      ctx.strokeStyle = COLORS[powerUp.type];
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, 10, 35, 35);
      
      // Icon
      ctx.fillStyle = COLORS[powerUp.type];
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const icons: Record<PowerUpType, string> = {
        shield: 'S',
        slowmo: 'T',
        double: '2',
      };
      ctx.fillText(icons[powerUp.type], offsetX + 17.5, 22);
      
      // Timer
      ctx.font = 'bold 9px monospace';
      ctx.fillText(remaining.toFixed(1), offsetX + 17.5, 36);
      
      ctx.shadowBlur = 0;
      offsetX += 40;
    }
    
    if (this.state.hasShield) {
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(offsetX, 10, 35, 35);
      
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, 10, 35, 35);
      
      ctx.fillStyle = COLORS.shield;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', offsetX + 17.5, 22);
      
      ctx.font = 'bold 8px monospace';
      ctx.fillText('READY', offsetX + 17.5, 36);
      
      ctx.shadowBlur = 0;
    }
  }

  private renderStartScreen(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const modeColor = MODE_COLORS[this.state.gameMode];
    const modeName = MODE_NAMES[this.state.gameMode];
    
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = modeColor;
    ctx.fillText('FLAPPY BIRD', canvasWidth / 2, canvasHeight / 3 - 20);
    
    ctx.font = 'bold 18px monospace';
    ctx.fillText(modeName, canvasWidth / 2, canvasHeight / 3 + 20);
    
    ctx.shadowBlur = 0;
    
    ctx.font = '12px monospace';
    ctx.fillStyle = '#888888';
    
    switch (this.state.gameMode) {
      case 'original':
        ctx.fillText('The classic experience', canvasWidth / 2, canvasHeight / 2 - 20);
        break;
      case 'modified':
        ctx.fillText('Collect power-ups!', canvasWidth / 2, canvasHeight / 2 - 20);
        ctx.fillText('Shield • Slow-Mo • 2x Points', canvasWidth / 2, canvasHeight / 2);
        break;
      case 'obstacles':
        ctx.fillText('Survive as long as you can!', canvasWidth / 2, canvasHeight / 2 - 30);
        ctx.fillStyle = COLORS.spike;
        ctx.fillText('Spikes', canvasWidth / 2 - 80, canvasHeight / 2);
        ctx.fillStyle = COLORS.laser;
        ctx.fillText('Lasers', canvasWidth / 2, canvasHeight / 2);
        ctx.fillStyle = COLORS.portal;
        ctx.fillText('Portals', canvasWidth / 2 + 80, canvasHeight / 2);
        ctx.fillStyle = '#888888';
        ctx.fillText('Meteors • Barriers', canvasWidth / 2, canvasHeight / 2 + 20);
        break;
    }
    
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = modeColor;
      ctx.fillText('TAP OR PRESS SPACE', canvasWidth / 2, canvasHeight / 2 + 60);
    }
    
    ctx.font = '10px monospace';
    ctx.fillStyle = '#555555';
    ctx.fillText('SPACE / CLICK / TAP TO FLAP', canvasWidth / 2, canvasHeight / 2 + 100);
  }

  private renderGameOver(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const modeColor = MODE_COLORS[this.state.gameMode];
    const modeName = MODE_NAMES[this.state.gameMode];
    
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 4);
    
    ctx.shadowBlur = 0;
    
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = modeColor;
    ctx.fillText(modeName, canvasWidth / 2, canvasHeight / 4 + 35);
    ctx.shadowBlur = 0;
    
    const panelY = canvasHeight / 2 - 60;
    ctx.strokeStyle = modeColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(canvasWidth / 2 - 100, panelY, 200, 120);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvasWidth / 2 - 100, panelY, 200, 120);
    
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(this.state.gameMode === 'obstacles' ? 'SURVIVED' : 'SCORE', canvasWidth / 2, panelY + 30);
    
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 40px monospace';
    ctx.fillStyle = modeColor;
    ctx.fillText(this.state.score.toString(), canvasWidth / 2, panelY + 70);
    ctx.shadowBlur = 0;
    
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.textYellow;
    ctx.fillText(`BEST: ${this.state.highScore}`, canvasWidth / 2, panelY + 100);
    
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = modeColor;
      ctx.fillText('TAP TO RETRY', canvasWidth / 2, canvasHeight / 2 + 100);
    }
    
    ctx.font = '10px monospace';
    ctx.fillStyle = '#555555';
    switch (this.state.gameMode) {
      case 'original':
        ctx.fillText('Tip: Tap gently for small hops', canvasWidth / 2, canvasHeight / 2 + 140);
        break;
      case 'modified':
        ctx.fillText('Tip: Shield absorbs one hit', canvasWidth / 2, canvasHeight / 2 + 140);
        break;
      case 'obstacles':
        ctx.fillText('Tip: Portals give +3 points!', canvasWidth / 2, canvasHeight / 2 + 140);
        break;
    }
  }
}
