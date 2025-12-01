import {
  GameState,
  GameConfig,
  GameMode,
  Pipe,
  Bird,
  PowerUp,
  PowerUpType,
  Obstacle,
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
    
    // Debug mode setup
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
        // Add some pipes
        this.spawnPipe();
        this.state.pipes[0].x = 200;
        break;
      case 'gameover':
        this.state.gameOver = true;
        this.state.score = 42;
        this.state.highScore = 100;
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
      score: 0,
      highScore: 0,
      gameOver: false,
      isPlaying: false,
      frameCount: 0,
      gameMode,
      activePowerUps: [],
      hasShield: false,
    };
  }

  public start(): void {
    this.state.isPlaying = true;
    this.state.gameOver = false;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  public reset(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    const highScore = Math.max(this.state.highScore, this.state.score);
    this.state = this.createInitialState(this.state.gameMode);
    this.state.highScore = highScore;
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
    
    this.updatePowerUps();
    const speedMod = this.getSpeedModifier();
    this.updateBird(speedMod);
    this.updatePipes(speedMod);
    this.updateObstacles();
    
    // Spawn interval varies by mode
    const spawnInterval = this.state.gameMode === 'obstacles' 
      ? this.config.pipeSpawnInterval + 15 // Slightly slower for obstacles
      : this.config.pipeSpawnInterval;
    
    if (this.state.frameCount % spawnInterval === 0) {
      this.spawnPipe();
    }
    
    this.checkCollisions();
    this.checkScore();
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

  private updateObstacles(): void {
    for (const pipe of this.state.pipes) {
      if (!pipe.obstacle) continue;
      
      const obs = pipe.obstacle;
      
      switch (obs.type) {
        case 'moving':
          if (obs.direction !== undefined && obs.speed !== undefined) {
            obs.y += obs.direction * obs.speed;
            if (obs.minY !== undefined && obs.maxY !== undefined) {
              if (obs.y <= obs.minY || obs.y >= obs.maxY) {
                obs.direction *= -1;
              }
            }
          }
          break;
        case 'rotating':
          if (obs.angle !== undefined && obs.rotationSpeed !== undefined) {
            obs.angle += obs.rotationSpeed;
          }
          break;
      }
    }
  }

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
    
    // Power-ups for modified mode
    if (this.state.gameMode === 'modified' && Math.random() < 0.3) {
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
    
    // Obstacles for obstacles mode
    if (this.state.gameMode === 'obstacles' && Math.random() < 0.5) {
      const obstacleTypes: Array<'moving' | 'rotating'> = ['moving', 'rotating'];
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      
      const gapCenterY = topHeight + this.config.pipeGap / 2;
      
      if (type === 'moving') {
        pipe.obstacle = {
          type: 'moving',
          x: pipe.x + pipe.width / 2 - 15,
          y: gapCenterY - 10,
          width: 30,
          height: 20,
          direction: Math.random() > 0.5 ? 1 : -1,
          speed: 1.5,
          minY: topHeight + 20,
          maxY: pipe.bottomY - 40,
        };
      } else {
        pipe.obstacle = {
          type: 'rotating',
          x: pipe.x + pipe.width / 2,
          y: gapCenterY,
          width: 40,
          height: 8,
          angle: 0,
          rotationSpeed: 0.05,
        };
      }
    }
    
    this.state.pipes.push(pipe);
  }

  private checkCollisions(): void {
    const bird = this.state.bird;
    
    for (const pipe of this.state.pipes) {
      // Power-up collection (modified mode)
      if (pipe.powerUp && !pipe.powerUp.collected) {
        if (this.checkPowerUpCollision(bird, pipe.powerUp)) {
          this.collectPowerUp(pipe.powerUp);
          continue; // Don't check pipe collision after collecting power-up
        }
      }
      
      // Obstacle collision (obstacles mode)
      if (pipe.obstacle) {
        if (this.checkObstacleCollision(bird, pipe.obstacle)) {
          this.handleCollision();
          return;
        }
      }
      
      const birdBox = {
        x: bird.x + 4,
        y: bird.y + 4,
        width: bird.width - 8,
        height: bird.height - 8,
      };
      
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

  private checkObstacleCollision(bird: Bird, obstacle: Obstacle): boolean {
    const birdBox = {
      x: bird.x + 4,
      y: bird.y + 4,
      width: bird.width - 8,
      height: bird.height - 8,
    };
    
    if (obstacle.type === 'rotating' && obstacle.angle !== undefined) {
      // For rotating obstacles, use a circular hitbox
      const centerX = obstacle.x;
      const centerY = obstacle.y;
      const radius = obstacle.width / 2;
      
      const birdCenterX = birdBox.x + birdBox.width / 2;
      const birdCenterY = birdBox.y + birdBox.height / 2;
      const birdRadius = Math.min(birdBox.width, birdBox.height) / 2;
      
      const dx = birdCenterX - centerX;
      const dy = birdCenterY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      return distance < radius + birdRadius;
    }
    
    // AABB collision for moving obstacles
    return (
      birdBox.x < obstacle.x + obstacle.width &&
      birdBox.x + birdBox.width > obstacle.x &&
      birdBox.y < obstacle.y + obstacle.height &&
      birdBox.y + birdBox.height > obstacle.y
    );
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
    
    const duration = powerUp.type === 'shield' ? 0 : 5000;
    
    if (powerUp.type === 'shield') {
      this.state.hasShield = true;
    } else {
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
    
    // Stars in background
    this.renderStars();
    
    // Grid lines for retro feel
    this.renderGrid();
    
    this.renderPipes();
    this.renderGround();
    this.renderBird();
    
    // Only render score during gameplay (not on start/end screens)
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
      
      if (pipe.obstacle) {
        this.renderObstacle(pipe.obstacle);
      }
    }
  }

  private drawPipe(x: number, y: number, width: number, height: number, isTop: boolean): void {
    const ctx = this.ctx;
    const capHeight = 20;
    const capOverhang = 6;
    
    // Pipe glow effect
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 10;
    
    // Main pipe body
    ctx.fillStyle = '#1a3d1a';
    ctx.fillRect(x + 2, y, width - 4, height);
    
    // Neon border
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y, width - 4, height);
    
    // Pipe cap
    const capY = isTop ? y + height - capHeight : y;
    
    ctx.fillStyle = '#1a3d1a';
    ctx.fillRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
    
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
    
    // Inner highlight
    ctx.strokeStyle = COLORS.pipeHighlight;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 2, width - 8, height - 4);
    
    ctx.shadowBlur = 0;
  }

  private renderObstacle(obstacle: Obstacle): void {
    const ctx = this.ctx;
    
    ctx.save();
    
    ctx.shadowColor = COLORS.obstacle;
    ctx.shadowBlur = 15;
    
    if (obstacle.type === 'rotating' && obstacle.angle !== undefined) {
      ctx.translate(obstacle.x, obstacle.y);
      ctx.rotate(obstacle.angle);
      
      // Rotating bar
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
      
      ctx.strokeStyle = COLORS.obstacleDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
      
      // Center circle
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      // Moving obstacle
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      
      ctx.strokeStyle = COLORS.obstacleDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      
      // Warning stripes
      ctx.fillStyle = '#000000';
      for (let i = 0; i < obstacle.width; i += 10) {
        ctx.fillRect(obstacle.x + i, obstacle.y, 5, obstacle.height);
      }
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
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
    ctx.arc(centerX, centerY, width / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS[type];
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner fill
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[type];
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Icon text
    ctx.fillStyle = COLORS[type];
    ctx.font = 'bold 14px monospace';
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
    
    // Neon top line
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 5;
    ctx.fillStyle = COLORS.pipe;
    ctx.fillRect(0, groundY, canvasWidth, 4);
    ctx.shadowBlur = 0;
    
    // Grid pattern
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
    
    // Shield effect
    if (this.state.hasShield) {
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, bird.width / 2 + 10, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
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
    
    ctx.shadowColor = COLORS.text;
    ctx.shadowBlur = 10;
    
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.state.score.toString(), this.config.canvasWidth / 2, 50);
    
    ctx.fillStyle = COLORS.text;
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
      ctx.shadowBlur = 8;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(offsetX, 10, 30, 30);
      
      ctx.strokeStyle = COLORS[powerUp.type];
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, 10, 30, 30);
      
      ctx.fillStyle = COLORS[powerUp.type];
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(remaining.toFixed(1), offsetX + 15, 30);
      
      ctx.shadowBlur = 0;
      offsetX += 35;
    }
    
    if (this.state.hasShield) {
      ctx.shadowColor = COLORS.shield;
      ctx.shadowBlur = 8;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(offsetX, 10, 30, 30);
      
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, 10, 30, 30);
      
      ctx.fillStyle = COLORS.shield;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('S', offsetX + 15, 30);
      
      ctx.shadowBlur = 0;
    }
  }

  private renderStartScreen(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const modeColor = MODE_COLORS[this.state.gameMode];
    const modeName = MODE_NAMES[this.state.gameMode];
    
    // Title with glow
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = modeColor;
    ctx.fillText('FLAPPY BIRD', canvasWidth / 2, canvasHeight / 3 - 20);
    
    // Mode indicator
    ctx.font = 'bold 18px monospace';
    ctx.fillText(modeName, canvasWidth / 2, canvasHeight / 3 + 20);
    
    ctx.shadowBlur = 0;
    
    // Mode-specific info
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
        ctx.fillText('Dodge moving obstacles!', canvasWidth / 2, canvasHeight / 2 - 20);
        ctx.fillText('Watch for rotating bars', canvasWidth / 2, canvasHeight / 2);
        break;
    }
    
    // Blinking instruction
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = modeColor;
      ctx.fillText('TAP OR PRESS SPACE', canvasWidth / 2, canvasHeight / 2 + 60);
    }
    
    // Controls hint
    ctx.font = '10px monospace';
    ctx.fillStyle = '#555555';
    ctx.fillText('SPACE / CLICK / TAP TO FLAP', canvasWidth / 2, canvasHeight / 2 + 100);
  }

  private renderGameOver(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const modeColor = MODE_COLORS[this.state.gameMode];
    const modeName = MODE_NAMES[this.state.gameMode];
    
    // Game Over with red glow
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 4);
    
    ctx.shadowBlur = 0;
    
    // Mode badge
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = modeColor;
    ctx.fillText(modeName, canvasWidth / 2, canvasHeight / 4 + 35);
    ctx.shadowBlur = 0;
    
    // Score panel
    const panelY = canvasHeight / 2 - 60;
    ctx.strokeStyle = modeColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(canvasWidth / 2 - 100, panelY, 200, 120);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvasWidth / 2 - 100, panelY, 200, 120);
    
    // Score label
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText('SCORE', canvasWidth / 2, panelY + 30);
    
    // Score value
    ctx.shadowColor = modeColor;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 40px monospace';
    ctx.fillStyle = modeColor;
    ctx.fillText(this.state.score.toString(), canvasWidth / 2, panelY + 70);
    ctx.shadowBlur = 0;
    
    // Best score
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.textYellow;
    ctx.fillText(`BEST: ${this.state.highScore}`, canvasWidth / 2, panelY + 100);
    
    // Blinking restart
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = modeColor;
      ctx.fillText('TAP TO RETRY', canvasWidth / 2, canvasHeight / 2 + 100);
    }
    
    // Tip based on mode
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
        ctx.fillText('Tip: Time your flaps with obstacles', canvasWidth / 2, canvasHeight / 2 + 140);
        break;
    }
  }
}
