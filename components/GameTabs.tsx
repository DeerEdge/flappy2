'use client';

import { GameMode } from '@/lib/game/types';

interface GameTabsProps {
  activeMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

export default function GameTabs({ activeMode, onModeChange }: GameTabsProps) {
  return (
    <div className="flex gap-2 p-1 arcade-panel">
      <button
        onClick={() => onModeChange('original')}
        className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-wider transition-all duration-100 ${
          activeMode === 'original'
            ? 'bg-[var(--neon-green)] text-black box-glow-green'
            : 'bg-transparent text-gray-500 hover:text-[var(--neon-green)] border border-transparent hover:border-[var(--neon-green)]/30'
        }`}
      >
        CLASSIC
      </button>
      <button
        onClick={() => onModeChange('modified')}
        className={`px-4 py-2 font-pixel text-[10px] uppercase tracking-wider transition-all duration-100 ${
          activeMode === 'modified'
            ? 'bg-[var(--neon-magenta)] text-black box-glow-magenta'
            : 'bg-transparent text-gray-500 hover:text-[var(--neon-magenta)] border border-transparent hover:border-[var(--neon-magenta)]/30'
        }`}
      >
        POWER-UPS
      </button>
    </div>
  );
}
