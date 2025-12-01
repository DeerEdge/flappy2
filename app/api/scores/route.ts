import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase credentials not configured:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseAnonKey 
      });
      return null;
    }
    
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode') || 'original';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  try {
    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    const { data, error } = await client
      .from('scores')
      .select('*')
      .eq('game_mode', mode)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
    }

    return NextResponse.json({ scores: data || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_name, score, game_mode } = body;

    // Validation
    if (typeof score !== 'number' || score < 0 || score > 9999) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    if (!['original', 'modified', 'obstacles'].includes(game_mode)) {
      return NextResponse.json({ error: 'Invalid game mode' }, { status: 400 });
    }

    const name = (player_name || 'Anonymous').slice(0, 20).trim() || 'Anonymous';

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    
    const { data, error } = await client
      .from('scores')
      .insert({
        player_name: name,
        score,
        game_mode,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
    }

    return NextResponse.json({ success: true, score: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

