'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { GameMode, MODE_NAMES, MODE_COLORS } from '@/lib/game/types';

interface Score {
  player_name: string;
  score: number;
  game_mode: string;
  created_at: string;
}

interface ModeStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  stdDev: number;
  scores: number[];
}

export default function MetricsPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scatter' | 'trends' | 'leaderboard'>('overview');
  
  const scatterCanvasRef = useRef<HTMLCanvasElement>(null);
  const distributionCanvasRef = useRef<HTMLCanvasElement>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAllScores();
  }, []);

  const fetchAllScores = async () => {
    try {
      const modes = ['original', 'modified', 'obstacles'];
      const allScores: Score[] = [];
      
      for (const mode of modes) {
        const res = await fetch(`/api/scores?mode=${mode}&limit=50`);
        const data = await res.json();
        if (data.scores) {
          allScores.push(...data.scores);
        }
      }
      
      setScores(allScores);
    } catch {
      setError('Failed to load scores');
    } finally {
      setLoading(false);
    }
  };

  const getModeStats = (mode: string): ModeStats => {
    const modeScores = scores.filter(s => s.game_mode === mode).map(s => s.score).sort((a, b) => a - b);
    if (modeScores.length === 0) return { count: 0, avg: 0, min: 0, max: 0, median: 0, stdDev: 0, scores: [] };
    
    const avg = modeScores.reduce((a, b) => a + b, 0) / modeScores.length;
    const median = modeScores.length % 2 === 0 
      ? (modeScores[modeScores.length / 2 - 1] + modeScores[modeScores.length / 2]) / 2
      : modeScores[Math.floor(modeScores.length / 2)];
    const variance = modeScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / modeScores.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      count: modeScores.length,
      avg: Math.round(avg * 10) / 10,
      min: Math.min(...modeScores),
      max: Math.max(...modeScores),
      median,
      stdDev: Math.round(stdDev * 10) / 10,
      scores: modeScores
    };
  };

  const drawScatterPlot = () => {
    const canvas = scatterCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 60;
    
    // Clear with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(10, 10, 20, 0.9)');
    gradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Grid with better visibility
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = padding + (height - padding * 2) * i / 6;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = padding + (width - padding * 2) * i / 5;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    const allScores = scores.map(s => s.score);
    const maxScore = Math.max(...allScores, 100);
    
    // Get time range for x-axis
    const timestamps = scores.map(s => new Date(s.created_at).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;
    
    // Draw points for each mode - scatter by time
    const modes: { mode: string; color: string }[] = [
      { mode: 'original', color: '#39ff14' },
      { mode: 'modified', color: '#ff00ff' },
      { mode: 'obstacles', color: '#ff6600' }
    ];
    
    modes.forEach(({ mode, color }) => {
      const modeScores = scores.filter(s => s.game_mode === mode);
      modeScores.forEach((score) => {
        const scoreTime = new Date(score.created_at).getTime();
        // Add slight random jitter to x position to prevent overlap
        const jitter = (Math.random() - 0.5) * 20;
        const x = padding + ((scoreTime - minTime) / timeRange) * (width - padding * 2) + jitter;
        const y = height - padding - (score.score / maxScore) * (height - padding * 2);
        
        // Outer glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        
        // Draw larger points for outliers
        const isOutlier = score.score > maxScore * 0.6;
        const radius = isOutlier ? 8 : 6;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, radius / 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    
    // Axes labels with better styling
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#39ff14';
    ctx.font = '14px VT323, monospace';
    ctx.fillText('TIME →', width / 2 - 20, height - 15);
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('SCORE →', -20, 0);
    ctx.restore();
    
    // Y-axis values
    ctx.fillStyle = '#888';
    ctx.font = '12px VT323, monospace';
    for (let i = 0; i <= 6; i++) {
      const value = Math.round(maxScore * (6 - i) / 6);
      const y = padding + (height - padding * 2) * i / 6;
      ctx.fillText(value.toString(), 5, y + 4);
    }
  };

  const drawDistribution = () => {
    const canvas = distributionCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 60;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(10, 10, 20, 0.9)');
    gradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Create histogram buckets
    const bucketSize = 20;
    const maxScore = Math.max(...scores.map(s => s.score), 100);
    const numBuckets = Math.ceil(maxScore / bucketSize) + 1;
    
    const modes: { mode: string; color: string }[] = [
      { mode: 'original', color: '#39ff14' },
      { mode: 'modified', color: '#ff00ff' },
      { mode: 'obstacles', color: '#ff6600' }
    ];
    
    const barWidth = (width - padding * 2) / numBuckets / 3;
    
    modes.forEach(({ mode, color }, modeIndex) => {
      const modeScores = scores.filter(s => s.game_mode === mode);
      const buckets = new Array(numBuckets).fill(0);
      
      modeScores.forEach(s => {
        const bucket = Math.floor(s.score / bucketSize);
        if (bucket < numBuckets) buckets[bucket]++;
      });
      
      const maxBucket = Math.max(...buckets, 1);
      
      buckets.forEach((count, i) => {
        const x = padding + i * (width - padding * 2) / numBuckets + modeIndex * barWidth;
        const barHeight = (count / maxBucket) * (height - padding * 2) * 0.8;
        const y = height - padding - barHeight;
        
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
        ctx.globalAlpha = 1;
      });
    });
    
    // X-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '10px VT323, monospace';
    for (let i = 0; i <= numBuckets; i += 2) {
      const x = padding + i * (width - padding * 2) / numBuckets;
      ctx.fillText((i * bucketSize).toString(), x, height - 10);
    }
    ctx.fillText('SCORE RANGE →', width / 2, height - 25);
  };

  const drawTrendLine = () => {
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = 60;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(10, 10, 20, 0.9)');
    gradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - padding * 2) * i / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Group scores by date - show individual scores, not averages
    const modes: { mode: string; color: string }[] = [
      { mode: 'original', color: '#39ff14' },
      { mode: 'modified', color: '#ff00ff' },
      { mode: 'obstacles', color: '#ff6600' }
    ];
    
    const maxScore = Math.max(...scores.map(s => s.score), 100);
    const timestamps = scores.map(s => new Date(s.created_at).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;
    
    modes.forEach(({ mode, color }) => {
      const modeScores = scores
        .filter(s => s.game_mode === mode)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      if (modeScores.length < 2) return;
      
      // Draw line connecting points
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      
      modeScores.forEach((score, i) => {
        const scoreTime = new Date(score.created_at).getTime();
        const x = padding + ((scoreTime - minTime) / timeRange) * (width - padding * 2);
        const y = height - padding - (score.score / maxScore) * (height - padding * 2);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Draw points
      dateAvgs.forEach((point, i) => {
        const x = padding + (i / (dateAvgs.length - 1)) * (width - padding * 2);
        const y = height - padding - (point.avg / maxScore) * (height - padding * 2);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    
    // Labels
    ctx.fillStyle = '#888';
    ctx.font = '12px VT323, monospace';
    ctx.fillText('TIME →', width / 2, height - 10);
  };

  useEffect(() => {
    if (scores.length > 0) {
      drawScatterPlot();
      drawDistribution();
      drawTrendLine();
    }
  }, [scores, activeTab]);

  const stats = {
    original: getModeStats('original'),
    modified: getModeStats('modified'),
    obstacles: getModeStats('obstacles')
  };

  const totalGames = stats.original.count + stats.modified.count + stats.obstacles.count;
  const topPlayers = [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

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
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-green)] glow-green">
              flappy
            </span>
            <span className="font-pixel text-sm md:text-lg text-[var(--neon-cyan)] glow-cyan">
              2
            </span>
          </div>
          
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
        <div className="max-w-6xl mx-auto">
          <h1 className="font-pixel text-xl md:text-2xl text-[var(--neon-cyan)] glow-cyan text-center mb-6">
            📊 GAME ANALYTICS
          </h1>

          {loading ? (
            <div className="text-center py-12">
              <div className="font-pixel text-[var(--neon-green)] animate-pulse-neon">LOADING...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="font-pixel text-red-500">{error}</div>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {(['overview', 'scatter', 'trends', 'leaderboard'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`arcade-panel px-4 py-2 font-pixel text-xs transition-colors ${
                      activeTab === tab 
                        ? 'bg-[var(--neon-magenta)] text-black' 
                        : 'text-[var(--neon-magenta)] hover:bg-[var(--neon-magenta)]/20'
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="arcade-panel p-4 text-center">
                      <div className="font-pixel text-2xl md:text-3xl text-[var(--neon-green)] glow-green">
                        {totalGames}
                      </div>
                      <div className="font-retro text-xs text-gray-400 mt-1">TOTAL GAMES</div>
                    </div>
                    <div className="arcade-panel p-4 text-center">
                      <div className="font-pixel text-2xl md:text-3xl text-[var(--neon-cyan)] glow-cyan">
                        {Math.max(stats.original.max, stats.modified.max, stats.obstacles.max)}
                      </div>
                      <div className="font-retro text-xs text-gray-400 mt-1">ALL-TIME HIGH</div>
                    </div>
                    <div className="arcade-panel p-4 text-center">
                      <div className="font-pixel text-2xl md:text-3xl text-[var(--neon-yellow)]">
                        {Math.round((stats.original.avg * stats.original.count + 
                          stats.modified.avg * stats.modified.count + 
                          stats.obstacles.avg * stats.obstacles.count) / totalGames) || 0}
                      </div>
                      <div className="font-retro text-xs text-gray-400 mt-1">GLOBAL AVG</div>
                    </div>
                    <div className="arcade-panel p-4 text-center">
                      <div className="font-pixel text-2xl md:text-3xl text-[var(--neon-orange)]">
                        {stats.obstacles.max}s
                      </div>
                      <div className="font-retro text-xs text-gray-400 mt-1">LONGEST SURVIVAL</div>
                    </div>
                  </div>

                  {/* Mode Comparison */}
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-magenta)] mb-4 text-center">
                      MODE STATISTICS
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-center">
                        <thead>
                          <tr className="font-retro text-xs text-gray-400">
                            <th className="p-2">MODE</th>
                            <th className="p-2">GAMES</th>
                            <th className="p-2">AVG</th>
                            <th className="p-2">MEDIAN</th>
                            <th className="p-2">MIN</th>
                            <th className="p-2">MAX</th>
                            <th className="p-2">STD DEV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(['original', 'modified', 'obstacles'] as const).map(mode => (
                            <tr key={mode} className="font-pixel text-sm">
                              <td className="p-2" style={{ color: MODE_COLORS[mode] }}>
                                {MODE_NAMES[mode]}
                              </td>
                              <td className="p-2 text-white">{stats[mode].count}</td>
                              <td className="p-2 text-white">{stats[mode].avg}</td>
                              <td className="p-2 text-white">{stats[mode].median}</td>
                              <td className="p-2 text-white">{stats[mode].min}</td>
                              <td className="p-2 text-white">{stats[mode].max}</td>
                              <td className="p-2 text-white">{stats[mode].stdDev}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Score Distribution Histogram */}
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-yellow)] mb-4 text-center">
                      SCORE DISTRIBUTION
                    </h2>
                    <canvas 
                      ref={distributionCanvasRef}
                      className="w-full h-64 rounded"
                    />
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#39ff14' }} />
                        <span className="font-retro text-xs text-gray-400">CLASSIC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff00ff' }} />
                        <span className="font-retro text-xs text-gray-400">POWER-UPS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff6600' }} />
                        <span className="font-retro text-xs text-gray-400">SURVIVAL</span>
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-cyan)] mb-4 text-center">
                      📈 KEY INSIGHTS
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Most Popular Mode</div>
                        <div className="font-pixel text-lg" style={{ 
                          color: stats.original.count >= stats.modified.count && stats.original.count >= stats.obstacles.count 
                            ? '#39ff14' 
                            : stats.modified.count >= stats.obstacles.count ? '#ff00ff' : '#ff6600'
                        }}>
                          {stats.original.count >= stats.modified.count && stats.original.count >= stats.obstacles.count 
                            ? 'CLASSIC' 
                            : stats.modified.count >= stats.obstacles.count ? 'POWER-UPS' : 'SURVIVAL'}
                        </div>
                        <div className="font-retro text-xs text-gray-500 mt-1">
                          {Math.max(stats.original.count, stats.modified.count, stats.obstacles.count)} games played
                        </div>
                      </div>
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Highest Variance Mode</div>
                        <div className="font-pixel text-lg" style={{ 
                          color: stats.obstacles.stdDev >= stats.modified.stdDev && stats.obstacles.stdDev >= stats.original.stdDev 
                            ? '#ff6600' 
                            : stats.modified.stdDev >= stats.original.stdDev ? '#ff00ff' : '#39ff14'
                        }}>
                          {stats.obstacles.stdDev >= stats.modified.stdDev && stats.obstacles.stdDev >= stats.original.stdDev 
                            ? 'SURVIVAL' 
                            : stats.modified.stdDev >= stats.original.stdDev ? 'POWER-UPS' : 'CLASSIC'}
                        </div>
                        <div className="font-retro text-xs text-gray-500 mt-1">
                          σ = {Math.max(stats.original.stdDev, stats.modified.stdDev, stats.obstacles.stdDev)}
                        </div>
                      </div>
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Best Average Score</div>
                        <div className="font-pixel text-lg" style={{ 
                          color: stats.modified.avg >= stats.obstacles.avg && stats.modified.avg >= stats.original.avg 
                            ? '#ff00ff' 
                            : stats.obstacles.avg >= stats.original.avg ? '#ff6600' : '#39ff14'
                        }}>
                          {stats.modified.avg >= stats.obstacles.avg && stats.modified.avg >= stats.original.avg 
                            ? 'POWER-UPS' 
                            : stats.obstacles.avg >= stats.original.avg ? 'SURVIVAL' : 'CLASSIC'}
                        </div>
                        <div className="font-retro text-xs text-gray-500 mt-1">
                          Avg: {Math.max(stats.original.avg, stats.modified.avg, stats.obstacles.avg)}
                        </div>
                      </div>
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Skill Ceiling</div>
                        <div className="font-pixel text-lg text-[var(--neon-yellow)]">
                          {stats.modified.max >= stats.obstacles.max && stats.modified.max >= stats.original.max 
                            ? 'POWER-UPS' 
                            : stats.obstacles.max >= stats.original.max ? 'SURVIVAL' : 'CLASSIC'}
                        </div>
                        <div className="font-retro text-xs text-gray-500 mt-1">
                          Max: {Math.max(stats.original.max, stats.modified.max, stats.obstacles.max)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scatter Tab */}
              {activeTab === 'scatter' && (
                <div className="space-y-6">
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-green)] mb-4 text-center">
                      SCORE SCATTER PLOT (BY TIME)
                    </h2>
                    <canvas 
                      ref={scatterCanvasRef}
                      className="w-full h-80 rounded"
                    />
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#39ff14' }} />
                        <span className="font-retro text-xs text-gray-400">CLASSIC ({stats.original.count})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff00ff' }} />
                        <span className="font-retro text-xs text-gray-400">POWER-UPS ({stats.modified.count})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff6600' }} />
                        <span className="font-retro text-xs text-gray-400">SURVIVAL ({stats.obstacles.count})</span>
                      </div>
                    </div>
                    <p className="font-retro text-xs text-gray-500 text-center mt-4">
                      Each point represents a game. X-axis shows time, Y-axis shows score. Larger dots are outliers.
                    </p>
                  </div>

                  {/* Mode-specific scatter analysis */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {(['original', 'modified', 'obstacles'] as const).map(mode => (
                      <div 
                        key={mode}
                        className="arcade-panel p-4"
                        style={{ borderColor: MODE_COLORS[mode] }}
                      >
                        <h3 className="font-pixel text-xs mb-3 text-center" style={{ color: MODE_COLORS[mode] }}>
                          {MODE_NAMES[mode]}
                        </h3>
                        <div className="space-y-2 font-retro text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Range:</span>
                            <span className="text-white">{stats[mode].min} - {stats[mode].max}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Spread:</span>
                            <span className="text-white">{stats[mode].max - stats[mode].min}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Variance:</span>
                            <span className="text-white">{(stats[mode].stdDev * stats[mode].stdDev).toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Outliers:</span>
                            <span className="text-white">
                              {stats[mode].scores.filter(s => 
                                s > stats[mode].avg + 2 * stats[mode].stdDev || 
                                s < stats[mode].avg - 2 * stats[mode].stdDev
                              ).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === 'trends' && (
                <div className="space-y-6">
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-magenta)] mb-4 text-center">
                      DAILY AVERAGE SCORE TRENDS
                    </h2>
                    <canvas 
                      ref={trendCanvasRef}
                      className="w-full h-80 rounded"
                    />
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#39ff14' }} />
                        <span className="font-retro text-xs text-gray-400">CLASSIC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#ff00ff' }} />
                        <span className="font-retro text-xs text-gray-400">POWER-UPS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5" style={{ backgroundColor: '#ff6600' }} />
                        <span className="font-retro text-xs text-gray-400">SURVIVAL</span>
                      </div>
                    </div>
                    <p className="font-retro text-xs text-gray-500 text-center mt-4">
                      Shows daily average scores over time. Lines connect days with recorded games.
                    </p>
                  </div>

                  {/* Trend Analysis */}
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-yellow)] mb-4 text-center">
                      TREND ANALYSIS
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Data Points</div>
                        <div className="font-pixel text-2xl text-[var(--neon-cyan)]">{totalGames}</div>
                        <div className="font-retro text-xs text-gray-500 mt-1">Total games recorded</div>
                      </div>
                      <div className="bg-black/30 rounded p-4">
                        <div className="font-retro text-xs text-gray-400 mb-2">Date Range</div>
                        <div className="font-pixel text-lg text-[var(--neon-green)]">
                          {[...new Set(scores.map(s => s.created_at.split('T')[0]))].length} days
                        </div>
                        <div className="font-retro text-xs text-gray-500 mt-1">Active playing days</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-6">
                  <div className="arcade-panel p-6">
                    <h2 className="font-pixel text-sm text-[var(--neon-yellow)] mb-4 text-center">
                      🏆 TOP 10 ALL-TIME
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="font-retro text-xs text-gray-400 text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">PLAYER</th>
                            <th className="p-2">SCORE</th>
                            <th className="p-2">MODE</th>
                            <th className="p-2">DATE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topPlayers.map((player, i) => (
                            <tr 
                              key={`${player.player_name}-${player.score}-${i}`}
                              className={`font-pixel text-sm ${i < 3 ? 'text-[var(--neon-yellow)]' : 'text-white'}`}
                            >
                              <td className="p-2">{i + 1}</td>
                              <td className="p-2">{player.player_name}</td>
                              <td className="p-2">{player.score}</td>
                              <td className="p-2">
                                <span 
                                  className="px-2 py-1 rounded text-xs"
                                  style={{ 
                                    backgroundColor: MODE_COLORS[player.game_mode as GameMode] + '33',
                                    color: MODE_COLORS[player.game_mode as GameMode]
                                  }}
                                >
                                  {MODE_NAMES[player.game_mode as GameMode]}
                                </span>
                              </td>
                              <td className="p-2 font-retro text-xs text-gray-400">
                                {player.created_at.split('T')[0]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mode-specific top scores */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {(['original', 'modified', 'obstacles'] as const).map(mode => {
                      const modeTop = scores
                        .filter(s => s.game_mode === mode)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5);
                      
                      return (
                        <div key={mode} className="arcade-panel p-4">
                          <h3 
                            className="font-pixel text-xs mb-3 text-center"
                            style={{ color: MODE_COLORS[mode] }}
                          >
                            TOP 5 {MODE_NAMES[mode]}
                          </h3>
                          <div className="space-y-2">
                            {modeTop.map((s, i) => (
                              <div 
                                key={`${s.player_name}-${s.score}-${i}`}
                                className="flex justify-between items-center font-retro text-xs"
                              >
                                <span className="text-gray-400">{i + 1}. {s.player_name}</span>
                                <span style={{ color: MODE_COLORS[mode] }}>{s.score}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Refresh button */}
              <div className="text-center mt-8">
                <button 
                  onClick={() => {
                    setLoading(true);
                    fetchAllScores();
                  }}
                  className="arcade-panel px-6 py-2 font-pixel text-xs text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black transition-colors"
                >
                  REFRESH DATA
                </button>
              </div>
            </>
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
