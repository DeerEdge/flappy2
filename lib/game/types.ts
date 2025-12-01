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

export const COLORS = {
  sky: '#70c5ce',
  ground: '#ded895',
  groundDark: '#d2b666',
  pipe: '#73bf2e',
  pipeDark: '#558022',
  pipeHighlight: '#8ed43a',
  bird: '#f7dc6f',
  birdDark: '#f39c12',
  birdBeak: '#e74c3c',
  text: '#ffffff',
  textShadow: '#000000',
  shield: '#3498db',
  slowmo: '#9b59b6',
  double: '#f1c40f',
};

