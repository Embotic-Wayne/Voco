import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { storeEmergencyAudio } from "@/lib/emergency-audio-store"
import { synthesizeElevenLabsToBuffer } from "@/lib/elevenlabs-tts"
import { getIo } from "@/socket"
import type {
  BiometricZone,
  EvaluationAgents,
  Hospital,
  RealTimeContext,
  ResponderKind,
  ResponderPlace,
} from "@/components/dashboard/types"

const BIOMETRIC_ZONES = new Set<string>([
  "head",
  "chest",
  "abdomen",
  "left_arm",
  "right_arm",
  "left_leg",
  "right_leg",
])

function normalizeAffectedZone(raw: unknown): BiometricZone | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "string") return null
  const z = raw.trim()
  if (BIOMETRIC_ZONES.has(z)) return z as BiometricZone
  return null
}

const DEFAULT_AGENT_EVALUATIONS: EvaluationAgents = {
  impact: {
    summary: "Awaiting incident audio and live context to assess affected populations and exposure.",
    bullets: ["No caller-linked assessment yet", "Confirm location and nature of emergency"],
  },
  severity: {
    score: 3,
    label: "Unknown / default",
    rationale: "Insufficient data until triage completes.",
  },
  guidance: {
    dispatcherActions: [
      "Maintain open line with caller",
      "Verify address and callback number",
      "Stage appropriate apparatus per local protocol",
    ],
    firstResponderNotes: "Use standard approach; update when on-scene size-up is available.",
  },
}

const MOCK_HOSPITALS: Hospital[] = [
  { id: "st-rose", name: "St. Rose Hospital", lat: 37.6646, lng: -122.0937, distance: "0.9 mi" },
  { id: "eden", name: "Eden Medical Center", lat: 37.6758, lng: -122.0794, distance: "1.1 mi" },
  { id: "kaiser", name: "Kaiser San Leandro", lat: 37.7117, lng: -122.1478, distance: "4.2 mi" },
]

