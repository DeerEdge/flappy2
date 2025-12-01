'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FlappyEngine } from '@/lib/game/engine';
import { GameMode, DEFAULT_CONFIG } from '@/lib/game/types';

interface GameCanvasProps {
  gameMode: GameMode;
  onScoreChange: (score: number) => void;
  onGameOver: (score: number) => void;
}

export default function GameCanvas({ gameMode, onScoreChange, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlappyEngine | null>(null);

  const handleFlap = useCallback(() => {
    if (engineRef.current) {
      const state = engineRef.current.getState();
      if (state.gameOver) {
        engineRef.current.reset();
        onScoreChange(0);
      }
      engineRef.current.flap();
    }
  }, [onScoreChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize engine
    engineRef.current = new FlappyEngine(ctx, gameMode, onScoreChange, onGameOver);
    engineRef.current.render();

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleFlap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [gameMode, onScoreChange, onGameOver, handleFlap]);

  // Handle game mode changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setGameMode(gameMode);
      onScoreChange(0);
    }
  }, [gameMode, onScoreChange]);

  return (
    <canvas
      ref={canvasRef}
      width={DEFAULT_CONFIG.canvasWidth}
      height={DEFAULT_CONFIG.canvasHeight}
      onClick={handleFlap}
      onTouchStart={(e) => {
        e.preventDefault();
        handleFlap();
      }}
      className="cursor-pointer border-4 border-[var(--neon-green)] box-glow-green"
      style={{ touchAction: 'none' }}
    />
  );
}
