"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { OmiAudioEvent } from "@/lib/omi-store"

export interface UseOmiEventsOptions {
  autoConnect?: boolean
  onEvent?: (event: OmiAudioEvent) => void
  onError?: (error: Error) => void
}

export function useOmiEvents(options: UseOmiEventsOptions = {}) {
  const { autoConnect = true, onEvent, onError } = options

  const [isConnected, setIsConnected] = useState(false)
  const [latestEvent, setLatestEvent] = useState<OmiAudioEvent | null>(null)
  const [events, setEvents] = useState<OmiAudioEvent[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource("/api/omi/events")
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log("[useOmiEvents] Received SSE data:", data.type || data.status, data.id || "")

          if (data.type === "connected") {
            console.log("[useOmiEvents] SSE connected, client:", data.clientId)
            return
          }

          const omiEvent = data as OmiAudioEvent
          console.log("[useOmiEvents] Processing event:", omiEvent.status, omiEvent.id)

          setLatestEvent(omiEvent)
          setEvents((prev: OmiAudioEvent[]) => {
            const existingIndex = prev.findIndex((e: OmiAudioEvent) => e.id === omiEvent.id)
            if (existingIndex !== -1) {
              const updated = [...prev]
              updated[existingIndex] = omiEvent
              return updated
            }
            return [omiEvent, ...prev].slice(0, 50)
          })

          onEvent?.(omiEvent)
        } catch (err) {
          console.error("Failed to parse OMI event:", err)
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        eventSource.close()

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        reconnectAttempts.current++

        setConnectionError(`Connection lost. Reconnecting in ${delay / 1000}s...`)

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, delay)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to connect")
      setConnectionError(error.message)
      onError?.(error)
    }
  }, [onEvent, onError])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  const fetchHistory = useCallback(async (limit = 10) => {
    try {
      const response = await fetch(`/api/omi/history?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
        if (data.events?.length > 0) {
          setLatestEvent(data.events[0])
        }
      }
    } catch (err) {
      console.error("Failed to fetch OMI history:", err)
    }
  }, [])

  useEffect(() => {
    if (autoConnect) {
      fetchHistory()
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect, fetchHistory])

  return {
    isConnected,
    latestEvent,
    events,
    connectionError,
    connect,
    disconnect,
    fetchHistory,
  }
}
