import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

const METRICS_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('global_metrics')
      .select('*')
      .eq('id', METRICS_ID)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Calculate averages
    const metrics = {
      totalGamesPlayed: data.total_games_played || 0,
      totalPlayTime: Math.round(data.total_play_time_seconds || 0),
      gamesByMode: {
        original: data.games_original || 0,
        modified: data.games_modified || 0,
        obstacles: data.games_obstacles || 0,
      },
      highScoreByMode: {
        original: data.high_score_original || 0,
        modified: data.high_score_modified || 0,
        obstacles: data.high_score_obstacles || 0,
      },
      avgScoreByMode: {
        original: data.games_original > 0 
          ? Math.round((data.total_score_original / data.games_original) * 10) / 10 
          : 0,
        modified: data.games_modified > 0 
          ? Math.round((data.total_score_modified / data.games_modified) * 10) / 10 
          : 0,
        obstacles: data.games_obstacles > 0 
          ? Math.round((data.total_score_obstacles / data.games_obstacles) * 10) / 10 
          : 0,
      },
      longestSurvival: data.longest_survival || 0,
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { score, game_mode, play_time } = body;

    // Validation
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    if (!['original', 'modified', 'obstacles'].includes(game_mode)) {
      return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // First get current metrics
    const { data: current, error: fetchError } = await client
      .from('global_metrics')
      .select('*')
      .eq('id', METRICS_ID)
      .single();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Prepare update based on game mode
    const updates: Record<string, number> = {
      total_games_played: (current.total_games_played || 0) + 1,
      total_play_time_seconds: (current.total_play_time_seconds || 0) + (play_time || 0),
      updated_at: Date.now(),
    };

    // Update mode-specific stats
    if (game_mode === 'original') {
      updates.games_original = (current.games_original || 0) + 1;
      updates.total_score_original = (current.total_score_original || 0) + score;
      if (score > (current.high_score_original || 0)) {
        updates.high_score_original = score;
      }
    } else if (game_mode === 'modified') {
      updates.games_modified = (current.games_modified || 0) + 1;
      updates.total_score_modified = (current.total_score_modified || 0) + score;
      if (score > (current.high_score_modified || 0)) {
        updates.high_score_modified = score;
      }
    } else if (game_mode === 'obstacles') {
      updates.games_obstacles = (current.games_obstacles || 0) + 1;
      updates.total_score_obstacles = (current.total_score_obstacles || 0) + score;
      if (score > (current.high_score_obstacles || 0)) {
        updates.high_score_obstacles = score;
      }
      if (score > (current.longest_survival || 0)) {
        updates.longest_survival = score;
      }
    }

    // Update metrics
    const { error: updateError } = await client
      .from('global_metrics')
      .update(updates)
      .eq('id', METRICS_ID);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update metrics' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

