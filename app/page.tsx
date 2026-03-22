"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightSidebar } from "@/components/dashboard/right-sidebar"
import { KnowledgeGraph } from "@/components/dashboard/knowledge-graph"
import { OmiPanel } from "@/components/dashboard/omi-panel"
import type {
  AudioSource,
  Coordinates,
  DemoStatus,
  DistressData,
  EvaluationAgents,
  GraphState,
  Hospital,
  RealTimeContext,
} from "@/components/dashboard/types"
import type { OmiAudioEvent } from "@/lib/omi-store"

const HAYWARD: Coordinates = { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" }

interface ProcessResponse {
  internalMonologue: string[]
  voiceResponse: string
  location: Coordinates
  hospitals: Hospital[]
  realTimeContext?: RealTimeContext
  agentEvaluations?: EvaluationAgents
  distressData?: DistressData
  audioUrl?: string
}

/** Minimal valid WAV for autoplay unlock after user gesture (mobile Safari). */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=="

const defaultHospitals: Hospital[] = [
  { id: "st-rose", name: "St. Rose Hospital", lat: 37.6646, lng: -122.0937, distance: "0.9 mi" },
  { id: "kaiser", name: "Kaiser San Leandro", lat: 37.7117, lng: -122.1478, distance: "4.2 mi" },
  { id: "eden", name: "Eden Medical Center", lat: 37.6758, lng: -122.0794, distance: "1.1 mi" },
]

const defaultRealTimeContext: RealTimeContext = {
  hospitals: defaultHospitals.map((hospital) => ({
    id: hospital.id,
    kind: "hospital",
    name: hospital.name,
    address: "Fallback response location (Hayward area)",
    phone: "N/A",
    status: "Fallback routing mode active",
    lat: hospital.lat,
    lng: hospital.lng,
    distance: hospital.distance,
  })),
  policeStations: [
    {
      id: "hayward-pd",
      kind: "police",
      name: "Hayward Police Department",
      address: "300 W Winton Ave, Hayward, CA",
      phone: "(510) 293-7000",
      status: "Fallback routing mode active",
      lat: 37.6702,
      lng: -122.0864,
      distance: "1.0 mi",
    },
  ],
  fireStations: [
    {
      id: "hayward-fire-demo",
      kind: "fire",
      name: "Fire station (fallback)",
      address: "Hayward area",
      phone: "N/A",
      status: "Fallback routing mode active",
      lat: 37.672,
      lng: -122.078,
      distance: "1.2 mi",
    },
  ],
  searchArea: { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" },
  source: "Perplexity AI",
  usedFallback: true,
  error: "Using fallback context",
}

const defaultDistressData: DistressData = { affectedZone: null }

const defaultAgentEvaluations: EvaluationAgents = {
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

export default function VocoDashboard() {
  const [status, setStatus] = useState<DemoStatus>("idle")
  const [graphState, setGraphState] = useState<GraphState>("idle")
  const [monologueLines, setMonologueLines] = useState<string[]>([])
  const [voiceResponse, setVoiceResponse] = useState("")
  const [targetCoords, setTargetCoords] = useState<Coordinates>(HAYWARD)
  const [hospitals, setHospitals] = useState<Hospital[]>(defaultHospitals)
  const [realTimeContext, setRealTimeContext] = useState<RealTimeContext>(defaultRealTimeContext)
  const [agentEvaluations, setAgentEvaluations] = useState<EvaluationAgents>(defaultAgentEvaluations)
  const [distressData, setDistressData] = useState<DistressData>(defaultDistressData)
  const [dispatchSequence, setDispatchSequence] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)
  const [vocoActivePulse, setVocoActivePulse] = useState(false)
  const [audioSource, setAudioSource] = useState<AudioSource>("microphone")
  const [omiTranscript, setOmiTranscript] = useState("")

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const socketRef = useRef<Socket | null>(null)
  const monitoringAudioRef = useRef<HTMLAudioElement | null>(null)
  const monitoringEnabledRef = useRef(false)

  useEffect(() => {
    monitoringEnabledRef.current = monitoringEnabled
  }, [monitoringEnabled])

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "")
    if (!base) return

    const socket = io(base, { path: "/socket.io/", transports: ["websocket", "polling"] })
    socketRef.current = socket

    socket.on("emergency_voice_trigger", (data: { audioUrl?: string }) => {
      if (!monitoringEnabledRef.current || !data?.audioUrl) return

      let el = monitoringAudioRef.current
      if (!el) {
        el = new Audio()
        monitoringAudioRef.current = el
      }

      el.onended = () => setVocoActivePulse(false)
      el.onerror = () => setVocoActivePulse(false)

      setVocoActivePulse(true)
      el.src = data.audioUrl
      void el.play().catch(() => setVocoActivePulse(false))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const handleStartMonitoring = useCallback(async () => {
    let el = monitoringAudioRef.current
    if (!el) {
      el = new Audio()
      monitoringAudioRef.current = el
    }
    el.src = SILENT_WAV_DATA_URI
    try {
      await el.play()
      el.pause()
      el.removeAttribute("src")
      el.load()
    } catch {
      /* still mark monitoring — socket playback may work on some devices */
    }
    setMonitoringEnabled(true)
  }, [])

  const holdLabel = useMemo(() => {
    if (status === "recording") return "Release to Send"
    if (status === "analyzing") return "Gemini is reasoning..."
    if (status === "speaking") return "Playing response..."
    if (status === "done") return "Hold to speak again"
    if (status === "error") return "Retry hold-to-speak"
    if (status === "omi-listening") return "OMI Active"
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

  const handleOmiEvent = useCallback((event: OmiAudioEvent) => {
    console.log("[Dashboard] OMI Event received:", event.status, event.id)

    if (event.status === "received") {
      setStatus("omi-listening")
      setGraphState("audio")
      setAudioSource("omi")
      setMonologueLines(["Receiving audio from OMI device..."])
    } else if (event.status === "processing") {
      setStatus("analyzing")
      setGraphState("thinking")
      setAudioSource("omi")
      setMonologueLines(["Processing OMI audio through Gemini..."])
    } else if (event.status === "completed" && event.analysis) {
      setAudioSource("omi")
      setMonologueLines(event.analysis.internalMonologue || [])
      setVoiceResponse(event.analysis.voiceResponse || "")
      setOmiTranscript(event.analysis.transcript || "")

      if (event.analysis.location) {
        setTargetCoords(event.analysis.location)
      }

      setStatus("done")
      setGraphState("notified")

      if (event.analysis.voiceResponse) {
        setStatus("speaking")
        setGraphState("tts")
        playElevenLabsAudio(event.analysis.voiceResponse)
          .then(() => {
            setStatus("done")
            setGraphState("notified")
          })
          .catch(() => {
            setStatus("done")
            setGraphState("notified")
          })
      }
    } else if (event.status === "error") {
      setStatus("error")
      setGraphState("idle")
      setErrorMessage(event.error || "OMI processing failed")
    }
  }, [playElevenLabsAudio])

  const processAudio = useCallback(
    async (blob: Blob) => {
      setStatus("analyzing")
      setGraphState("thinking")
      setErrorMessage("")
      setMonologueLines([])
      setVoiceResponse("")
      setAudioSource("microphone")
      setAgentEvaluations(defaultAgentEvaluations)
      setDistressData(defaultDistressData)

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
      setRealTimeContext(payload.realTimeContext ?? defaultRealTimeContext)
      setAgentEvaluations(payload.agentEvaluations ?? defaultAgentEvaluations)
      setDistressData(payload.distressData ?? defaultDistressData)
      setDispatchSequence((current) => current + 1)

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
            <MapPanel
              targetCoords={targetCoords}
              hospitals={hospitals}
              realTimeContext={realTimeContext}
              dispatchSequence={dispatchSequence}
              status={status}
            />
          </div>
          <KnowledgeGraph graphState={graphState} />
        </main>
        <div className="flex flex-col w-[40%] min-w-[360px]">
          <RightSidebar
            status={status}
            monologueLines={monologueLines}
            voiceResponse={voiceResponse}
            realTimeContext={realTimeContext}
            agentEvaluations={agentEvaluations}
            distressData={distressData}
          />

          <div className="border-t border-border p-3 bg-card/50">
            <OmiPanel onEventReceived={handleOmiEvent} />

            {omiTranscript && audioSource === "omi" && (
              <div className="mt-3 p-3 bg-background/50 rounded border border-border">
                <p className="text-xs text-muted-foreground mb-1">OMI Transcript:</p>
                <p className="text-sm text-foreground">{omiTranscript}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs uppercase tracking-wider ${audioSource === "microphone" ? "text-primary" : "text-muted-foreground"}`}>
              Microphone
            </span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className={`text-xs uppercase tracking-wider ${audioSource === "omi" ? "text-green-500" : "text-muted-foreground"}`}>
              OMI Device
            </span>
          </div>
          <button
            type="button"
            onClick={handleStartMonitoring}
            disabled={monitoringEnabled}
            className={`flex w-full md:hidden rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] border transition-all ${
              monitoringEnabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "bg-card/95 border-border text-foreground hover:border-emerald-500/50"
            }`}
          >
            {monitoringEnabled ? "Monitoring — Voco voice sync on" : "Start Monitoring"}
          </button>
          <button
            type="button"
            onPointerDown={handleStartRecording}
            onPointerUp={handleStopRecording}
            onPointerLeave={handleStopRecording}
            onPointerCancel={handleStopRecording}
            className={`rounded-full px-8 py-4 text-sm uppercase tracking-[0.2em] border transition-all ${
              status === "recording"
                ? "bg-primary/25 border-primary text-primary shadow-[0_0_30px_rgba(37,171,255,0.5)]"
                : status === "omi-listening"
                ? "bg-green-500/25 border-green-500 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
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
