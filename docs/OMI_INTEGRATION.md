# OMI Integration Guide

This document explains how to integrate OMI.me wearable device audio with the Voco emergency response dashboard.

## Overview

OMI.me is a wearable device that can capture audio and send it to webhooks. This integration allows OMI audio to be:

1. Received via webhook at `/api/omi/webhook`
2. Processed through Gemini AI for analysis
3. Displayed in real-time on the dashboard
4. Optionally played back via ElevenLabs TTS

## Setup

### 1. Environment Variables

Make sure you have the following environment variables set:

```env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_key (optional)
NEXT_PUBLIC_ELEVENLABS_VOICE_ID=your_voice_id (optional)
```

### 2. Configure OMI Device

In your OMI.me device settings, configure the webhook URL:

```
https://your-domain.com/api/omi/webhook
```

## API Endpoints

### POST `/api/omi/webhook`

Receives audio from OMI device and processes it through Gemini.

**Accepted Formats:**

1. **JSON with base64 audio:**
```json
{
  "audio_base64": "base64_encoded_audio",
  "mime_type": "audio/wav",
  "device_id": "optional_device_id",
  "session_id": "optional_session_id"
}
```

2. **JSON with audio URL:**
```json
{
  "audio_url": "https://example.com/audio.wav",
  "device_id": "optional_device_id"
}
```

3. **Multipart form data:**
- `audio`: Audio file
- `device_id`: Optional device identifier
- `session_id`: Optional session identifier

4. **Raw audio:**
- Content-Type: `audio/wav`, `audio/webm`, etc.
- Body: Raw audio bytes

**Response:**
```json
{
  "success": true,
  "eventId": "omi-1234567890-abc123",
  "analysis": {
    "internalMonologue": ["Analysis point 1", "Analysis point 2"],
    "voiceResponse": "Response text for TTS",
    "location": {
      "lat": 37.6688,
      "lng": -122.0808,
      "city": "Hayward, CA"
    },
    "transcript": "Transcription of the audio",
    "urgencyLevel": "low|medium|high|critical",
    "emotionalState": ["calm", "anxious", "fearful"]
  },
  "hospitals": [...]
}
```

### GET `/api/omi/webhook`

Health check endpoint for webhook verification.

### GET `/api/omi/events`

Server-Sent Events (SSE) endpoint for real-time updates.

```javascript
const eventSource = new EventSource('/api/omi/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('OMI Event:', data);
};
```

### GET `/api/omi/history`

Get recent OMI events.

**Query Parameters:**
- `limit`: Maximum number of events (default: 10, max: 50)

**Response:**
```json
{
  "events": [...],
  "count": 10
}
```

## Dashboard Integration

The dashboard automatically connects to the SSE endpoint and displays:

1. **OMI Panel** - Shows connection status and recent events
2. **Real-time Updates** - Monologue, voice response, and location update as OMI audio is processed
3. **Audio Source Indicator** - Shows whether current audio is from microphone or OMI device
4. **Transcript Display** - Shows transcription of OMI audio when available

## Event Flow

1. OMI device captures audio and sends to webhook
2. Server receives audio and creates event with status "received"
3. Server updates event to "processing" and sends to Gemini
4. Gemini analyzes audio and returns structured response
5. Server updates event to "completed" with analysis
6. Dashboard receives SSE update and displays results
7. Optionally, TTS plays the voice response

## Testing

You can test the webhook using curl:

```bash
# Test with base64 audio
curl -X POST https://your-domain.com/api/omi/webhook \
  -H "Content-Type: application/json" \
  -d '{"audio_base64": "BASE64_ENCODED_AUDIO", "mime_type": "audio/wav"}'

# Test with raw audio file
curl -X POST https://your-domain.com/api/omi/webhook \
  -H "Content-Type: audio/wav" \
  --data-binary @test-audio.wav
```

## Troubleshooting

### Connection Issues
- Check that the SSE connection is established (green indicator in OMI Panel)
- Verify network allows SSE connections

### No Audio Processing
- Verify GEMINI_API_KEY is set correctly
- Check server logs for processing errors

### Dashboard Not Updating
- Ensure the SSE endpoint is accessible
- Check browser console for connection errors
