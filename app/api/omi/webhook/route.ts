import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { omiStore, type OmiAudioEvent } from "@/lib/omi-store"
import { addTranscript, updateTranscriptAnalysis } from "@/lib/transcript-store"
import { saveTranscriptToFile } from "@/lib/transcript-file-store"
import type { Hospital } from "@/components/dashboard/types"

const MOCK_HOSPITALS: Hospital[] = [
  { id: "st-rose", name: "St. Rose Hospital", lat: 37.6646, lng: -122.0937, distance: "0.9 mi" },
  { id: "eden", name: "Eden Medical Center", lat: 37.6758, lng: -122.0794, distance: "1.1 mi" },
  { id: "kaiser", name: "Kaiser San Leandro", lat: 37.7117, lng: -122.1478, distance: "4.2 mi" },
]

// Processing configuration - CHANGE THIS TO CONTROL TOKEN USAGE
const PROCESSING_CONFIG = {
  // 'transcript' - Only process transcripts, skip audio (lowest token usage)
  // 'smart' - Process transcripts, only use audio if no transcript
  // 'audio' - Always process audio (highest token usage)
  mode: 'transcript' as 'transcript' | 'smart' | 'audio',
  
  // Completely disable audio processing (ignore audio even in 'smart' or 'audio' mode)
  disableAudio: true,
  
  // Minimum transcript length to process (skip very short utterances)
  minTranscriptLength: 5,
  
  // Keywords that trigger immediate processing regardless of length
  urgentKeywords: ['help', 'emergency', 'hurt', 'pain', 'accident', 'fire', 'police', 'ambulance', 'hospital', 'doctor', 'dying', 'attack', 'bleeding', 'breath'],
}

const fallbackAnalysis = {
  internalMonologue: [
    "Audio received from OMI device.",
    "Processing speech patterns and content.",
    "Analyzing for urgency markers.",
  ],
  voiceResponse: "OMI audio received and processed. Standing by for further instructions.",
  location: { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" },
  transcript: "",
  urgencyLevel: "low" as const,
  emotionalState: ["neutral"],
}

function parseResponseJSON(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
  const text = fenced ?? raw
  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  const candidate = text.slice(firstBrace, lastBrace + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

// Check if transcript contains urgent keywords
function containsUrgentKeywords(text: string): boolean {
  const lower = text.toLowerCase()
  return PROCESSING_CONFIG.urgentKeywords.some(keyword => lower.includes(keyword))
}

// Process transcript using Gemini (much cheaper than audio)
async function processTranscriptWithGemini(
  genAI: GoogleGenerativeAI,
  transcript: string
): Promise<string> {
  // Try multiple models - use current valid model names
  const modelNames = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"]
  
  const prompt = `You are the Voco Emergency Brain, analyzing a transcript from an OMI wearable device.

Transcript: "${transcript}"

Analyze this transcript for:
1. Urgency level and emotional state
2. Any signs of distress or emergency
3. Key information that should be acted upon

For this demo, always set location to Hayward, CA (lat 37.6688, lng -122.0808).

Return JSON only with keys:
{
  "internalMonologue": string[],  // Your reasoning process, 3-5 tactical observations
  "voiceResponse": string,         // What to say back to the user
  "location": {"lat": number, "lng": number, "city": string},
  "transcript": string,            // Echo back the transcript
  "urgencyLevel": "low" | "medium" | "high" | "critical",
  "emotionalState": string[]       // Detected emotions: ["calm", "anxious", "fearful", etc.]
}

Keep monologue concise, tactical, and specific to what you analyze.`

  let lastError: unknown = null
  for (const modelName of modelNames) {
    try {
      console.log(`[OMI] Trying Gemini model: ${modelName}`)
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      console.log(`[OMI] Success with model: ${modelName}`)
      return result.response.text()
    } catch (error) {
      console.log(`[OMI] Model ${modelName} failed, trying next...`)
      lastError = error
    }
  }
  
  throw lastError ?? new Error("All Gemini models failed")
}

// Process audio using Gemini (more expensive)
async function processAudioWithGemini(
  genAI: GoogleGenerativeAI,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const candidateModels = ["gemini-2.0-flash", "gemini-2.5-flash"]
  let lastError: unknown = null

  const prompt = `You are the Voco Emergency Brain, receiving audio from an OMI wearable device.
Analyze this audio for:
1. Speech content and transcription
2. Emotional state and urgency indicators
3. Any signs of distress or emergency

For this demo, always set location to Hayward, CA (lat 37.6688, lng -122.0808).

Return JSON only with keys:
{
  "internalMonologue": string[],  // Your reasoning process, 3-5 tactical observations
  "voiceResponse": string,         // What to say back to the user
  "location": {"lat": number, "lng": number, "city": string},
  "transcript": string,            // Transcription of the audio
  "urgencyLevel": "low" | "medium" | "high" | "critical",
  "emotionalState": string[]       // Detected emotions: ["calm", "anxious", "fearful", etc.]
}

Keep monologue concise, tactical, and specific to what you hear.`

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
      ])
      return result.response.text()
    } catch (error) {
      lastError = error
      console.log(`[OMI] Model ${modelName} failed, trying next...`)
    }
  }

  throw lastError ?? new Error("All Gemini candidate models failed")
}

