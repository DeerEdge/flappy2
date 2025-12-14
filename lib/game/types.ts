export type GameMode = 'original' | 'modified' | 'obstacles';

export type PowerUpType = 'shield' | 'slowmo' | 'double';

// New obstacle types for endless runner mode
export type ObstacleType = 'spike' | 'laser' | 'portal' | 'meteor' | 'barrier';

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

// Unified obstacle interface for endless runner mode
export interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  // Common properties
  active: boolean;
  passed: boolean;
  // For spike - position on ground or ceiling
  position?: 'ground' | 'ceiling';
  // For laser - toggle timing
  onTime?: number;
  offTime?: number;
  isOn?: boolean;
  toggleTimer?: number;
  // For portal - teleport destination
  teleported?: boolean;
  // For meteor - diagonal movement
  velocityX?: number;
  velocityY?: number;
  // For barrier - gap position and movement
  gapY?: number;
  gapHeight?: number;
  direction?: number;
  speed?: number;
  minY?: number;
  maxY?: number;
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

// Visual effect for power-up collection feedback
export interface CollectEffect {
  type: PowerUpType;
  startTime: number;
  duration: number;
}

export interface GameState {
  bird: Bird;
  pipes: Pipe[];
  obstacles: Obstacle[]; // Separate array for obstacles mode
  score: number;
  highScore: number;
  gameOver: boolean;
  isPlaying: boolean;
  frameCount: number;
  gameMode: GameMode;
  activePowerUps: ActivePowerUp[];
  hasShield: boolean;
  shieldBreakTime: number | null; // Invincibility after shield breaks
  collectEffect: CollectEffect | null; // For visual feedback
  // Debug state
  debugMode?: boolean;
  forcedState?: 'start' | 'playing' | 'gameover';
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
  gravity: 0.4,
  flapStrength: -7,
  pipeSpeed: 2.5,
  pipeGap: 160,
  pipeWidth: 60,
  pipeSpawnInterval: 100,
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
  textOrange: '#ff6600',
  
  // Power-ups - neon colors
  shield: '#00ffff',
  slowmo: '#ff00ff',
  double: '#ffff00',
  
  // Obstacles - varied colors
  spike: '#ff3333',
  laser: '#00ffff',
  portal: '#ff00ff',
  meteor: '#ff6600',
  barrier: '#39ff14',
  
  // Effects
  glow: '#39ff14',
};

// Mode display names
export const MODE_NAMES: Record<GameMode, string> = {
  original: 'CLASSIC',
  modified: 'POWER-UPS',
  obstacles: 'SURVIVAL',
};

// Mode colors
export const MODE_COLORS: Record<GameMode, string> = {
  original: '#39ff14',
  modified: '#ff00ff',
  obstacles: '#ff6600',
};

// Obstacle descriptions for UI
export const OBSTACLE_INFO: Record<ObstacleType, { name: string; desc: string; color: string }> = {
  spike: { name: 'SPIKE', desc: 'Instant death', color: '#ff3333' },
  laser: { name: 'LASER', desc: 'Toggles on/off', color: '#00ffff' },
  portal: { name: 'PORTAL', desc: 'Teleports you', color: '#ff00ff' },
  meteor: { name: 'METEOR', desc: 'Falls diagonally', color: '#ff6600' },
  barrier: { name: 'BARRIER', desc: 'Moving wall', color: '#39ff14' },
};
