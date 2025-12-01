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
    
    const name = playerName.trim() || 'AAA';
    
    if (name.length > 20) {
      setError('MAX 20 CHARS');
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
        throw new Error(data.error || 'SAVE FAILED');
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SAVE FAILED');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1001] p-4">
      <div className="arcade-panel p-6 w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-pixel text-sm text-[var(--neon-cyan)] glow-cyan mb-4">
            SAVE SCORE
          </h2>
          <div className="font-pixel text-3xl text-[var(--neon-green)] glow-green animate-pulse-neon">
            {score}
          </div>
          <div className="font-pixel text-[8px] text-gray-500 mt-2">
            {gameMode === 'original' ? 'CLASSIC MODE' : 'POWER-UPS MODE'}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block font-pixel text-[8px] text-[var(--neon-magenta)] mb-2">
              ENTER NAME
            </label>
            <input
              id="name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
              placeholder="AAA"
              maxLength={20}
              className="w-full px-4 py-3 bg-[var(--arcade-dark)] border-2 border-[var(--neon-green)] text-[var(--neon-green)] font-pixel text-sm placeholder-gray-600 focus:outline-none focus:box-glow-green uppercase"
              autoFocus
            />
          </div>
          
          {error && (
            <p className="font-pixel text-[10px] text-red-500 text-center">{error}</p>
          )}
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 arcade-btn arcade-btn-magenta px-4 py-3 text-[10px]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 arcade-btn px-4 py-3 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </form>

        {/* Decorative corners */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[var(--neon-green)]" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[var(--neon-green)]" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[var(--neon-green)]" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[var(--neon-green)]" />
      </div>
    </div>
  );
}
