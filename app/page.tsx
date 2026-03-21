"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightSidebar } from "@/components/dashboard/right-sidebar"
import { KnowledgeGraph } from "@/components/dashboard/knowledge-graph"
import type { Coordinates, DemoStatus, GraphState, Hospital } from "@/components/dashboard/types"

const HAYWARD: Coordinates = { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" }

interface ProcessResponse {
  internalMonologue: string[]
  voiceResponse: string
  location: Coordinates
  hospitals: Hospital[]
}

const defaultHospitals: Hospital[] = [
  { id: "st-rose", name: "St. Rose Hospital", lat: 37.6646, lng: -122.0937, distance: "0.9 mi" },
  { id: "kaiser", name: "Kaiser San Leandro", lat: 37.7117, lng: -122.1478, distance: "4.2 mi" },
  { id: "eden", name: "Eden Medical Center", lat: 37.6758, lng: -122.0794, distance: "1.1 mi" },
]

export default function VocoDashboard() {
  const [status, setStatus] = useState<DemoStatus>("idle")
  const [graphState, setGraphState] = useState<GraphState>("idle")
  const [monologueLines, setMonologueLines] = useState<string[]>([])
  const [voiceResponse, setVoiceResponse] = useState("")
  const [targetCoords, setTargetCoords] = useState<Coordinates>(HAYWARD)
  const [hospitals, setHospitals] = useState<Hospital[]>(defaultHospitals)
  const [errorMessage, setErrorMessage] = useState("")

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const holdLabel = useMemo(() => {
    if (status === "recording") return "Release to Send"
    if (status === "analyzing") return "Gemini is reasoning..."
    if (status === "speaking") return "Playing response..."
    if (status === "done") return "Hold to speak again"
    if (status === "error") return "Retry hold-to-speak"
    return "Hold to Speak"
  }, [status])

  const toBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result !== "string") {
          reject(new Error("Unable to read recording as base64"))
          return
        }
        resolve(result.split(",")[1] ?? "")
      }
      reader.onerror = () => reject(reader.error ?? new Error("Failed reading audio blob"))
      reader.readAsDataURL(blob)
    })
  }, [])

  const playElevenLabsAudio = useCallback(async (text: string) => {
    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"
    const publicApiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY

    const body = {
      text,
      model_id: "eleven_turbo_v2_5",
      optimize_streaming_latency: 4,
      output_format: "mp3_44100_128",
    }

    let audioBuffer: ArrayBuffer
    try {
      if (!publicApiKey) {
        throw new Error("No public key configured")
      }
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": publicApiKey,
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        throw new Error(`Direct ElevenLabs request failed (${response.status}): ${detail || "Unknown error"}`)
      }
      audioBuffer = await response.arrayBuffer()
    } catch {
      const fallbackResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, ...body }),
      })
      if (!fallbackResponse.ok) {
        const detail = await fallbackResponse.text().catch(() => "")
        throw new Error(
          `TTS streaming failed from both direct and fallback routes (${fallbackResponse.status}): ${detail || "Unknown error"}`
        )
      }
      audioBuffer = await fallbackResponse.arrayBuffer()
    }

    const blob = new Blob([audioBuffer], { type: "audio/mpeg" })
    const url = URL.createObjectURL(blob)
    try {
      const audio = new Audio(url)
      await audio.play()
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [])

  const processAudio = useCallback(
    async (blob: Blob) => {
      setStatus("analyzing")
      setGraphState("thinking")
      setErrorMessage("")
      setMonologueLines([])
      setVoiceResponse("")

      const audioBase64 = await toBase64(blob)
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: blob.type || "audio/webm" }),
      })
      if (!response.ok) {
        throw new Error("Gemini processing failed")
      }

      const payload = (await response.json()) as ProcessResponse
      setMonologueLines(payload.internalMonologue ?? [])
      setVoiceResponse(payload.voiceResponse ?? "")
      setTargetCoords(payload.location ?? HAYWARD)
      setHospitals(payload.hospitals?.length ? payload.hospitals : defaultHospitals)

      setStatus("speaking")
      setGraphState("tts")
      await playElevenLabsAudio(payload.voiceResponse ?? "Emergency acknowledged. Help is being dispatched.")

      setStatus("done")
      setGraphState("notified")
    },
    [playElevenLabsAudio, toBase64]
  )

  const handleStartRecording = useCallback(async () => {
    if (status === "analyzing" || status === "speaking") return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      setStatus("recording")
      setGraphState("audio")

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        console.log("Recorded audio blob:", { size: blob.size, type: blob.type })
        stream.getTracks().forEach((track) => track.stop())
        await processAudio(blob).catch((error: unknown) => {
          setStatus("error")
          setGraphState("idle")
          setErrorMessage(error instanceof Error ? error.message : "Unexpected processing error")
        })
      }

      recorder.start()
    } catch (error: unknown) {
      setStatus("error")
      setGraphState("idle")
      setErrorMessage(error instanceof Error ? error.message : "Microphone access denied")
    }
  }, [processAudio, status])

  const handleStopRecording = useCallback(() => {
    if (status !== "recording") return
    recorderRef.current?.stop()
  }, [status])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="flex-1 min-h-0">
            <MapPanel targetCoords={targetCoords} hospitals={hospitals} status={status} />
          </div>
          <KnowledgeGraph graphState={graphState} />
        </main>
        <RightSidebar status={status} monologueLines={monologueLines} voiceResponse={voiceResponse} />
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <button
            type="button"
            onPointerDown={handleStartRecording}
            onPointerUp={handleStopRecording}
            onPointerLeave={handleStopRecording}
            onPointerCancel={handleStopRecording}
            className={`rounded-full px-8 py-4 text-sm uppercase tracking-[0.2em] border transition-all ${
              status === "recording"
                ? "bg-primary/25 border-primary text-primary shadow-[0_0_30px_rgba(37,171,255,0.5)]"
                : "bg-card/95 border-border text-foreground hover:border-primary/60"
            }`}
          >
            {holdLabel}
          </button>
          {errorMessage && <p className="text-xs text-alert">{errorMessage}</p>}
        </div>
      </div>
    </div>
  )
}
