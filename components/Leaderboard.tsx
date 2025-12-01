'use client';

import { useEffect, useState, useCallback } from 'react';
import { GameMode, MODE_NAMES, MODE_COLORS } from '@/lib/game/types';

interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  game_mode: GameMode;
  created_at: string;
}

interface LeaderboardProps {
  gameMode: GameMode;
  refreshTrigger?: number;
}

export default function Leaderboard({ gameMode, refreshTrigger }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/scores?mode=${gameMode}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.scores || []);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [gameMode]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard, refreshTrigger, gameMode]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return 'text-[var(--neon-yellow)] glow-yellow';
      case 1: return 'text-gray-300';
      case 2: return 'text-orange-400';
      default: return 'text-gray-500';
    }
  };

  const getRankBg = (index: number) => {
    switch (index) {
      case 0: return 'bg-[var(--neon-yellow)]/10 border-[var(--neon-yellow)]/30';
      case 1: return 'bg-gray-500/10 border-gray-500/30';
      case 2: return 'bg-orange-500/10 border-orange-500/30';
      default: return 'bg-transparent border-gray-800';
    }
  };

  // Get mode-specific styling
  const getModeColor = () => {
    switch (gameMode) {
      case 'original': return 'var(--neon-green)';
      case 'modified': return 'var(--neon-magenta)';
      case 'obstacles': return 'var(--neon-orange)';
    }
  };

  return (
    <div className="w-full arcade-panel p-4">
      <h2 className="font-pixel text-[10px] text-[var(--neon-cyan)] mb-3 flex items-center gap-2">
        <span className="text-lg">★</span>
        HIGH SCORES
        <span 
          className="font-pixel text-[8px] ml-auto px-2 py-0.5"
          style={{ 
            color: getModeColor(),
            backgroundColor: `${getModeColor()}20`,
          }}
        >
          {MODE_NAMES[gameMode]}
        </span>
      </h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="font-pixel text-[10px] text-[var(--neon-green)] animate-pulse-neon">
            LOADING...
          </div>
        </div>
      ) : entries.length === 0 ? (
        <p className="font-retro text-sm text-gray-500 text-center py-6">
          NO SCORES YET
          <br />
          <span style={{ color: getModeColor() }}>BE THE FIRST!</span>
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 px-2 py-1.5 border transition-colors ${getRankBg(index)}`}
            >
              <span className={`font-pixel text-xs w-6 text-center ${getRankColor(index)}`}>
                {index + 1}
              </span>
              <span className="flex-1 font-retro text-sm text-white truncate uppercase">
                {entry.player_name}
              </span>
              <span className="font-pixel text-xs text-[var(--neon-green)] tabular-nums">
                {entry.score}
              </span>
              <span className="font-retro text-xs text-gray-600 hidden sm:block">
                {formatDate(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
