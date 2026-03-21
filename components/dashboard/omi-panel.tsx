"use client"

import { useOmiEvents } from "@/hooks/use-omi-events"
import type { OmiAudioEvent } from "@/lib/omi-store"
import { cn } from "@/lib/utils"

interface OmiPanelProps {
  onEventReceived?: (event: OmiAudioEvent) => void
  className?: string
}

export function OmiPanel({ onEventReceived, className }: OmiPanelProps) {
  const { isConnected, latestEvent, events, connectionError } = useOmiEvents({
    onEvent: onEventReceived,
  })

  const getStatusColor = (status: OmiAudioEvent["status"]) => {
    switch (status) {
      case "received":
        return "bg-blue-500"
      case "processing":
        return "bg-yellow-500 animate-pulse"
      case "completed":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getUrgencyColor = (level?: "low" | "medium" | "high" | "critical") => {
    switch (level) {
      case "critical":
        return "text-red-500 font-bold"
      case "high":
        return "text-orange-500 font-semibold"
      case "medium":
        return "text-yellow-500"
      default:
        return "text-green-500"
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className={cn("flex flex-col gap-3 p-4 bg-card rounded-lg border border-border", className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )}
          />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            OMI Device
          </span>
        </div>
        <span className={cn("text-xs", isConnected ? "text-green-500" : "text-red-500")}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {connectionError && (
        <p className="text-xs text-red-500">{connectionError}</p>
      )}

      {/* Latest Event */}
      {latestEvent && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Latest Activity</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(latestEvent.timestamp)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", getStatusColor(latestEvent.status))} />
            <span className="text-sm capitalize">{latestEvent.status}</span>
            {latestEvent.analysis?.urgencyLevel && (
              <span className={cn("text-xs ml-auto", getUrgencyColor(latestEvent.analysis.urgencyLevel))}>
                {latestEvent.analysis.urgencyLevel.toUpperCase()}
              </span>
            )}
          </div>

          {latestEvent.analysis?.transcript && (
            <div className="mt-2 p-2 bg-background/50 rounded text-xs">
              <p className="text-muted-foreground mb-1">Transcript:</p>
              <p className="text-foreground">{latestEvent.analysis.transcript}</p>
            </div>
          )}

          {latestEvent.analysis?.emotionalState && latestEvent.analysis.emotionalState.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {latestEvent.analysis.emotionalState.map((emotion, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                >
                  {emotion}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event History */}
      {events.length > 1 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Recent Events</span>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {events.slice(1, 6).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between text-xs py-1 px-2 bg-background/30 rounded"
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(event.status))} />
                  <span className="capitalize">{event.status}</span>
                </div>
                <span className="text-muted-foreground">{formatTime(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No events yet */}
      {events.length === 0 && !connectionError && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <p>Waiting for OMI audio...</p>
          <p className="text-xs mt-1">Audio will be processed automatically</p>
        </div>
      )}
    </div>
  )
}
