import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Hospital } from "@/components/dashboard/types"

const MOCK_HOSPITALS: Hospital[] = [
  { id: "st-rose", name: "St. Rose Hospital", lat: 37.6646, lng: -122.0937, distance: "0.9 mi" },
  { id: "eden", name: "Eden Medical Center", lat: 37.6758, lng: -122.0794, distance: "1.1 mi" },
  { id: "kaiser", name: "Kaiser San Leandro", lat: 37.7117, lng: -122.1478, distance: "4.2 mi" },
]

const fallbackPayload = {
  internalMonologue: [
    "Audio received from caller.",
    "Detected urgency and fear markers in speech cadence.",
    "Using demo location lock: Hayward, CA for responder routing.",
    "Severity threshold crossed. Recommending immediate dispatch.",
  ],
  voiceResponse:
    "I heard you and I am with you. Please stay on the line and move to a visible location. Emergency responders are being notified now.",
  location: { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" },
  hospitals: MOCK_HOSPITALS,
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

async function generateWithFallbackModel(genAI: GoogleGenerativeAI, prompt: string, audioBase64: string, mimeType: string) {
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"]
  let lastError: unknown = null

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
    }
  }

  throw lastError ?? new Error("All Gemini candidate models failed")
}

export async function POST(request: Request) {
  try {
    const { audioBase64, mimeType } = (await request.json()) as {
      audioBase64?: string
      mimeType?: string
    }

    if (!audioBase64) {
      return NextResponse.json({ error: "audioBase64 is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackPayload)
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    const prompt = `
You are the Voco Emergency Brain.
Analyze this distress audio and infer urgency.
For this demo, always set location to Hayward, CA (lat 37.6688, lng -122.0808).
Return JSON only with keys:
{
  "internalMonologue": string[],
  "voiceResponse": string,
  "location": {"lat": number, "lng": number, "city": string}
}
Keep monologue concise, tactical, and specific to distress signals.
`

    const text = await generateWithFallbackModel(genAI, prompt, audioBase64, mimeType || "audio/webm")
    const parsed = parseResponseJSON(text)
    if (!parsed) {
      return NextResponse.json(fallbackPayload)
    }

    const monologueFromModel =
      parsed.internalMonologue ?? parsed["Internal Monologue"] ?? parsed.internal_monologue ?? null
    const voiceFromModel = parsed.voiceResponse ?? parsed["Voice Response"] ?? parsed.voice_response ?? null

    return NextResponse.json({
      internalMonologue: Array.isArray(monologueFromModel)
        ? monologueFromModel.map((line: unknown) => String(line))
        : fallbackPayload.internalMonologue,
      voiceResponse:
        typeof voiceFromModel === "string" && voiceFromModel.length > 0
          ? voiceFromModel
          : fallbackPayload.voiceResponse,
      location:
        parsed.location && typeof parsed.location === "object"
          ? {
              lat: Number(parsed.location.lat) || 37.6688,
              lng: Number(parsed.location.lng) || -122.0808,
              city: String(parsed.location.city || "Hayward, CA"),
            }
          : fallbackPayload.location,
      hospitals: MOCK_HOSPITALS,
    })
  } catch (error) {
    console.error("Process route error", error)
    return NextResponse.json(fallbackPayload)
  }
}
