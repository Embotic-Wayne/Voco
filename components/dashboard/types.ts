export type DemoStatus = "idle" | "recording" | "analyzing" | "speaking" | "done" | "error"

export type GraphState = "idle" | "audio" | "thinking" | "tts" | "notified"

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
