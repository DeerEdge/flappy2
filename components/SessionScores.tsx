'use client';

import { GameMode, MODE_NAMES } from '@/lib/game/types';

interface SessionScore {
  id: string;
  score: number;
  gameMode: GameMode;
  timestamp: Date;
  saved: boolean;
}

interface SessionScoresProps {
  scores: SessionScore[];
  onSaveScore: (score: SessionScore) => void;
  currentMode?: GameMode;
}

export default function SessionScores({ scores, onSaveScore, currentMode }: SessionScoresProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getModeStyle = (mode: GameMode) => {
    switch (mode) {
      case 'original':
        return {
          bg: 'bg-[var(--neon-green)]/20',
          text: 'text-[var(--neon-green)]',
          label: 'CLS',
        };
      case 'modified':
        return {
          bg: 'bg-[var(--neon-magenta)]/20',
          text: 'text-[var(--neon-magenta)]',
          label: 'PWR',
        };
      case 'obstacles':
        return {
          bg: 'bg-[var(--neon-orange)]/20',
          text: 'text-[var(--neon-orange)]',
          label: 'OBS',
        };
    }
  };

  // Filter scores by current mode if provided
  const filteredScores = currentMode 
    ? scores.filter(s => s.gameMode === currentMode)
    : scores;

  // Get stats for current mode
  const modeScores = currentMode ? scores.filter(s => s.gameMode === currentMode) : scores;
  const bestScore = modeScores.length > 0 ? Math.max(...modeScores.map(s => s.score)) : 0;

  return (
    <div className="w-full arcade-panel p-4">
      <h2 className="font-pixel text-[10px] text-[var(--neon-magenta)] mb-3 flex items-center gap-2">
        <span className="text-lg">▶</span>
        SESSION LOG
        {currentMode && (
          <span 
            className={`font-pixel text-[8px] ml-auto px-2 py-0.5 ${getModeStyle(currentMode).bg} ${getModeStyle(currentMode).text}`}
          >
            {MODE_NAMES[currentMode]}
          </span>
        )}
      </h2>
      
      {filteredScores.length === 0 ? (
        <p className="font-retro text-sm text-gray-500 text-center py-4">
          NO GAMES PLAYED YET
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredScores.map((entry) => {
            const style = getModeStyle(entry.gameMode);
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-2 border ${
                  entry.saved 
                    ? 'border-gray-700 bg-gray-900/50' 
                    : 'border-[var(--neon-green)]/30 bg-[var(--arcade-dark)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-retro text-xs text-gray-500">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={`font-pixel text-[8px] px-2 py-0.5 ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="font-pixel text-sm text-white">
                    {entry.score}
                  </span>
                </div>
                
                {entry.saved ? (
                  <span className="font-pixel text-[8px] text-[var(--neon-cyan)]">
                    SAVED ✓
                  </span>
                ) : (
                  <button
                    onClick={() => onSaveScore(entry)}
                    className="arcade-btn px-2 py-1 font-pixel text-[8px] hover:scale-105 transition-transform"
                  >
                    SAVE
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {modeScores.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex justify-between font-retro text-xs text-gray-500">
            <span>GAMES: {modeScores.length}</span>
            <span>BEST: {bestScore}</span>
          </div>
        </div>
      )}
    </div>
  );
}
