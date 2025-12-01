'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GameMode } from '@/lib/game/types';
import GameTabs from '@/components/GameTabs';
import Leaderboard from '@/components/Leaderboard';
import SessionScores from '@/components/SessionScores';
import ScoreSubmit from '@/components/ScoreSubmit';

interface SessionScore {
  id: string;
  score: number;
  gameMode: GameMode;
  timestamp: Date;
  saved: boolean;
}

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-[400px] h-[600px] arcade-panel flex items-center justify-center">
      <div className="font-pixel text-[var(--neon-green)] text-xs animate-pulse-neon">LOADING...</div>
    </div>
  ),
});

export default function Home() {
  const [gameMode, setGameMode] = useState<GameMode>('original');
  const [currentScore, setCurrentScore] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [scoreToSave, setScoreToSave] = useState<SessionScore | null>(null);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [sessionScores, setSessionScores] = useState<SessionScore[]>([]);

  const handleScoreChange = useCallback((score: number) => {
    setCurrentScore(score);
  }, []);

  const handleGameOver = useCallback((score: number, mode: GameMode) => {
    if (score > 0) {
      const newScore: SessionScore = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        score,
        gameMode: mode,
        timestamp: new Date(),
        saved: false,
      };
      setSessionScores(prev => [newScore, ...prev]);
    }
  }, []);

  const handleSaveScore = (sessionScore: SessionScore) => {
    setScoreToSave(sessionScore);
    setShowSubmit(true);
  };

  const handleScoreSubmitted = () => {
    if (scoreToSave) {
      setSessionScores(prev =>
        prev.map(s => (s.id === scoreToSave.id ? { ...s, saved: true } : s))
      );
    }
    setShowSubmit(false);
    setScoreToSave(null);
    setLeaderboardRefresh(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-[var(--background)] relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(var(--neon-green) 1px, transparent 1px),
              linear-gradient(90deg, var(--neon-green) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Neon glow decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--neon-green)] opacity-5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--neon-cyan)] opacity-5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen p-4 md:p-6">
        {/* Header - Logo top left */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="font-pixel text-lg md:text-xl text-[var(--neon-green)] glow-green animate-flicker">
              FLAPPY
            </h1>
            <h1 className="font-pixel text-lg md:text-xl text-[var(--neon-cyan)] glow-cyan">
              BIRD
            </h1>
          </div>
          <div className="font-pixel text-[10px] text-[var(--neon-green)] opacity-60">
            INSERT COIN
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Left side - Game */}
          <div className="flex flex-col items-center">
            {/* Game Mode Tabs */}
            <div className="mb-4">
              <GameTabs activeMode={gameMode} onModeChange={setGameMode} />
            </div>

            {/* Game Area */}
            <div className="relative">
              {/* Current Score Display */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 arcade-panel px-4 py-1 z-10">
                <span className="font-pixel text-[10px] text-[var(--neon-cyan)]">SCORE </span>
                <span className="font-pixel text-sm text-[var(--neon-green)] glow-green tabular-nums">{currentScore}</span>
              </div>

              <div className="crt-effect">
                <GameCanvas
                  gameMode={gameMode}
                  onScoreChange={handleScoreChange}
                  onGameOver={(score) => handleGameOver(score, gameMode)}
                />
              </div>

              {/* Power-ups legend for modified mode */}
              {gameMode === 'modified' && (
                <div className="mt-4 arcade-panel p-3">
                  <div className="font-pixel text-[8px] text-[var(--neon-magenta)] mb-2 text-center">POWER-UPS</div>
                  <div className="flex justify-center gap-4 font-retro text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--neon-cyan)] flex items-center justify-center text-black text-xs font-bold">S</span>
                      <span className="text-[var(--neon-cyan)]">SHIELD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--neon-magenta)] flex items-center justify-center text-black text-xs font-bold">T</span>
                      <span className="text-[var(--neon-magenta)]">SLOW</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[var(--neon-yellow)] flex items-center justify-center text-black text-xs font-bold">2</span>
                      <span className="text-[var(--neon-yellow)]">×2</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Leaderboard & Session Scores */}
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <Leaderboard gameMode={gameMode} refreshTrigger={leaderboardRefresh} />
            <SessionScores 
              scores={sessionScores} 
              onSaveScore={handleSaveScore}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="font-pixel text-[8px] text-[var(--neon-green)] opacity-40">
            © 2025 ARCADE CLASSICS
          </p>
        </footer>
      </div>

      {/* Score Submit Modal */}
      {showSubmit && scoreToSave && (
        <ScoreSubmit
          score={scoreToSave.score}
          gameMode={scoreToSave.gameMode}
          onSubmitted={handleScoreSubmitted}
          onClose={() => {
            setShowSubmit(false);
            setScoreToSave(null);
          }}
        />
      )}
    </main>
  );
}