// Main webhook handler
export async function POST(request: Request) {
  const eventId = `omi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const startTime = Date.now()

  try {
    const contentType = request.headers.get("content-type") || ""
    const url = new URL(request.url)
    const userId = url.searchParams.get("uid") || "unknown"

    let audioBase64: string | undefined
    let mimeType = "audio/wav"
    let deviceId: string | undefined
    let sessionId: string | undefined
    let transcript: string | undefined
    let segments: Array<{ text: string; start: number; end: number }> = []

    // Parse incoming data based on content type
    if (contentType.includes("application/json")) {
      const body = await request.json()
      
      console.log(`[OMI] Received JSON payload. Keys: ${Object.keys(body).join(", ")}`)
      
      // Extract transcript from various possible fields
      transcript = body.transcript || body.text || ""
      
      // OMI sends segments array with transcribed text
      if (body.segments && Array.isArray(body.segments)) {
        segments = body.segments
        // Combine all segment texts if no direct transcript
        if (!transcript && segments.length > 0) {
          transcript = segments.map((s: { text: string }) => s.text).join(" ").trim()
        }
      }
      
      // Extract audio data
      audioBase64 = body.audio_base64 || body.audioBase64 || body.audio
      mimeType = body.mime_type || body.mimeType || body.format || "audio/wav"
      deviceId = body.device_id || body.deviceId
      sessionId = body.session_id || body.sessionId

      // Fetch audio from URL if provided
      if (!audioBase64 && (body.audio_url || body.audioUrl)) {
        try {
          const audioResponse = await fetch(body.audio_url || body.audioUrl)
          if (audioResponse.ok) {
            const audioBuffer = await audioResponse.arrayBuffer()
            audioBase64 = Buffer.from(audioBuffer).toString("base64")
            const contentTypeHeader = audioResponse.headers.get("content-type")
            if (contentTypeHeader) mimeType = contentTypeHeader
          }
        } catch (error) {
          console.error("[OMI] Failed to fetch audio from URL:", error)
        }
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const audioFile = formData.get("audio") as File | null
      transcript = formData.get("transcript") as string | null || undefined
      deviceId = formData.get("device_id") as string | null || undefined
      sessionId = formData.get("session_id") as string | null || undefined

      if (audioFile) {
        const buffer = await audioFile.arrayBuffer()
        audioBase64 = Buffer.from(buffer).toString("base64")
        mimeType = audioFile.type || "audio/wav"
      }
    } else if (contentType.includes("audio/") || contentType.includes("application/octet-stream")) {
      const buffer = await request.arrayBuffer()
      audioBase64 = Buffer.from(buffer).toString("base64")
      mimeType = contentType.includes("audio/") ? contentType : "audio/wav"
    }

    // Log what we received
    console.log(`[OMI] Processing - Mode: ${PROCESSING_CONFIG.mode}, Transcript: ${transcript ? `"${transcript.substring(0, 50)}..."` : "none"}, Audio: ${audioBase64 ? `${Math.round(audioBase64.length / 1024)}KB` : "none"}`)

    // DECISION: What to process?
    const hasTranscript = !!(transcript && transcript.trim().length >= PROCESSING_CONFIG.minTranscriptLength)
    const hasAudio = !!audioBase64
    const isUrgent = transcript ? containsUrgentKeywords(transcript) : false

    // Store transcript in the transcript store (always, even if short)
    let storedTranscriptId: string | undefined
    if (transcript && transcript.trim().length > 0) {
      const stored = addTranscript(transcript.trim(), userId, sessionId)
      storedTranscriptId = stored.id
      console.log(`[OMI] Stored transcript ${storedTranscriptId}`)
      
      // Also save to file system
      saveTranscriptToFile({
        id: stored.id,
        timestamp: new Date().toISOString(),
        userId,
        sessionId,
        transcript: transcript.trim(),
        wordCount: stored.wordCount,
      })
    }

    // Skip processing if transcript is too short and not urgent
    if (transcript && transcript.trim().length > 0 && transcript.trim().length < PROCESSING_CONFIG.minTranscriptLength && !isUrgent) {
      console.log(`[OMI] Skipping - transcript too short (${transcript.trim().length} chars)`)
      
      const skippedEvent: OmiAudioEvent = {
        id: eventId,
        timestamp: new Date(),
        status: "completed",
        deviceId,
        sessionId,
        analysis: {
          internalMonologue: [
            "Short utterance received from OMI.",
            `Content: "${transcript}"`,
            "Skipping full analysis - insufficient content.",
          ],
          voiceResponse: "",
          location: { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" },
          transcript: transcript || "",
          urgencyLevel: "low",
          emotionalState: ["neutral"],
        },
      }
      omiStore.addEvent(skippedEvent)

      return NextResponse.json({
        success: true,
        eventId,
        skipped: true,
        reason: "transcript_too_short",
        processingTime: Date.now() - startTime,
      })
    }

    // Determine processing strategy
    let shouldProcessTranscript = false
    let shouldProcessAudio = false

    // If audio is disabled, force transcript-only mode
    if (PROCESSING_CONFIG.disableAudio) {
      shouldProcessTranscript = hasTranscript
      shouldProcessAudio = false
      console.log(`[OMI] Audio DISABLED - transcript only mode`)
    } else {
      switch (PROCESSING_CONFIG.mode) {
        case 'transcript':
          // Only process transcripts, never audio
          shouldProcessTranscript = hasTranscript
          shouldProcessAudio = false
          break
        
        case 'smart':
          // Prefer transcript, fallback to audio
          shouldProcessTranscript = hasTranscript
          shouldProcessAudio = !hasTranscript && hasAudio
          break
        
        case 'audio':
          // Always process audio if available
          shouldProcessTranscript = hasTranscript && !hasAudio
          shouldProcessAudio = hasAudio
          break
      }
    }

    // If nothing to process, return early
    if (!shouldProcessTranscript && !shouldProcessAudio) {
      console.log(`[OMI] Nothing to process - no transcript or audio`)
      
      return NextResponse.json({
        success: true,
        eventId,
        skipped: true,
        reason: "no_content",
        processingTime: Date.now() - startTime,
      })
    }

    // Create initial event
    const initialEvent: OmiAudioEvent = {
      id: eventId,
      timestamp: new Date(),
      status: "processing",
      deviceId,
      sessionId,
      audioData: audioBase64 ? { format: mimeType } : undefined,
    }
    omiStore.addEvent(initialEvent)

    // Get Gemini API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn("[OMI] GEMINI_API_KEY not configured, using fallback")
      
      omiStore.updateEvent(eventId, {
        status: "completed",
        analysis: {
          ...fallbackAnalysis,
          transcript: transcript || "",
          internalMonologue: [
            "OMI data received successfully.",
            "Demo mode: Gemini API key not configured.",
            transcript ? `Transcript: "${transcript.substring(0, 100)}"` : "No transcript available.",
          ],
        },
      })

      return NextResponse.json({
        success: true,
        eventId,
        analysis: { ...fallbackAnalysis, transcript: transcript || "" },
        hospitals: MOCK_HOSPITALS,
        processingTime: Date.now() - startTime,
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    let responseText: string

    // Process based on strategy
    if (shouldProcessTranscript && transcript) {
      console.log(`[OMI] Processing TRANSCRIPT (${transcript.length} chars) - saves tokens!`)
      responseText = await processTranscriptWithGemini(genAI, transcript)
    } else if (shouldProcessAudio && audioBase64) {
      console.log(`[OMI] Processing AUDIO (${Math.round(audioBase64.length / 1024)}KB)`)
      responseText = await processAudioWithGemini(genAI, audioBase64, mimeType)
    } else {
      throw new Error("No content to process")
    }

    // Parse the response
    const parsed = parseResponseJSON(responseText)

    if (!parsed) {
      console.log(`[OMI] Failed to parse Gemini response, using fallback`)
      
      omiStore.updateEvent(eventId, {
        status: "completed",
        analysis: { ...fallbackAnalysis, transcript: transcript || "" },
      })

      return NextResponse.json({
        success: true,
        eventId,
        analysis: { ...fallbackAnalysis, transcript: transcript || "" },
        hospitals: MOCK_HOSPITALS,
        processingTime: Date.now() - startTime,
      })
    }

    // Build final analysis
    const analysis = {
      internalMonologue: Array.isArray(parsed.internalMonologue)
        ? parsed.internalMonologue.map((line: unknown) => String(line))
        : fallbackAnalysis.internalMonologue,
      voiceResponse:
        typeof parsed.voiceResponse === "string" && parsed.voiceResponse.length > 0
          ? parsed.voiceResponse
          : fallbackAnalysis.voiceResponse,
      location:
        parsed.location && typeof parsed.location === "object"
          ? {
              lat: Number(parsed.location.lat) || 37.6688,
              lng: Number(parsed.location.lng) || -122.0808,
              city: String(parsed.location.city || "Hayward, CA"),
            }
          : fallbackAnalysis.location,
      transcript: typeof parsed.transcript === "string" ? parsed.transcript : (transcript || ""),
      urgencyLevel: ["low", "medium", "high", "critical"].includes(parsed.urgencyLevel)
        ? (parsed.urgencyLevel as "low" | "medium" | "high" | "critical")
        : "low",
      emotionalState: Array.isArray(parsed.emotionalState)
        ? parsed.emotionalState.map((e: unknown) => String(e))
        : ["neutral"],
    }

    // Update event with analysis
    omiStore.updateEvent(eventId, {
      status: "completed",
      analysis,
    })

    // Update transcript store with analysis results
    if (storedTranscriptId) {
      updateTranscriptAnalysis(storedTranscriptId, {
        summary: analysis.voiceResponse,
        intent: analysis.urgencyLevel,
        sentiment: analysis.emotionalState?.[0] || "neutral",
      })
    }

    const processingTime = Date.now() - startTime
    console.log(`[OMI] Completed in ${processingTime}ms. Urgency: ${analysis.urgencyLevel}`)

    return NextResponse.json({
      success: true,
      eventId,
      analysis,
      hospitals: MOCK_HOSPITALS,
      processingTime,
      processedAs: shouldProcessTranscript ? "transcript" : "audio",
      transcriptId: storedTranscriptId,
    })

  } catch (error) {
    console.error("[OMI] Webhook error:", error)

    // Use fallback analysis instead of returning error
    const fallbackWithError = {
      ...fallbackAnalysis,
      internalMonologue: [
        "OMI audio received successfully.",
        "Gemini API temporarily unavailable.",
        "Using fallback analysis - system remains operational.",
      ],
    }

    omiStore.updateEvent(eventId, {
      status: "completed",
      analysis: fallbackWithError,
    })

    return NextResponse.json({
      success: true,
      eventId,
      analysis: fallbackWithError,
      hospitals: MOCK_HOSPITALS,
      warning: error instanceof Error ? error.message : "Processing failed, using fallback",
      processingTime: Date.now() - startTime,
    })
  }
}

// GET endpoint for health check / webhook verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Voco OMI Webhook",
    timestamp: new Date().toISOString(),
    config: {
      processingMode: PROCESSING_CONFIG.mode,
      minTranscriptLength: PROCESSING_CONFIG.minTranscriptLength,
    },
    description: "Send POST requests with audio/transcript data from OMI device",
    acceptedFormats: [
      "application/json with transcript field (preferred - lowest token usage)",
      "application/json with segments array",
      "application/json with audio_base64 field",
      "multipart/form-data with audio file",
      "Raw audio (audio/wav, audio/webm, etc.)",
    ],
  })
}
