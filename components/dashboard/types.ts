export type DemoStatus = "idle" | "recording" | "analyzing" | "speaking" | "done" | "error" | "omi-listening"

export type GraphState = "idle" | "audio" | "thinking" | "tts" | "notified" | "omi-processing"

export type AudioSource = "microphone" | "omi"

export interface Coordinates {
  lat: number
  lng: number
  city?: string
}

export interface Hospital {
  id: string
  name: string
  lat: number
  lng: number
  distance: string
}

export interface OmiStatus {
  connected: boolean
  deviceId?: string
  lastActivity?: Date
}

