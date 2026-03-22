// In-memory store for OMI events (for real-time dashboard updates)
// In production, you might use Redis or a database

export interface OmiAudioEvent {
  id: string
  timestamp: Date
  status: "received" | "processing" | "completed" | "error"
  audioData?: {
    duration?: number
    format?: string
    sampleRate?: number
  }
  analysis?: {
    internalMonologue: string[]
    voiceResponse: string
    location: {
      lat: number
      lng: number
      city: string
    }
    transcript?: string
    urgencyLevel?: "low" | "medium" | "high" | "critical"
    emotionalState?: string[]
  }
  error?: string
  deviceId?: string
  sessionId?: string
}

// Store for active SSE connections
type SSEClient = {
  id: string
  controller: ReadableStreamDefaultController
}

class OmiEventStore {
  private events: OmiAudioEvent[] = []
  private clients: SSEClient[] = []
  private maxEvents = 100

  addEvent(event: OmiAudioEvent) {
    this.events.unshift(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }
    this.broadcast(event)
  }

  updateEvent(id: string, updates: Partial<OmiAudioEvent>) {
    const index = this.events.findIndex((e) => e.id === id)
    if (index !== -1) {
      this.events[index] = { ...this.events[index], ...updates }
      this.broadcast(this.events[index])
    }
  }

  getLatestEvent(): OmiAudioEvent | null {
    return this.events[0] || null
  }

  getEvents(limit = 10): OmiAudioEvent[] {
    return this.events.slice(0, limit)
  }

  // SSE client management
  addClient(client: SSEClient) {
    this.clients.push(client)
  }

  removeClient(clientId: string) {
    this.clients = this.clients.filter((c) => c.id !== clientId)
  }

  private broadcast(event: OmiAudioEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`
    const encoder = new TextEncoder()
    const encoded = encoder.encode(data)

    this.clients.forEach((client) => {
      try {
        client.controller.enqueue(encoded)
      } catch {
        this.removeClient(client.id)
      }
    })
  }
}

// Singleton instance
export const omiStore = new OmiEventStore()
