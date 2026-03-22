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

export type ResponderKind = "hospital" | "police" | "fire"

export interface ResponderPlace {
  id: string
  kind: ResponderKind
  name: string
  address: string
  phone: string
  status: string
  lat: number
  lng: number
  distance?: string
}

export interface RealTimeContext {
  hospitals: ResponderPlace[]
  policeStations: ResponderPlace[]
  fireStations: ResponderPlace[]
  /** Where Perplexity search was centered (matches Gemini-inferred incident area) */
  searchArea?: { lat: number; lng: number; city: string }
  source: "Perplexity AI"
  usedFallback: boolean
  error?: string
}

/** SVG body-map region IDs (front view) */
export type BiometricZone =
  | "head"
  | "chest"
  | "abdomen"
  | "left_arm"
  | "right_arm"
  | "left_leg"
  | "right_leg"

export interface DistressData {
  affectedZone: BiometricZone | null
}

/** Multi-agent evaluation for dispatch / coordination UI */
export interface EvaluationAgents {
  impact: {
    summary: string
    bullets: string[]
  }
  severity: {
    /** 1 = minimal, 5 = mass-casualty / life-threatening systemic */
    score: number
    label: string
    rationale: string
  }
  guidance: {
    /** Action items for PSAP dispatchers */
    dispatcherActions: string[]
    /** Scene priorities for first responders */
    firstResponderNotes: string
  }
}
