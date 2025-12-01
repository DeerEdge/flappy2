'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GameMode, MODE_NAMES, MODE_COLORS } from '@/lib/game/types';

interface GlobalMetrics {
  totalGamesPlayed: number;
  totalPlayTime: number;
  gamesByMode: Record<GameMode, number>;
  highScoreByMode: Record<GameMode, number>;
  avgScoreByMode: Record<GameMode, number>;
  longestSurvival: number;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics');
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setMetrics(data.metrics);
      }
    } catch {
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

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
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--neon-cyan)] opacity-5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--neon-magenta)] opacity-5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 min-h-screen p-4 md:p-6">
        {/* Header with navigation */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-green)] glow-green">
              flappy
            </span>
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-cyan)] glow-cyan">
              2
            </span>
          </div>
          
          {/* Navigation */}
          <nav className="flex gap-2">
            <Link href="/">
              <button className="arcade-panel px-4 py-2 font-pixel text-xs text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition-colors">
                PLAY!
              </button>
            </Link>
            <button className="arcade-panel px-4 py-2 font-pixel text-xs bg-[var(--neon-cyan)] text-black">
              METRICS
            </button>
          </nav>
        </header>

        {/* Main content */}
        <div className="max-w-4xl mx-auto">
          <h1 className="font-pixel text-2xl text-[var(--neon-cyan)] glow-cyan text-center mb-8">
            📊 GLOBAL PLAYER METRICS
          </h1>

          {loading ? (
            <div className="text-center py-12">
              <div className="font-pixel text-[var(--neon-green)] animate-pulse-neon">LOADING...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="font-pixel text-red-500">{error}</div>
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="arcade-panel p-4 text-center">
                  <div className="font-pixel text-3xl text-[var(--neon-green)] glow-green">
                    {metrics.totalGamesPlayed}
                  </div>
                  <div className="font-retro text-xs text-gray-400 mt-1">TOTAL GAMES</div>
                </div>
                <div className="arcade-panel p-4 text-center">
                  <div className="font-pixel text-3xl text-[var(--neon-cyan)] glow-cyan">
                    {formatTime(metrics.totalPlayTime)}
                  </div>
                  <div className="font-retro text-xs text-gray-400 mt-1">TOTAL PLAYTIME</div>
                </div>
                <div className="arcade-panel p-4 text-center">
                  <div className="font-pixel text-3xl text-[var(--neon-yellow)]">
                    {Math.max(
                      metrics.highScoreByMode.original,
                      metrics.highScoreByMode.modified,
                      metrics.highScoreByMode.obstacles
                    )}
                  </div>
                  <div className="font-retro text-xs text-gray-400 mt-1">ALL-TIME HIGH</div>
                </div>
                <div className="arcade-panel p-4 text-center">
                  <div className="font-pixel text-3xl text-[var(--neon-orange)]">
                    {metrics.longestSurvival}s
                  </div>
                  <div className="font-retro text-xs text-gray-400 mt-1">LONGEST SURVIVAL</div>
                </div>
              </div>

              {/* Mode Breakdown */}
              <div className="arcade-panel p-6">
                <h2 className="font-pixel text-sm text-[var(--neon-magenta)] mb-4 text-center">
                  MODE BREAKDOWN
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {(['original', 'modified', 'obstacles'] as GameMode[]).map(mode => (
                    <div 
                      key={mode}
                      className="bg-black/30 rounded-lg p-4 border-2"
                      style={{ borderColor: MODE_COLORS[mode] }}
                    >
                      <div 
                        className="font-pixel text-sm mb-3 text-center"
                        style={{ color: MODE_COLORS[mode] }}
                      >
                        {MODE_NAMES[mode]}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-retro text-xs text-gray-400">Games</span>
                          <span 
                            className="font-pixel text-lg"
                            style={{ color: MODE_COLORS[mode] }}
                          >
                            {metrics.gamesByMode[mode]}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-retro text-xs text-gray-400">High Score</span>
                          <span 
                            className="font-pixel text-lg"
                            style={{ color: MODE_COLORS[mode] }}
                          >
                            {metrics.highScoreByMode[mode]}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-retro text-xs text-gray-400">Average</span>
                          <span 
                            className="font-pixel text-lg"
                            style={{ color: MODE_COLORS[mode] }}
                          >
                            {metrics.avgScoreByMode[mode]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fun Stats */}
              <div className="arcade-panel p-6">
                <h2 className="font-pixel text-sm text-[var(--neon-yellow)] mb-4 text-center">
                  FUN FACTS
                </h2>
                <div className="grid md:grid-cols-2 gap-4 text-center">
                  <div className="bg-black/30 rounded p-3">
                    <div className="font-retro text-xs text-gray-400 mb-1">Most Popular Mode</div>
                    <div className="font-pixel text-lg" style={{ 
                      color: MODE_COLORS[
                        Object.entries(metrics.gamesByMode)
                          .sort(([,a], [,b]) => b - a)[0]?.[0] as GameMode || 'original'
                      ]
                    }}>
                      {MODE_NAMES[
                        Object.entries(metrics.gamesByMode)
                          .sort(([,a], [,b]) => b - a)[0]?.[0] as GameMode || 'original'
                      ]}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded p-3">
                    <div className="font-retro text-xs text-gray-400 mb-1">Avg Game Length</div>
                    <div className="font-pixel text-lg text-[var(--neon-cyan)]">
                      {metrics.totalGamesPlayed > 0 
                        ? formatTime(metrics.totalPlayTime / metrics.totalGamesPlayed)
                        : '0s'}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded p-3">
                    <div className="font-retro text-xs text-gray-400 mb-1">Total Points Scored</div>
                    <div className="font-pixel text-lg text-[var(--neon-green)]">
                      {(
                        metrics.avgScoreByMode.original * metrics.gamesByMode.original +
                        metrics.avgScoreByMode.modified * metrics.gamesByMode.modified +
                        metrics.avgScoreByMode.obstacles * metrics.gamesByMode.obstacles
                      ).toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded p-3">
                    <div className="font-retro text-xs text-gray-400 mb-1">Best Mode Avg</div>
                    <div className="font-pixel text-lg" style={{
                      color: MODE_COLORS[
                        Object.entries(metrics.avgScoreByMode)
                          .sort(([,a], [,b]) => b - a)[0]?.[0] as GameMode || 'original'
                      ]
                    }}>
                      {MODE_NAMES[
                        Object.entries(metrics.avgScoreByMode)
                          .sort(([,a], [,b]) => b - a)[0]?.[0] as GameMode || 'original'
                      ]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Refresh button */}
              <div className="text-center">
                <button 
                  onClick={fetchMetrics}
                  className="arcade-panel px-6 py-2 font-pixel text-xs text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition-colors"
                >
                  REFRESH STATS
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="font-pixel text-gray-500">NO DATA AVAILABLE</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="font-pixel text-[8px] text-[var(--neon-green)] opacity-40">
            © 2025 ARCADE CLASSICS
          </p>
        </footer>
      </div>
    </main>
  );
}