const MOCK_POLICE_STATIONS: ResponderPlace[] = [
  {
    id: "hayward-pd",
    kind: "police",
    name: "Hayward Police Department",
    address: "300 W Winton Ave, Hayward, CA",
    phone: "(510) 293-7000",
    status: "Moderate traffic on approach routes",
    lat: 37.6702,
    lng: -122.0864,
    distance: "1.0 mi",
  },
]

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions"
const PERPLEXITY_MODEL = "sonar-pro"
const PERPLEXITY_TIMEOUT_MS = 10000

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
  realTimeContext: {
    hospitals: [
      {
        id: "st-rose",
        kind: "hospital",
        name: "St. Rose Hospital",
        address: "27200 Calaroga Ave, Hayward, CA",
        phone: "(510) 782-6200",
        status: "Fallback routing mode active",
        lat: 37.6646,
        lng: -122.0937,
        distance: "0.9 mi",
      },
      {
        id: "eden",
        kind: "hospital",
        name: "Eden Medical Center",
        address: "20103 Lake Chabot Rd, Castro Valley, CA",
        phone: "(510) 537-1234",
        status: "Fallback routing mode active",
        lat: 37.6758,
        lng: -122.0794,
        distance: "1.1 mi",
      },
      {
        id: "kaiser",
        kind: "hospital",
        name: "Kaiser San Leandro",
        address: "2500 Merced St, San Leandro, CA",
        phone: "(510) 454-1000",
        status: "Fallback routing mode active",
        lat: 37.7117,
        lng: -122.1478,
        distance: "4.2 mi",
      },
    ],
    policeStations: MOCK_POLICE_STATIONS,
    fireStations: [
      {
        id: "hayward-fire",
        kind: "fire",
        name: "Hayward Fire Station #6 (fallback)",
        address: "Hayward, CA (demo)",
        phone: "N/A",
        status: "Fallback routing mode active",
        lat: 37.672,
        lng: -122.078,
        distance: "1.2 mi",
      },
    ],
    searchArea: { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" },
    source: "Perplexity AI" as const,
    usedFallback: true,
    error: "Perplexity unavailable, using mock responder context.",
  } satisfies RealTimeContext,
  agentEvaluations: DEFAULT_AGENT_EVALUATIONS,
  distressData: { affectedZone: null },
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

async function generateTextOnly(genAI: GoogleGenerativeAI, prompt: string): Promise<string> {
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"]
  let lastError: unknown = null
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error("All Gemini text models failed")
}

function parseAgentEvaluations(raw: string): EvaluationAgents | null {
  const parsed = parseResponseJSON(raw)
  if (!parsed || typeof parsed !== "object") return null
  const p = parsed as Record<string, unknown>
  const impact = p.impact
  const severity = p.severity
  const guidance = p.guidance
  if (!impact || typeof impact !== "object" || !severity || typeof severity !== "object" || !guidance || typeof guidance !== "object") {
    return null
  }
  const im = impact as Record<string, unknown>
  const se = severity as Record<string, unknown>
  const gu = guidance as Record<string, unknown>
  const summary = typeof im.summary === "string" ? im.summary : ""
  const bullets = Array.isArray(im.bullets) ? im.bullets.map((b) => String(b)) : []
  const score = typeof se.score === "number" && se.score >= 1 && se.score <= 5 ? se.score : 3
  const label = typeof se.label === "string" ? se.label : "Assessed"
  const rationale = typeof se.rationale === "string" ? se.rationale : ""
  const dispatcherActions = Array.isArray(gu.dispatcherActions)
    ? gu.dispatcherActions.map((a) => String(a))
    : []
  const firstResponderNotes = typeof gu.firstResponderNotes === "string" ? gu.firstResponderNotes : ""
  if (!summary || !rationale || !firstResponderNotes) {
    return null
  }
  if (dispatcherActions.length === 0) {
    dispatcherActions.push("Follow local EMS/law enforcement dispatch protocol.")
  }
  return {
    impact: { summary, bullets },
    severity: { score, label, rationale },
    guidance: { dispatcherActions, firstResponderNotes },
  }
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function offsetFromAnchor(anchor: { lat: number; lng: number }, index: number): { lat: number; lng: number } {
  const angle = (index + 1) * 1.17
  const radius = 0.01 * (index + 1)
  return {
    lat: anchor.lat + Math.cos(angle) * radius,
    lng: anchor.lng + Math.sin(angle) * radius,
  }
}

function asResponderPlace(
  input: unknown,
  kind: ResponderKind,
  index: number,
  anchor: { lat: number; lng: number }
): ResponderPlace | null {
  if (!input || typeof input !== "object") return null
  const record = input as Record<string, unknown>
  const name = typeof record.name === "string" ? record.name.trim() : ""
  const address = typeof record.address === "string" ? record.address.trim() : ""
  const phone = typeof record.phone === "string" ? record.phone.trim() : ""
  const status = typeof record.status === "string" ? record.status.trim() : ""
  if (!name || !address || !phone || !status) return null

  const latParsed = coerceNumber(record.lat)
  const lngParsed = coerceNumber(record.lng)
  const coords =
    latParsed !== null && lngParsed !== null
      ? { lat: latParsed, lng: lngParsed }
      : offsetFromAnchor(anchor, index)

  const distanceRaw = record.distance ?? record.dist
  const distance =
    typeof distanceRaw === "string" && distanceRaw.trim() !== ""
      ? distanceRaw.trim()
      : typeof distanceRaw === "number" && Number.isFinite(distanceRaw)
        ? `${distanceRaw} mi`
        : undefined

  return {
    id: `${kind}-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind,
    name,
    address,
    phone,
    status,
    lat: coords.lat,
    lng: coords.lng,
    distance,
  }
}

async function fetchPerplexityContext(
  apiKey: string,
  searchArea: { lat: number; lng: number; city: string }
): Promise<RealTimeContext> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PERPLEXITY_TIMEOUT_MS)
  try {
    const prompt = `Find the 3 nearest emergency hospitals (with ER if possible), the closest police station, and the nearest fire station to the incident area at coordinates ${searchArea.lat}, ${searchArea.lng} (${searchArea.city}).

Return JSON only with keys "hospitals", "policeStations", and "fireStations". Each item must include: name, address, phone, status (summarize current traffic conditions, ER wait/delays if known, or general readiness).

If you know approximate coordinates, include "lat" and "lng" as numbers for each facility when possible.`

    const response = await fetch(PERPLEXITY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a real-time emergency intel assistant. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`Perplexity request failed (${response.status}): ${detail || "unknown error"}`)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content ?? ""
    const parsed = parseResponseJSON(content)
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Perplexity returned non-JSON content")
    }

    const anchor = { lat: searchArea.lat, lng: searchArea.lng }

    const rawHospitals = parsed.hospitals
    const rawPolice = parsed.policeStations ?? (parsed as Record<string, unknown>).police_stations
    const rawFire = parsed.fireStations ?? (parsed as Record<string, unknown>).fire_stations

    const hospitals = Array.isArray(rawHospitals)
      ? rawHospitals
          .map((item: unknown, index: number) => asResponderPlace(item, "hospital", index, anchor))
          .filter((item: ResponderPlace | null): item is ResponderPlace => item !== null)
          .slice(0, 3)
      : []
    const policeStations = Array.isArray(rawPolice)
      ? rawPolice
          .map((item: unknown, index: number) => asResponderPlace(item, "police", index, anchor))
          .filter((item: ResponderPlace | null): item is ResponderPlace => item !== null)
          .slice(0, 1)
      : []
    const fireStations = Array.isArray(rawFire)
      ? rawFire
          .map((item: unknown, index: number) => asResponderPlace(item, "fire", index, anchor))
          .filter((item: ResponderPlace | null): item is ResponderPlace => item !== null)
          .slice(0, 2)
      : []

    if (hospitals.length === 0 && policeStations.length === 0 && fireStations.length === 0) {
      throw new Error("Perplexity returned empty responder list")
    }

    return {
      hospitals,
      policeStations,
      fireStations,
      searchArea,
      source: "Perplexity AI",
      usedFallback: false,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function hospitalsFromContext(context: RealTimeContext): Hospital[] {
  const fromContext = context.hospitals.slice(0, 3).map((item) => ({
    id: item.id,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    distance: item.distance ?? "N/A",
  }))
  return fromContext.length > 0 ? fromContext : MOCK_HOSPITALS
}

function normalizeSearchArea(parsed: Record<string, unknown>): { lat: number; lng: number; city: string } {
  const loc = parsed.location
  if (loc && typeof loc === "object") {
    const l = loc as Record<string, unknown>
    const lat = coerceNumber(l.lat) ?? 37.6688
    const lng = coerceNumber(l.lng) ?? -122.0808
    const city = typeof l.city === "string" && l.city.trim() !== "" ? l.city.trim() : "Unknown area"
    return { lat, lng, city }
  }
  return { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" }
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

    const firstPassPrompt = `
You are the Voco Emergency Brain.
Analyze this distress audio and infer urgency.
Infer the caller's best-estimated location from what they say (address, city, landmarks, neighborhood) and set location.lat, location.lng, and location.city. Use realistic coordinates for that place when the caller names a location; if only a region is known, pick a reasonable centroid. If location cannot be inferred, use Hayward, CA (37.6688, -122.0808) as a last resort.

If the user mentions pain or distress localized to a specific body area (e.g. "my chest hurts", "head is spinning", "stomach pain", "left leg"), set "affectedZone" to exactly one of: head, chest, abdomen, left_arm, right_arm, left_leg, right_arm. Infer left vs right from phrases like "my left arm"; if only "arm" or "leg" is said without a side, use left_arm or left_leg as a default. If pain is not localized or not mentioned, set affectedZone to null.

Return JSON only with keys:
{
  "internalMonologue": string[],
  "voiceResponse": string,
  "location": {"lat": number, "lng": number, "city": string},
  "affectedZone": "head" | "chest" | "abdomen" | "left_arm" | "right_arm" | "left_leg" | "right_leg" | null
}
Keep monologue concise, tactical, and specific to distress signals.
`

    const firstPassText = await generateWithFallbackModel(genAI, firstPassPrompt, audioBase64, mimeType || "audio/webm")
    const parsed = parseResponseJSON(firstPassText)
    if (!parsed) {
      return NextResponse.json(fallbackPayload)
    }

    const searchArea = normalizeSearchArea(parsed as Record<string, unknown>)

    let realTimeContext: RealTimeContext = {
      ...fallbackPayload.realTimeContext,
      searchArea,
    }
    // Location-aware live search: use Gemini-inferred area (not hardcoded Hayward) whenever the key is present.
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        realTimeContext = await fetchPerplexityContext(process.env.PERPLEXITY_API_KEY, searchArea)
      } catch (error) {
        console.error("Perplexity context error", error)
        realTimeContext = {
          ...fallbackPayload.realTimeContext,
          searchArea,
          error: error instanceof Error ? error.message : "Perplexity request failed",
        }
      }
    } else {
      realTimeContext = {
        ...fallbackPayload.realTimeContext,
        searchArea,
        error: "PERPLEXITY_API_KEY is missing. Using fallback context.",
      }
    }

    const secondPassPrompt = `
You are the Voco Emergency Brain.
Given prior triage and situational intelligence, update only JSON output.
Triage JSON:
${JSON.stringify(parsed)}

Situational context JSON:
${JSON.stringify(realTimeContext)}

Return JSON only with keys:
{
  "internalMonologue": string[],
  "voiceResponse": string,
  "location": {"lat": number, "lng": number, "city": string},
  "affectedZone": "head" | "chest" | "abdomen" | "left_arm" | "right_arm" | "left_leg" | "right_leg" | null
}
Preserve the triage location unless you must correct it for consistency with situational context. Preserve or correct "affectedZone" using the same rules as triage (localized pain vs null). The monologue must mention at least one specific facility name and one status detail when provided.
`

    let finalParsed = parsed
    try {
      const refinedText = await generateWithFallbackModel(genAI, secondPassPrompt, audioBase64, mimeType || "audio/webm")
      const refinedParsed = parseResponseJSON(refinedText)
      if (refinedParsed && typeof refinedParsed === "object") {
        finalParsed = refinedParsed
      }
    } catch (error) {
      console.error("Gemini re-reasoning failed", error)
    }

    const monologueFromModel =
      finalParsed.internalMonologue ?? finalParsed["Internal Monologue"] ?? finalParsed.internal_monologue ?? null
    const voiceFromModel = finalParsed.voiceResponse ?? finalParsed["Voice Response"] ?? finalParsed.voice_response ?? null

    const firstRecord = parsed as Record<string, unknown>
    const finalRecord = finalParsed as Record<string, unknown>
    let affectedZone =
      normalizeAffectedZone(finalRecord.affectedZone) ?? normalizeAffectedZone(firstRecord.affectedZone)

    let agentEvaluations: EvaluationAgents = DEFAULT_AGENT_EVALUATIONS
    try {
      const agentPrompt = `You are three specialized emergency coordination agents in one model. Based ONLY on the incident context below, output valid JSON (no markdown fences) with this exact shape:
{
  "impact": { "summary": string, "bullets": string[] },
  "severity": { "score": number, "label": string, "rationale": string },
  "guidance": { "dispatcherActions": string[], "firstResponderNotes": string }
}

Rules:
- impact.summary: 2-4 sentences on who may be affected (caller, bystanders, area population, infrastructure).
- impact.bullets: 3-6 short items (populations, exposure, secondary risks).
- severity.score: integer 1-5 (1=minor, 5=mass casualty or imminent life threat at scale).
- severity.label: short label e.g. "Moderate", "Critical".
- severity.rationale: 2-3 sentences tying score to the audio + context.
- guidance.dispatcherActions: ordered checklist for PSAP dispatchers (5-8 items).
- guidance.firstResponderNotes: paragraph on scene priorities, safety, handoff to EMS/police.

Incident context (JSON):
${JSON.stringify({
        triage: finalParsed,
        liveFacilities: {
          hospitals: realTimeContext.hospitals.map((h) => h.name),
          police: realTimeContext.policeStations.map((p) => p.name),
          fire: realTimeContext.fireStations?.map((f) => f.name) ?? [],
        },
        searchArea: realTimeContext.searchArea,
      })}
`
      const agentText = await generateTextOnly(genAI, agentPrompt)
      const parsedAgents = parseAgentEvaluations(agentText)
      if (parsedAgents) {
        agentEvaluations = parsedAgents
      }
    } catch (error) {
      console.error("Agent evaluation generation failed", error)
    }

    const voiceResponseText =
      typeof voiceFromModel === "string" && voiceFromModel.length > 0
        ? voiceFromModel
        : fallbackPayload.voiceResponse

    const payload = {
      internalMonologue: Array.isArray(monologueFromModel)
        ? monologueFromModel.map((line: unknown) => String(line))
        : fallbackPayload.internalMonologue,
      voiceResponse: voiceResponseText,
      location:
        finalParsed.location && typeof finalParsed.location === "object"
          ? {
              lat: Number(finalParsed.location.lat) || 37.6688,
              lng: Number(finalParsed.location.lng) || -122.0808,
              city: String(finalParsed.location.city || "Hayward, CA"),
            }
          : fallbackPayload.location,
      hospitals: hospitalsFromContext(realTimeContext),
      realTimeContext,
      agentEvaluations,
      distressData: { affectedZone },
    }

    const socketIo = getIo()
    if (!socketIo) {
      return NextResponse.json(payload)
    }

    try {
      const mp3 = await synthesizeElevenLabsToBuffer(voiceResponseText)
      const token = storeEmergencyAudio(mp3)
      const origin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin
      const audioUrl = `${origin}/api/emergency-audio/${token}`
      socketIo.emit("emergency_voice_trigger", { audioUrl })
      return NextResponse.json({ ...payload, audioUrl })
    } catch (error) {
      console.error("Emergency voice TTS or socket broadcast failed", error)
      return NextResponse.json(payload)
    }
  } catch (error) {
    console.error("Process route error", error)
    return NextResponse.json(fallbackPayload)
  }
}
