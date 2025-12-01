'use client';

import { useEffect, useState, useCallback } from 'react';
import { GameMode } from '@/lib/game/types';

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
    fetchLeaderboard();
  }, [fetchLeaderboard, refreshTrigger]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-sm bg-stone-900/80 backdrop-blur-sm rounded-xl p-4 border border-stone-700">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-amber-400">🏆</span>
        Leaderboard
        <span className="text-xs font-normal text-stone-400 ml-auto">
          {gameMode === 'original' ? 'Classic' : 'Power-Ups'}
        </span>
      </h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-stone-500 text-center py-6 text-sm">
          No scores yet. Be the first!
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                index === 0
                  ? 'bg-amber-500/20 border border-amber-500/30'
                  : index === 1
                  ? 'bg-stone-400/10 border border-stone-400/20'
                  : index === 2
                  ? 'bg-orange-600/10 border border-orange-600/20'
                  : 'bg-stone-800/50'
              }`}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                  index === 0
                    ? 'bg-amber-500 text-black'
                    : index === 1
                    ? 'bg-stone-400 text-black'
                    : index === 2
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-700 text-stone-400'
                }`}
              >
                {index + 1}
              </span>
              <span className="flex-1 text-white font-medium truncate">
                {entry.player_name}
              </span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {entry.score}
              </span>
              <span className="text-stone-500 text-xs">
                {formatDate(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

