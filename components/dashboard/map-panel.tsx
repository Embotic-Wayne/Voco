"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox"
import type { Coordinates, DemoStatus, Hospital } from "./types"

const DEFAULT_CENTER: Coordinates = { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" }

interface MapPanelProps {
  targetCoords: Coordinates
  hospitals: Hospital[]
  status: DemoStatus
}

export function MapPanel({ targetCoords, hospitals, status }: MapPanelProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.flyTo({
      center: [targetCoords.lng, targetCoords.lat],
      zoom: 13.2,
      duration: 2200,
      essential: true,
    })
  }, [targetCoords.lat, targetCoords.lng])

  const activityLabel = useMemo(() => {
    if (status === "recording") return "Receiving distress audio"
    if (status === "analyzing") return "Gemini reasoning in progress"
    if (status === "speaking") return "Playing guidance response"
    if (status === "done") return "Responder notified"
    if (status === "error") return "Pipeline error"
    return "Waiting for audio input"
  }, [status])

  if (!token) {
    return (
      <div className="h-full bg-card border-r border-border flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-sm text-alert">Map unavailable</p>
          <p className="text-xs text-muted-foreground">
            Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code> to render the live map.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: DEFAULT_CENTER.lng,
          latitude: DEFAULT_CENTER.lat,
          zoom: 11.8,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        <NavigationControl position="top-left" />

        <Marker latitude={targetCoords.lat} longitude={targetCoords.lng} anchor="center">
          <div className="relative">
            <span className="absolute -inset-3 rounded-full border border-alert/80 animate-ping" />
            <span className="absolute -inset-6 rounded-full border border-alert/40 animate-[ping_2s_linear_infinite]" />
            <span className="relative block h-4 w-4 rounded-full bg-alert border-2 border-white shadow-[0_0_20px_rgba(255,68,68,0.8)]" />
          </div>
        </Marker>

        {hospitals.map((hospital) => (
          <Marker key={hospital.id} latitude={hospital.lat} longitude={hospital.lng} anchor="bottom">
            <button
              type="button"
              onClick={() => setSelectedHospital((prev) => (prev === hospital.id ? null : hospital.id))}
              className="group"
            >
              <div className="h-4 w-4 rounded-full bg-primary border border-primary-foreground/80 shadow-[0_0_10px_rgba(37,171,255,0.5)]" />
              {selectedHospital === hospital.id && (
                <div className="mt-2 rounded bg-card/95 border border-border px-2 py-1 text-[10px] text-left min-w-36">
                  <p className="text-foreground">{hospital.name}</p>
                  <p className="text-muted-foreground">{hospital.distance}</p>
                </div>
              )}
            </button>
          </Marker>
        ))}
      </Map>

      <div className="absolute top-4 right-4 rounded bg-card/90 border border-border px-3 py-2 text-xs">
        <p className="text-muted-foreground">Current focus</p>
        <p className="text-primary font-semibold">{targetCoords.city ?? "Hayward, CA"}</p>
      </div>

      <div className="absolute left-4 right-4 bottom-4 rounded bg-card/85 border border-border px-3 py-2 text-xs">
        <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Map Status</p>
        <p className="text-foreground">{activityLabel}</p>
      </div>
    </div>
  )
}
