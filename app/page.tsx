'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GameMode } from '@/lib/game/types';
import GameTabs from '@/components/GameTabs';
import Leaderboard from '@/components/Leaderboard';
import ScoreSubmit from '@/components/ScoreSubmit';

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-[400px] h-[600px] bg-stone-900 rounded-lg flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function Home() {
  const [gameMode, setGameMode] = useState<GameMode>('original');
  const [currentScore, setCurrentScore] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);

  const handleScoreChange = useCallback((score: number) => {
    setCurrentScore(score);
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    if (score > 0) {
      setShowSubmit(true);
    }
  }, []);

  const handleScoreSubmitted = () => {
    setShowSubmit(false);
    setLeaderboardRefresh(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-8 px-4">
        {/* Header */}
        <header className="mb-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
            FLAPPY
            <span className="text-emerald-400"> BIRD</span>
          </h1>
          <p className="text-stone-400 text-sm">
            Press <kbd className="px-2 py-0.5 bg-stone-800 rounded text-stone-300 font-mono text-xs">SPACE</kbd> or tap to flap
          </p>
        </header>

        {/* Game Mode Tabs */}
        <div className="mb-4">
          <GameTabs activeMode={gameMode} onModeChange={setGameMode} />
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Game Area */}
          <div className="relative">
            {/* Current Score Display */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-stone-900/80 backdrop-blur-sm px-6 py-2 rounded-full border border-stone-700">
              <span className="text-stone-400 text-sm mr-2">Score:</span>
              <span className="text-emerald-400 font-bold text-xl tabular-nums">{currentScore}</span>
            </div>

            <GameCanvas
              gameMode={gameMode}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
            />

            {/* Power-ups legend for modified mode */}
            {gameMode === 'modified' && (
              <div className="mt-4 flex justify-center gap-4 text-xs text-stone-400">
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[10px]">🛡</span>
                  <span>Shield</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center text-[10px]">⏱</span>
                  <span>Slow-Mo</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[10px]">×2</span>
                  <span>Double</span>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <Leaderboard gameMode={gameMode} refreshTrigger={leaderboardRefresh} />
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-stone-600 text-xs">
          <p>Built with Next.js & Canvas API</p>
        </footer>
      </div>

      {/* Score Submit Modal */}
      {showSubmit && (
        <ScoreSubmit
          score={finalScore}
          gameMode={gameMode}
          onSubmitted={handleScoreSubmitted}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </main>
  );
}
