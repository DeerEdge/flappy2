'use client';

import { GameMode } from '@/lib/game/types';

interface GameTabsProps {
  activeMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

export default function GameTabs({ activeMode, onModeChange }: GameTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-stone-900/50 rounded-lg backdrop-blur-sm">
      <button
        onClick={() => onModeChange('original')}
        className={`px-6 py-2 rounded-md font-bold text-sm uppercase tracking-wider transition-all duration-200 ${
          activeMode === 'original'
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
            : 'bg-transparent text-stone-400 hover:text-white hover:bg-stone-800'
        }`}
      >
        Classic
      </button>
      <button
        onClick={() => onModeChange('modified')}
        className={`px-6 py-2 rounded-md font-bold text-sm uppercase tracking-wider transition-all duration-200 ${
          activeMode === 'modified'
            ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
            : 'bg-transparent text-stone-400 hover:text-white hover:bg-stone-800'
        }`}
      >
        Power-Ups
      </button>
    </div>
  );
}

