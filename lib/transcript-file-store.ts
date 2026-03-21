// File-based transcript storage
// Saves transcripts to /data/transcripts folder

import fs from 'fs';
import path from 'path';

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'data', 'transcripts');

export interface SavedTranscript {
  id: string;
  timestamp: string;
  userId: string;
  sessionId?: string;
  transcript: string;
  wordCount: number;
  analysis?: {
    summary?: string;
    urgencyLevel?: string;
    sentiment?: string;
  };
}

// Ensure directory exists
function ensureDir() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }
}

// Save transcript to file
export function saveTranscriptToFile(transcript: SavedTranscript): string {
  ensureDir();
  
  const filename = `transcript-${Date.now()}-${transcript.id}.json`;
  const filepath = path.join(TRANSCRIPTS_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(transcript, null, 2));
  console.log(`[TranscriptFile] Saved: ${filename}`);
  
  return filename;
}

// Get latest transcript file
export function getLatestTranscriptFile(): SavedTranscript | null {
  ensureDir();
  
  const files = fs.readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.startsWith('transcript-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  
  const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, files[0]), 'utf-8');
  return JSON.parse(content);
}

// Get all transcript files (newest first)
export function getAllTranscriptFiles(limit: number = 50): SavedTranscript[] {
  ensureDir();
  
  const files = fs.readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.startsWith('transcript-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);
  
  return files.map(f => {
    const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, f), 'utf-8');
    return JSON.parse(content);
  });
}

// Get transcripts from today
export function getTodayTranscripts(): SavedTranscript[] {
  ensureDir();
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const files = fs.readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.startsWith('transcript-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  const transcripts: SavedTranscript[] = [];
  
  for (const f of files) {
    const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, f), 'utf-8');
    const transcript = JSON.parse(content);
    
    if (transcript.timestamp && transcript.timestamp.startsWith(today)) {
      transcripts.push(transcript);
    }
  }
  
  return transcripts;
}

// Get combined transcript text from recent files
export function getCombinedTranscriptText(limit: number = 10): string {
  const transcripts = getAllTranscriptFiles(limit);
  return transcripts
    .reverse() // Oldest first for reading order
    .map(t => t.transcript)
    .join(' ');
}

// Count total transcripts
export function countTranscripts(): number {
  ensureDir();
  
  return fs.readdirSync(TRANSCRIPTS_DIR)
    .filter(f => f.startsWith('transcript-') && f.endsWith('.json'))
    .length;
}
