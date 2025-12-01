import {
  GameState,
  GameConfig,
  GameMode,
  Pipe,
  Bird,
  ActivePowerUp,
  PowerUp,
  PowerUpType,
  DEFAULT_CONFIG,
  BIRD_CONFIG,
  COLORS,
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
    onGameOver?: (score: number) => void
  ) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG };
    this.onScoreChange = onScoreChange;
    this.onGameOver = onGameOver;
    this.state = this.createInitialState(gameMode);
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
    
    if (deltaTime >= 16.67) { // ~60fps
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
    
    // Update power-ups
    this.updatePowerUps();
    
    // Get current speed modifier
    const speedMod = this.getSpeedModifier();
    
    // Update bird physics
    this.updateBird(speedMod);
    
    // Update pipes
    this.updatePipes(speedMod);
    
    // Spawn new pipes
    if (this.state.frameCount % this.config.pipeSpawnInterval === 0) {
      this.spawnPipe();
    }
    
    // Check collisions
    this.checkCollisions();
    
    // Check score
    this.checkScore();
  }

  private updateBird(speedMod: number): void {
    const bird = this.state.bird;
    
    // Apply gravity
    bird.velocity += this.config.gravity * speedMod;
    bird.y += bird.velocity * speedMod;
    
    // Update rotation based on velocity
    bird.rotation = Math.min(Math.max(bird.velocity * 3, -30), 90);
    
    // Ground collision
    const groundY = this.config.canvasHeight - this.config.groundHeight;
    if (bird.y + bird.height > groundY) {
      bird.y = groundY - bird.height;
      this.handleCollision();
    }
    
    // Ceiling collision
    if (bird.y < 0) {
      bird.y = 0;
      bird.velocity = 0;
    }
  }

  private updatePipes(speedMod: number): void {
    const speed = this.config.pipeSpeed * speedMod;
    
    this.state.pipes = this.state.pipes.filter(pipe => {
      pipe.x -= speed;
      
      // Update power-up position if exists
      if (pipe.powerUp && !pipe.powerUp.collected) {
        pipe.powerUp.x = pipe.x + this.config.pipeWidth + 20;
      }
      
      return pipe.x + pipe.width > -50;
    });
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
    
    // Add power-up in modified mode (30% chance)
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
    
    this.state.pipes.push(pipe);
  }

  private checkCollisions(): void {
    const bird = this.state.bird;
    
    for (const pipe of this.state.pipes) {
      // Check power-up collection
      if (pipe.powerUp && !pipe.powerUp.collected) {
        if (this.checkPowerUpCollision(bird, pipe.powerUp)) {
          this.collectPowerUp(pipe.powerUp);
        }
      }
      
      // Bird hitbox (slightly smaller for fairness)
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
    
    const duration = powerUp.type === 'shield' ? 0 : 5000; // Shield is instant use
    
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

  public render(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight - groundHeight);
    skyGradient.addColorStop(0, '#4dc9e6');
    skyGradient.addColorStop(1, COLORS.sky);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight - groundHeight);
    
    // Draw pipes
    this.renderPipes();
    
    // Draw ground
    this.renderGround();
    
    // Draw bird
    this.renderBird();
    
    // Draw score
    this.renderScore();
    
    // Draw power-up indicators
    if (this.state.gameMode === 'modified') {
      this.renderPowerUpIndicators();
    }
    
    // Draw game over or start screen
    if (this.state.gameOver) {
      this.renderGameOver();
    } else if (!this.state.isPlaying) {
      this.renderStartScreen();
    }
  }

  private renderPipes(): void {
    const ctx = this.ctx;
    
    for (const pipe of this.state.pipes) {
      // Top pipe
      this.drawPipe(pipe.x, 0, pipe.width, pipe.topHeight, true);
      
      // Bottom pipe
      this.drawPipe(
        pipe.x,
        pipe.bottomY,
        pipe.width,
        this.config.canvasHeight - pipe.bottomY - this.config.groundHeight,
        false
      );
      
      // Draw power-up if exists
      if (pipe.powerUp && !pipe.powerUp.collected) {
        this.renderPowerUp(pipe.powerUp);
      }
    }
  }

  private drawPipe(x: number, y: number, width: number, height: number, isTop: boolean): void {
    const ctx = this.ctx;
    const capHeight = 26;
    const capOverhang = 4;
    
    // Main pipe body
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, COLORS.pipeDark);
    gradient.addColorStop(0.3, COLORS.pipeHighlight);
    gradient.addColorStop(0.5, COLORS.pipe);
    gradient.addColorStop(1, COLORS.pipeDark);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // Pipe cap
    const capY = isTop ? y + height - capHeight : y;
    const capGradient = ctx.createLinearGradient(x - capOverhang, 0, x + width + capOverhang, 0);
    capGradient.addColorStop(0, COLORS.pipeDark);
    capGradient.addColorStop(0.3, COLORS.pipeHighlight);
    capGradient.addColorStop(0.5, COLORS.pipe);
    capGradient.addColorStop(1, COLORS.pipeDark);
    
    ctx.fillStyle = capGradient;
    ctx.fillRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
    
    // Cap border
    ctx.strokeStyle = COLORS.pipeDark;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - capOverhang, capY, width + capOverhang * 2, capHeight);
  }

  private renderPowerUp(powerUp: PowerUp): void {
    const ctx = this.ctx;
    const { x, y, width, height, type } = powerUp;
    
    // Glow effect
    ctx.shadowColor = COLORS[type];
    ctx.shadowBlur = 15;
    
    // Background circle
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[type];
    ctx.fill();
    
    // Icon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons: Record<PowerUpType, string> = {
      shield: '🛡',
      slowmo: '⏱',
      double: '×2',
    };
    
    ctx.fillText(icons[type], x + width / 2, y + height / 2);
    
    ctx.shadowBlur = 0;
  }

  private renderGround(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    const groundY = canvasHeight - groundHeight;
    
    // Ground fill
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, groundY, canvasWidth, groundHeight);
    
    // Ground top stripe
    ctx.fillStyle = COLORS.groundDark;
    ctx.fillRect(0, groundY, canvasWidth, 15);
    
    // Ground pattern
    ctx.strokeStyle = COLORS.groundDark;
    ctx.lineWidth = 2;
    for (let i = 0; i < canvasWidth; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, groundY + 15);
      ctx.lineTo(i + 15, groundY + groundHeight);
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
      ctx.beginPath();
      ctx.arc(0, 0, bird.width / 2 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Bird body
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bird;
    ctx.fill();
    ctx.strokeStyle = COLORS.birdDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Wing
    const wingY = Math.sin(this.state.frameCount * 0.3) * 3;
    ctx.beginPath();
    ctx.ellipse(-2, wingY, 8, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.birdDark;
    ctx.fill();
    
    // Eye
    ctx.beginPath();
    ctx.arc(8, -4, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // Beak
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fillStyle = COLORS.birdBeak;
    ctx.fill();
    
    ctx.restore();
  }

  private renderScore(): void {
    const ctx = this.ctx;
    
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Shadow
    ctx.fillStyle = COLORS.textShadow;
    ctx.fillText(this.state.score.toString(), this.config.canvasWidth / 2 + 2, 52);
    
    // Main text
    ctx.fillStyle = COLORS.text;
    ctx.fillText(this.state.score.toString(), this.config.canvasWidth / 2, 50);
  }

  private renderPowerUpIndicators(): void {
    const ctx = this.ctx;
    const now = Date.now();
    let offsetX = 10;
    
    for (const powerUp of this.state.activePowerUps) {
      const remaining = Math.max(0, (powerUp.endTime - now) / 1000);
      
      ctx.fillStyle = COLORS[powerUp.type];
      ctx.beginPath();
      ctx.arc(offsetX + 15, 25, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(remaining.toFixed(1), offsetX + 15, 28);
      
      offsetX += 35;
    }
    
    // Shield indicator
    if (this.state.hasShield) {
      ctx.fillStyle = COLORS.shield;
      ctx.beginPath();
      ctx.arc(offsetX + 15, 25, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🛡', offsetX + 15, 29);
    }
  }

  private renderStartScreen(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Title
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('FLAPPY BIRD', canvasWidth / 2, canvasHeight / 3);
    
    // Mode indicator
    ctx.font = 'bold 20px Arial';
    const modeText = this.state.gameMode === 'original' ? 'CLASSIC' : 'POWER-UPS';
    ctx.fillText(modeText, canvasWidth / 2, canvasHeight / 3 + 40);
    
    // Instructions
    ctx.font = '18px Arial';
    ctx.fillText('Press SPACE or TAP to start', canvasWidth / 2, canvasHeight / 2);
    ctx.fillText('Press SPACE or TAP to flap', canvasWidth / 2, canvasHeight / 2 + 30);
  }

  private renderGameOver(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Game Over text
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 3);
    
    // Score
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`Score: ${this.state.score}`, canvasWidth / 2, canvasHeight / 2 - 20);
    ctx.fillText(`Best: ${this.state.highScore}`, canvasWidth / 2, canvasHeight / 2 + 20);
    
    // Restart instruction
    ctx.font = '18px Arial';
    ctx.fillText('Press SPACE or TAP to restart', canvasWidth / 2, canvasHeight / 2 + 80);
  }
}

