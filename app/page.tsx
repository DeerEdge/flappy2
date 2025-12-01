'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { GameMode } from '@/lib/game/types';
import GameTabs from '@/components/GameTabs';
import Leaderboard from '@/components/Leaderboard';
import SessionScores from '@/components/SessionScores';
import ScoreSubmit from '@/components/ScoreSubmit';
import PlayerMetrics, { 
  PlayerMetricsData, 
  createEmptyMetrics, 
  updateMetricsOnGameOver 
} from '@/components/PlayerMetrics';

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

function GameContent() {
  const searchParams = useSearchParams();
  
  // Debug params: ?debug=start|playing|gameover&mode=original|modified|obstacles
  const debugState = searchParams.get('debug') as 'start' | 'playing' | 'gameover' | null;
  const debugMode = searchParams.get('mode') as GameMode | null;
  
  const [gameMode, setGameMode] = useState<GameMode>(debugMode || 'original');
  const [showSubmit, setShowSubmit] = useState(false);
  const [scoreToSave, setScoreToSave] = useState<SessionScore | null>(null);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [sessionScores, setSessionScores] = useState<SessionScore[]>([]);
  const [metrics, setMetrics] = useState<PlayerMetricsData>(createEmptyMetrics);
  const gameStartTime = useRef<number>(Date.now());

  // Update mode from URL param
  useEffect(() => {
    if (debugMode && ['original', 'modified', 'obstacles'].includes(debugMode)) {
      setGameMode(debugMode);
    }
  }, [debugMode]);

  // Track game start time when game starts
  const handleGameStart = useCallback(() => {
    gameStartTime.current = Date.now();
  }, []);

  const handleGameOver = useCallback((score: number, mode: GameMode) => {
    const playTime = (Date.now() - gameStartTime.current) / 1000;
    
    // Update metrics
    setMetrics(prev => updateMetricsOnGameOver(prev, score, mode, playTime));
    
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
    
    // Reset start time for next game
    gameStartTime.current = Date.now();
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
    <>
      <div className="relative z-10 min-h-screen p-4 md:p-6">
        {/* Header - Logo top left */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-green)] glow-green">
              flappy
            </span>
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-cyan)] glow-cyan">
              2
            </span>
          </div>
          <div className="font-pixel text-[8px] text-[var(--neon-green)] opacity-60">
            INSERT COIN
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Left side - Game */}
          <div className="flex flex-col items-center gap-4">
            {/* Game Mode Tabs - Above game, no overlap */}
            <GameTabs activeMode={gameMode} onModeChange={setGameMode} />

            {/* Game Canvas */}
            <div className="crt-effect">
              <GameCanvas
                gameMode={gameMode}
                onGameOver={(score) => handleGameOver(score, gameMode)}
                debugState={debugState || undefined}
              />
            </div>

            {/* Mode-specific info panel */}
            {gameMode === 'modified' && (
              <div className="arcade-panel p-3 w-full max-w-[400px]">
                <div className="font-pixel text-[8px] text-[var(--neon-magenta)] mb-2 text-center">POWER-UPS</div>
                <div className="flex justify-center gap-4 font-retro text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-[var(--neon-cyan)] flex items-center justify-center text-black text-[10px] font-bold">S</span>
                    <span className="text-[var(--neon-cyan)]">SHIELD</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-[var(--neon-magenta)] flex items-center justify-center text-black text-[10px] font-bold">T</span>
                    <span className="text-[var(--neon-magenta)]">SLOW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded bg-[var(--neon-yellow)] flex items-center justify-center text-black text-[10px] font-bold">2</span>
                    <span className="text-[var(--neon-yellow)]">×2</span>
                  </div>
                </div>
              </div>
            )}

            {gameMode === 'obstacles' && (
              <div className="arcade-panel p-3 w-full max-w-[400px]">
                <div className="font-pixel text-[8px] text-[var(--neon-orange)] mb-2 text-center">SURVIVAL MODE</div>
                <div className="grid grid-cols-5 gap-2 font-retro text-[10px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 flex items-center justify-center text-[#ff3333] text-lg">▲</span>
                    <span className="text-[#ff3333]">SPIKE</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 flex items-center justify-center text-[#00ffff] text-lg">━</span>
                    <span className="text-[#00ffff]">LASER</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 flex items-center justify-center text-[#ff00ff] text-lg">◎</span>
                    <span className="text-[#ff00ff]">PORTAL</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 flex items-center justify-center text-[#ff6600] text-lg">●</span>
                    <span className="text-[#ff6600]">METEOR</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-5 h-5 flex items-center justify-center text-[#39ff14] text-lg">║</span>
                    <span className="text-[#39ff14]">WALL</span>
                  </div>
                </div>
                <div className="font-pixel text-[7px] text-gray-500 mt-2 text-center">
                  SURVIVE • PORTALS = +3 PTS
                </div>
              </div>
            )}
          </div>

          {/* Right side - Leaderboard, Session Scores & Metrics */}
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <Leaderboard gameMode={gameMode} refreshTrigger={leaderboardRefresh} />
            <SessionScores 
              scores={sessionScores} 
              onSaveScore={handleSaveScore}
              currentMode={gameMode}
            />
            <PlayerMetrics metrics={metrics} currentMode={gameMode} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="font-pixel text-[8px] text-[var(--neon-green)] opacity-40">
            © 2025 ARCADE CLASSICS
          </p>
          {/* Debug info - only shown with debug param */}
          {debugState && (
            <p className="font-pixel text-[8px] text-[var(--neon-magenta)] mt-2">
              DEBUG: {debugState} | MODE: {gameMode}
            </p>
          )}
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
    </>
  );
}

export default function Home() {
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

      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="font-pixel text-[var(--neon-green)] text-sm animate-pulse-neon">LOADING...</div>
        </div>
      }>
        <GameContent />
      </Suspense>
    </main>
  );
}
