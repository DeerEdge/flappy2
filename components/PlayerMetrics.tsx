'use client';

import { GameMode, MODE_NAMES, MODE_COLORS } from '@/lib/game/types';

export interface PlayerMetricsData {
  totalGamesPlayed: number;
  totalPlayTime: number; // in seconds
  gamesByMode: Record<GameMode, number>;
  scoresByMode: Record<GameMode, number[]>;
  highScoreByMode: Record<GameMode, number>;
  avgScoreByMode: Record<GameMode, number>;
  longestSurvival: number; // for survival mode
  powerUpsCollected: number; // for modified mode
  currentStreak: number;
  bestStreak: number;
}

interface PlayerMetricsProps {
  metrics: PlayerMetricsData;
  currentMode: GameMode;
}

export function createEmptyMetrics(): PlayerMetricsData {
  return {
    totalGamesPlayed: 0,
    totalPlayTime: 0,
    gamesByMode: { original: 0, modified: 0, obstacles: 0 },
    scoresByMode: { original: [], modified: [], obstacles: [] },
    highScoreByMode: { original: 0, modified: 0, obstacles: 0 },
    avgScoreByMode: { original: 0, modified: 0, obstacles: 0 },
    longestSurvival: 0,
    powerUpsCollected: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function updateMetricsOnGameOver(
  metrics: PlayerMetricsData,
  score: number,
  mode: GameMode,
  playTime: number
): PlayerMetricsData {
  const newMetrics = { ...metrics };
  
  newMetrics.totalGamesPlayed++;
  newMetrics.totalPlayTime += playTime;
  newMetrics.gamesByMode[mode]++;
  newMetrics.scoresByMode[mode] = [...newMetrics.scoresByMode[mode], score];
  
  if (score > newMetrics.highScoreByMode[mode]) {
    newMetrics.highScoreByMode[mode] = score;
  }
  
  // Calculate average
  const scores = newMetrics.scoresByMode[mode];
  newMetrics.avgScoreByMode[mode] = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : 0;
  
  // Track longest survival for survival mode
  if (mode === 'obstacles' && score > newMetrics.longestSurvival) {
    newMetrics.longestSurvival = score;
  }
  
  // Streak tracking (score > 0 counts as a "good" game)
  if (score > 0) {
    newMetrics.currentStreak++;
    if (newMetrics.currentStreak > newMetrics.bestStreak) {
      newMetrics.bestStreak = newMetrics.currentStreak;
    }
  } else {
    newMetrics.currentStreak = 0;
  }
  
  return newMetrics;
}

export default function PlayerMetrics({ metrics, currentMode }: PlayerMetricsProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const modeColor = MODE_COLORS[currentMode];
  const modeName = MODE_NAMES[currentMode];

  return (
    <div className="arcade-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-xs text-[var(--neon-cyan)] flex items-center gap-2">
          <span className="text-base">📊</span> PLAYER METRICS
        </h3>
        <span 
          className="font-pixel text-[10px] px-2 py-0.5 rounded"
          style={{ backgroundColor: `${modeColor}20`, color: modeColor, border: `1px solid ${modeColor}` }}
        >
          {modeName}
        </span>
      </div>

      {metrics.totalGamesPlayed === 0 ? (
        <div className="text-center py-4">
          <p className="font-retro text-xs text-gray-500">NO DATA YET</p>
          <p className="font-retro text-[10px] text-gray-600 mt-1">PLAY TO START TRACKING</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Overall Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="font-pixel text-lg text-[var(--neon-green)] glow-green">
                {metrics.totalGamesPlayed}
              </div>
              <div className="font-retro text-[8px] text-gray-400">GAMES PLAYED</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="font-pixel text-lg text-[var(--neon-cyan)] glow-cyan">
                {formatTime(metrics.totalPlayTime)}
              </div>
              <div className="font-retro text-[8px] text-gray-400">TOTAL TIME</div>
            </div>
          </div>

          {/* Mode-specific stats */}
          <div className="bg-black/30 rounded p-2">
            <div className="font-retro text-[8px] text-gray-400 mb-2 text-center">
              {modeName} STATS
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div 
                  className="font-pixel text-sm"
                  style={{ color: modeColor }}
                >
                  {metrics.gamesByMode[currentMode]}
                </div>
                <div className="font-retro text-[7px] text-gray-500">GAMES</div>
              </div>
              <div>
                <div 
                  className="font-pixel text-sm"
                  style={{ color: modeColor }}
                >
                  {metrics.highScoreByMode[currentMode]}
                </div>
                <div className="font-retro text-[7px] text-gray-500">BEST</div>
              </div>
              <div>
                <div 
                  className="font-pixel text-sm"
                  style={{ color: modeColor }}
                >
                  {metrics.avgScoreByMode[currentMode]}
                </div>
                <div className="font-retro text-[7px] text-gray-500">AVG</div>
              </div>
            </div>
          </div>

          {/* Streaks */}
          <div className="flex justify-between items-center bg-black/30 rounded p-2">
            <div className="text-center flex-1">
              <div className="font-pixel text-sm text-[var(--neon-yellow)]">
                {metrics.currentStreak}
              </div>
              <div className="font-retro text-[7px] text-gray-500">CURRENT STREAK</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-center flex-1">
              <div className="font-pixel text-sm text-[var(--neon-orange)]">
                {metrics.bestStreak}
              </div>
              <div className="font-retro text-[7px] text-gray-500">BEST STREAK</div>
            </div>
          </div>

          {/* Mode-specific bonus stats */}
          {currentMode === 'obstacles' && metrics.longestSurvival > 0 && (
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="font-pixel text-sm text-[var(--neon-orange)]">
                {metrics.longestSurvival}s
              </div>
              <div className="font-retro text-[7px] text-gray-500">LONGEST SURVIVAL</div>
            </div>
          )}

          {/* All modes comparison */}
          <div className="bg-black/30 rounded p-2">
            <div className="font-retro text-[8px] text-gray-400 mb-2 text-center">ALL MODES</div>
            <div className="space-y-1">
              {(['original', 'modified', 'obstacles'] as GameMode[]).map(mode => (
                <div key={mode} className="flex items-center justify-between text-[9px]">
                  <span 
                    className="font-retro"
                    style={{ color: MODE_COLORS[mode] }}
                  >
                    {MODE_NAMES[mode]}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">
                      {metrics.gamesByMode[mode]} games
                    </span>
                    <span 
                      className="font-pixel"
                      style={{ color: MODE_COLORS[mode] }}
                    >
                      {metrics.highScoreByMode[mode]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

