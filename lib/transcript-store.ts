// Transcript Store - Stores incoming transcripts from OMI
// Keeps latest transcripts in memory with timestamps

export interface TranscriptEntry {
  id: string;
  timestamp: Date;
  transcript: string;
  userId: string;
  sessionId?: string;
  duration?: number;
  wordCount: number;
  processed: boolean;
  analysis?: {
    summary?: string;
    intent?: string;
    entities?: string[];
    sentiment?: string;
  };
}

export interface TranscriptStore {
  transcripts: TranscriptEntry[];
  maxEntries: number;
  lastUpdated: Date | null;
}

const store: TranscriptStore = {
  transcripts: [],
  maxEntries: 100,
  lastUpdated: null,
};

function generateId(): string {
  return `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function addTranscript(
  transcript: string,
  userId: string,
  sessionId?: string,
  duration?: number
): TranscriptEntry {
  const entry: TranscriptEntry = {
    id: generateId(),
    timestamp: new Date(),
    transcript: transcript.trim(),
    userId,
    sessionId,
    duration,
    wordCount: transcript.trim().split(/\s+/).filter(w => w.length > 0).length,
    processed: false,
  };

  store.transcripts.unshift(entry);
  store.lastUpdated = new Date();

  if (store.transcripts.length > store.maxEntries) {
    store.transcripts = store.transcripts.slice(0, store.maxEntries);
  }

  console.log(`[TranscriptStore] Added transcript ${entry.id}: "${transcript.substring(0, 50)}..." (${entry.wordCount} words)`);

  return entry;
}

export function updateTranscriptAnalysis(
  id: string,
  analysis: TranscriptEntry['analysis']
): TranscriptEntry | null {
  const entry = store.transcripts.find(t => t.id === id);
  if (entry) {
    entry.analysis = analysis;
    entry.processed = true;
    store.lastUpdated = new Date();
    console.log(`[TranscriptStore] Updated analysis for ${id}`);
    return entry;
  }
  return null;
}

export function getLatestTranscript(): TranscriptEntry | null {
  return store.transcripts[0] || null;
}

export function getLatestTranscripts(count: number = 10): TranscriptEntry[] {
  return store.transcripts.slice(0, count);
}

export function getTranscriptsByUser(userId: string): TranscriptEntry[] {
  return store.transcripts.filter(t => t.userId === userId);
}

export function getTranscriptById(id: string): TranscriptEntry | null {
  return store.transcripts.find(t => t.id === id) || null;
}

export function getRecentTranscripts(minutes: number = 5): TranscriptEntry[] {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return store.transcripts.filter(t => t.timestamp >= cutoff);
}

export function getCombinedRecentTranscript(minutes: number = 5): string {
  const recent = getRecentTranscripts(minutes);
  return recent
    .reverse()
    .map(t => t.transcript)
    .join(' ');
}

export function getTranscriptStats(): {
  totalCount: number;
  processedCount: number;
  lastUpdated: Date | null;
  totalWords: number;
  recentCount: number;
} {
  const recentCount = getRecentTranscripts(5).length;
  return {
    totalCount: store.transcripts.length,
    processedCount: store.transcripts.filter(t => t.processed).length,
    lastUpdated: store.lastUpdated,
    totalWords: store.transcripts.reduce((sum, t) => sum + t.wordCount, 0),
    recentCount,
  };
}

export function clearTranscripts(): void {
  store.transcripts = [];
  store.lastUpdated = null;
  console.log('[TranscriptStore] Cleared all transcripts');
}

export function getStore(): TranscriptStore {
  return { ...store, transcripts: [...store.transcripts] };
}
