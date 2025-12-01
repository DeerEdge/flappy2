'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FlappyEngine } from '@/lib/game/engine';
import { GameMode, DEFAULT_CONFIG } from '@/lib/game/types';

interface GameCanvasProps {
  gameMode: GameMode;
  onGameOver: (score: number) => void;
  debugState?: 'start' | 'playing' | 'gameover';
}

export default function GameCanvas({ 
  gameMode, 
  onGameOver,
  debugState 
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlappyEngine | null>(null);

  const handleInteraction = useCallback(() => {
    if (!engineRef.current) return;
    
    const state = engineRef.current.getState();
    
    if (state.gameOver) {
      // Reset and start fresh
      engineRef.current.reset();
    }
    
    engineRef.current.flap();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize engine with optional debug state
    engineRef.current = new FlappyEngine(ctx, gameMode, undefined, onGameOver, debugState);
    engineRef.current.render();

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [gameMode, onGameOver, handleInteraction, debugState]);

  // Handle game mode changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setGameMode(gameMode);
    }
  }, [gameMode]);

  return (
    <canvas
      ref={canvasRef}
      width={DEFAULT_CONFIG.canvasWidth}
      height={DEFAULT_CONFIG.canvasHeight}
      onClick={handleInteraction}
      onTouchStart={(e) => {
        e.preventDefault();
        handleInteraction();
      }}
      className="cursor-pointer border-4 border-[var(--neon-green)] box-glow-green"
      style={{ touchAction: 'none' }}
    />
  );
}
