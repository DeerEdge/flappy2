export type GameMode = 'original' | 'modified';

export type PowerUpType = 'shield' | 'slowmo' | 'double';

export interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

export interface ActivePowerUp {
  type: PowerUpType;
  endTime: number;
}

export interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  width: number;
  passed: boolean;
  powerUp?: PowerUp;
}

export interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
  rotation: number;
}

export interface GameState {
  bird: Bird;
  pipes: Pipe[];
  score: number;
  highScore: number;
  gameOver: boolean;
  isPlaying: boolean;
  frameCount: number;
  gameMode: GameMode;
  activePowerUps: ActivePowerUp[];
  hasShield: boolean;
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  gravity: number;
  flapStrength: number;
  pipeSpeed: number;
  pipeGap: number;
  pipeWidth: number;
  pipeSpawnInterval: number;
  groundHeight: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 400,
  canvasHeight: 600,
  gravity: 0.5,
  flapStrength: -9,
  pipeSpeed: 3,
  pipeGap: 150,
  pipeWidth: 60,
  pipeSpawnInterval: 90,
  groundHeight: 80,
};

export const BIRD_CONFIG = {
  width: 34,
  height: 24,
  x: 80,
  startY: 250,
};

// Retro arcade color palette
export const COLORS = {
  // Sky - darker, more arcade-like
  sky: '#1a1a2e',
  skyLight: '#16213e',
  
  // Ground - pixel art style
  ground: '#2d572c',
  groundDark: '#1e3d1c',
  groundLight: '#3d7a3c',
  
  // Pipes - neon green arcade style
  pipe: '#39ff14',
  pipeDark: '#2bc40e',
  pipeHighlight: '#5fff3f',
  pipeBorder: '#1a8c0a',
  
  // Bird - bright yellow/orange
  bird: '#ffff00',
  birdDark: '#ff8c00',
  birdBeak: '#ff4444',
  birdEye: '#ffffff',
  
  // UI Text
  text: '#39ff14',
  textShadow: '#000000',
  textCyan: '#00ffff',
  textMagenta: '#ff00ff',
  textYellow: '#ffff00',
  
  // Power-ups - neon colors
  shield: '#00ffff',
  slowmo: '#ff00ff',
  double: '#ffff00',
  
  // Effects
  glow: '#39ff14',
};
