import { NextResponse } from 'next/server';
import {
  getLatestTranscripts,
  getTranscriptStats,
  getRecentTranscripts,
  getCombinedRecentTranscript,
} from '@/lib/transcript-store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '10', 10);
    const minutes = parseInt(searchParams.get('minutes') || '0', 10);
    const combined = searchParams.get('combined') === 'true';

    // Get recent transcripts by time window
    if (minutes > 0) {
      if (combined) {
        const text = getCombinedRecentTranscript(minutes);
        return NextResponse.json({
          success: true,
          combinedTranscript: text,
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          minutes,
        });
      }
      
      const transcripts = getRecentTranscripts(minutes);
      return NextResponse.json({
        success: true,
        transcripts,
        count: transcripts.length,
        minutes,
      });
    }

    // Get latest N transcripts
    const transcripts = getLatestTranscripts(count);
    const stats = getTranscriptStats();

    return NextResponse.json({
      success: true,
      transcripts,
      stats,
    });
  } catch (error) {
    console.error('[Transcripts API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
