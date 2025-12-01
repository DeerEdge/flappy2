'use client';

import { GameMode } from '@/lib/game/types';

interface GameTabsProps {
  activeMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

const modes: { mode: GameMode; label: string; color: string }[] = [
  { mode: 'original', label: 'CLASSIC', color: 'green' },
  { mode: 'modified', label: 'POWER-UPS', color: 'magenta' },
  { mode: 'obstacles', label: 'SURVIVAL', color: 'orange' },
];

export default function GameTabs({ activeMode, onModeChange }: GameTabsProps) {
  return (
    <div className="flex gap-1 p-1 arcade-panel">
      {modes.map(({ mode, label, color }) => {
        const isActive = activeMode === mode;
        const colorClasses = {
          green: {
            active: 'bg-[var(--neon-green)] text-black box-glow-green',
            hover: 'hover:text-[var(--neon-green)] hover:border-[var(--neon-green)]/30',
          },
          magenta: {
            active: 'bg-[var(--neon-magenta)] text-black box-glow-magenta',
            hover: 'hover:text-[var(--neon-magenta)] hover:border-[var(--neon-magenta)]/30',
          },
          orange: {
            active: 'bg-[var(--neon-orange)] text-black box-glow-orange',
            hover: 'hover:text-[var(--neon-orange)] hover:border-[var(--neon-orange)]/30',
          },
        };

        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`px-3 py-2 font-pixel text-[8px] uppercase tracking-wider transition-all duration-100 ${
              isActive
                ? colorClasses[color as keyof typeof colorClasses].active
                : `bg-transparent text-gray-500 border border-transparent ${colorClasses[color as keyof typeof colorClasses].hover}`
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
