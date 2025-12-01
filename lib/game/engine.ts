import {
  GameState,
  GameConfig,
  GameMode,
  Pipe,
  Bird,
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
    
    if (this.state.frameCount % this.config.pipeSpawnInterval === 0) {
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
      if (pipe.powerUp && !pipe.powerUp.collected) {
        if (this.checkPowerUpCollision(bird, pipe.powerUp)) {
          this.collectPowerUp(pipe.powerUp);
        }
      }
      
      const birdBox = {
        x: bird.x + 4,
        y: bird.y + 4,
        width: bird.width - 8,
        height: bird.height - 8,
      };
      
      if (
        birdBox.x < pipe.x + pipe.width &&
        birdBox.x + birdBox.width > pipe.x &&
        birdBox.y < pipe.topHeight
      ) {
        this.handleCollision();
        return;
      }
      
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
    this.renderScore();
    
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
    const { canvasWidth, canvasHeight, groundHeight } = this.config;
    
    // Pseudo-random stars based on frame
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
    
    // Vertical lines
    for (let x = 0; x < canvasWidth; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight - groundHeight);
      ctx.stroke();
    }
    
    // Horizontal lines
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
    }
  }

  private drawPipe(x: number, y: number, width: number, height: number, isTop: boolean): void {
    const ctx = this.ctx;
    const capHeight = 20;
    const capOverhang = 6;
    
    // Pipe glow effect
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 10;
    
    // Main pipe body - solid neon with border
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

  private renderPowerUp(powerUp: PowerUp): void {
    const ctx = this.ctx;
    const { x, y, width, height, type } = powerUp;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Pulsing glow
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
    
    // Ground base
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, groundY, canvasWidth, groundHeight);
    
    // Neon top line
    ctx.shadowColor = COLORS.pipe;
    ctx.shadowBlur = 5;
    ctx.fillStyle = COLORS.pipe;
    ctx.fillRect(0, groundY, canvasWidth, 4);
    ctx.shadowBlur = 0;
    
    // Grid pattern on ground
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
    
    // Bird body - pixel-ish style
    ctx.fillStyle = COLORS.bird;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
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
    
    // Retro pixel-style score
    ctx.shadowColor = COLORS.text;
    ctx.shadowBlur = 10;
    
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.state.score.toString(), this.config.canvasWidth / 2, 50);
    
    // Fill
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
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(offsetX, 10, 30, 30);
      
      // Border
      ctx.strokeStyle = COLORS[powerUp.type];
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, 10, 30, 30);
      
      // Timer text
      ctx.fillStyle = COLORS[powerUp.type];
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(remaining.toFixed(1), offsetX + 15, 30);
      
      ctx.shadowBlur = 0;
      offsetX += 35;
    }
    
    // Shield indicator
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
    
    // Title with glow
    ctx.shadowColor = COLORS.text;
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('FLAPPY BIRD', canvasWidth / 2, canvasHeight / 3);
    
    // Mode indicator
    ctx.shadowColor = this.state.gameMode === 'original' ? COLORS.textCyan : COLORS.textMagenta;
    ctx.font = 'bold 16px monospace';
    const modeText = this.state.gameMode === 'original' ? 'CLASSIC' : 'POWER-UPS';
    ctx.fillStyle = this.state.gameMode === 'original' ? COLORS.textCyan : COLORS.textMagenta;
    ctx.fillText(modeText, canvasWidth / 2, canvasHeight / 3 + 35);
    
    ctx.shadowBlur = 0;
    
    // Blinking instruction
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = COLORS.text;
      ctx.fillText('PRESS SPACE TO START', canvasWidth / 2, canvasHeight / 2 + 20);
    }
    
    // Controls hint
    ctx.font = '12px monospace';
    ctx.fillStyle = '#666666';
    ctx.fillText('SPACE / TAP TO FLAP', canvasWidth / 2, canvasHeight / 2 + 60);
  }

  private renderGameOver(): void {
    const ctx = this.ctx;
    const { canvasWidth, canvasHeight } = this.config;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Game Over with red glow
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('GAME OVER', canvasWidth / 2, canvasHeight / 3);
    
    ctx.shadowBlur = 0;
    
    // Score box
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(canvasWidth / 2 - 80, canvasHeight / 2 - 50, 160, 80);
    
    // Scores
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = COLORS.textCyan;
    ctx.fillText('SCORE', canvasWidth / 2, canvasHeight / 2 - 25);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(this.state.score.toString(), canvasWidth / 2, canvasHeight / 2);
    
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.textYellow;
    ctx.fillText(`BEST: ${this.state.highScore}`, canvasWidth / 2, canvasHeight / 2 + 25);
    
    // Blinking restart
    if (Math.floor(this.state.frameCount / 30) % 2 === 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = COLORS.text;
      ctx.fillText('PRESS SPACE TO RETRY', canvasWidth / 2, canvasHeight / 2 + 80);
    }
  }
}
