'use client';

import { useState } from 'react';
import { GameMode } from '@/lib/game/types';

interface ScoreSubmitProps {
  score: number;
  gameMode: GameMode;
  onSubmitted: () => void;
  onClose: () => void;
}

export default function ScoreSubmit({ score, gameMode, onSubmitted, onClose }: ScoreSubmitProps) {
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = playerName.trim() || 'Anonymous';
    
    if (name.length > 20) {
      setError('Name must be 20 characters or less');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: name,
          score,
          game_mode: gameMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit score');
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-stone-900 rounded-2xl p-6 w-full max-w-sm border border-stone-700 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Game Over!
        </h2>
        <p className="text-center text-emerald-400 text-4xl font-bold mb-6">
          {score}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm text-stone-400 mb-1">
              Enter your name for the leaderboard
            </label>
            <input
              id="name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Anonymous"
              maxLength={20}
              className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
          </div>
          
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-stone-800 text-stone-300 rounded-lg font-medium hover:bg-stone-700 transition-colors"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

