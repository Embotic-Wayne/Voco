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

// In-memory store for transcripts
const store: TranscriptStore = {
  transcripts: [],
  maxEntries: 100, // Keep last 100 transcripts
  lastUpdated: null,
};

// Generate unique ID
function generateId(): string {
  return `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Add a new transcript
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

  store.transcripts.unshift(entry); // Add to beginning (newest first)
  store.lastUpdated = new Date();

  // Trim to max entries
  if (store.transcripts.length > store.maxEntries) {
    store.transcripts = store.transcripts.slice(0, store.maxEntries);
  }

  console.log(`[TranscriptStore] Added transcript ${entry.id}: "${transcript.substring(0, 50)}..." (${entry.wordCount} words)`);

  return entry;
}

// Update transcript with analysis
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

// Get latest transcript
export function getLatestTranscript(): TranscriptEntry | null {
  return store.transcripts[0] || null;
}

// Get latest N transcripts
export function getLatestTranscripts(count: number = 10): TranscriptEntry[] {
  return store.transcripts.slice(0, count);
}

// Get all transcripts for a user
export function getTranscriptsByUser(userId: string): TranscriptEntry[] {
  return store.transcripts.filter(t => t.userId === userId);
}

// Get transcript by ID
export function getTranscriptById(id: string): TranscriptEntry | null {
  return store.transcripts.find(t => t.id === id) || null;
}

// Get transcripts from last N minutes
export function getRecentTranscripts(minutes: number = 5): TranscriptEntry[] {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return store.transcripts.filter(t => t.timestamp >= cutoff);
}

// Get combined transcript text from recent entries
export function getCombinedRecentTranscript(minutes: number = 5): string {
  const recent = getRecentTranscripts(minutes);
  return recent
    .reverse() // Oldest first for reading order
    .map(t => t.transcript)
    .join(' ');
}

// Get store stats
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

// Clear all transcripts
export function clearTranscripts(): void {
  store.transcripts = [];
  store.lastUpdated = null;
  console.log('[TranscriptStore] Cleared all transcripts');
}

// Export store for debugging
export function getStore(): TranscriptStore {
  return { ...store, transcripts: [...store.transcripts] };
}
