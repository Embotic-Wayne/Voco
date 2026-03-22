"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Map as MapboxMap } from "mapbox-gl"
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox"
import type { Coordinates, DemoStatus, Hospital, RealTimeContext, ResponderPlace } from "./types"

const DEFAULT_CENTER: Coordinates = { lat: 37.6688, lng: -122.0808, city: "Hayward, CA" }

/** Camera tuned for 3D terrain + extruded buildings (visible ~zoom 14+). */
const MAP_3D_PITCH = 58
const MAP_3D_BEARING = -18
const MAP_FOCUS_ZOOM = 14.85

const TERRAIN_SOURCE_ID = "voco-mapbox-dem"
const BUILDINGS_LAYER_ID = "voco-3d-buildings"

function configureTerrainAndBuildings(map: MapboxMap) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    })
  }
  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.35 })

  map.setFog({
    range: [0.6, 12],
    color: "rgb(14, 20, 36)",
    "high-color": "rgb(36, 52, 82)",
    "horizon-blend": 0.45,
    "space-color": "rgb(8, 10, 18)",
    "star-intensity": 0.12,
  })

  map.setLight({
    anchor: "viewport",
    color: "#e8eef8",
    intensity: 0.55,
    position: [1.8, 210, 45],
  })

  if (map.getLayer(BUILDINGS_LAYER_ID)) return

  const layers = map.getStyle().layers
  let labelLayerId: string | undefined
  for (const layer of layers ?? []) {
    if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout && layer.layout["text-field"]) {
      labelLayerId = layer.id
      break
    }
  }

  map.addLayer(
    {
      id: BUILDINGS_LAYER_ID,
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#3d4f63",
          50,
          "#5a6e82",
          120,
          "#7a8fa0",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.05,
          ["coalesce", ["get", "height"], 12],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.05,
          ["coalesce", ["get", "min_height"], 0],
        ],
        "fill-extrusion-opacity": 0.92,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    labelLayerId
  )
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

type RouteFeature = GeoJSON.Feature<GeoJSON.LineString>

async function fetchDrivingRoute(
  token: string,
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  signal?: AbortSignal
): Promise<RouteFeature | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as { routes?: { geometry?: GeoJSON.LineString }[] }
  const geometry = data.routes?.[0]?.geometry
  if (!geometry?.coordinates?.length) return null
  return {
    type: "Feature",
    properties: {},
    geometry,
  }
}

interface MapPanelProps {
  targetCoords: Coordinates
  hospitals: Hospital[]
  realTimeContext: RealTimeContext
  dispatchSequence: number
  status: DemoStatus
}

export function MapPanel({
  targetCoords,
  hospitals,
  realTimeContext,
  dispatchSequence,
  status,
}: MapPanelProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [selectedResponder, setSelectedResponder] = useState<string | null>(null)
  const [primaryRoute, setPrimaryRoute] = useState<RouteFeature | null>(null)
  const [secondaryRoute, setSecondaryRoute] = useState<RouteFeature | null>(null)
  const [routeTargetIds, setRouteTargetIds] = useState<{ primary: string | null; secondary: string | null }>({
    primary: null,
    secondary: null,
  })
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.flyTo({
      center: [targetCoords.lng, targetCoords.lat],
      zoom: MAP_FOCUS_ZOOM,
      pitch: MAP_3D_PITCH,
      bearing: MAP_3D_BEARING,
      duration: 2200,
      essential: true,
    })
  }, [targetCoords.lat, targetCoords.lng])

  const responders = useMemo(() => {
    const liveResponders = [
      ...realTimeContext.hospitals,
      ...realTimeContext.policeStations,
      ...(realTimeContext.fireStations ?? []),
    ].filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    if (liveResponders.length > 0) return liveResponders
    return hospitals.map<ResponderPlace>((hospital) => ({
      id: hospital.id,
      kind: "hospital",
      name: hospital.name,
      address: "Fallback responder location",
      phone: "N/A",
      status: "Fallback routing mode active",
      lat: hospital.lat,
      lng: hospital.lng,
      distance: hospital.distance,
    }))
  }, [hospitals, realTimeContext.fireStations, realTimeContext.hospitals, realTimeContext.policeStations])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.flyTo({
      center: [targetCoords.lng, targetCoords.lat],
      zoom: MAP_FOCUS_ZOOM,
      pitch: MAP_3D_PITCH,
      bearing: MAP_3D_BEARING,
      duration: 1600,
      essential: true,
    })
    const timer = setTimeout(() => {
      if (!mapRef.current || responders.length === 0) return
      const lngs = [targetCoords.lng, ...responders.map((item) => item.lng)]
      const lats = [targetCoords.lat, ...responders.map((item) => item.lat)]
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      mapRef.current.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 70, duration: 1800, essential: true, pitch: MAP_3D_PITCH, bearing: MAP_3D_BEARING, maxZoom: 16.5 }
      )
    }, 1800)
    return () => clearTimeout(timer)
  }, [dispatchSequence, responders, targetCoords.lat, targetCoords.lng])

  useEffect(() => {
    if (!token) return
    const incident = { lat: targetCoords.lat, lng: targetCoords.lng }
    const hp = responders.filter((r) => r.kind === "hospital" || r.kind === "police")
    const pool = hp.length > 0 ? hp : responders
    const sorted = [...pool].sort((a, b) => haversineKm(incident, a) - haversineKm(incident, b))
    const primary = sorted[0]
    const secondary = sorted[1]
    if (!primary) {
      setPrimaryRoute(null)
      setSecondaryRoute(null)
      setRouteTargetIds({ primary: null, secondary: null })
      return
    }
    const controller = new AbortController()
    const from = { lng: incident.lng, lat: incident.lat }
    const run = async () => {
      try {
        const [a, b] = await Promise.all([
          fetchDrivingRoute(token, from, { lng: primary.lng, lat: primary.lat }, controller.signal),
          secondary
            ? fetchDrivingRoute(token, from, { lng: secondary.lng, lat: secondary.lat }, controller.signal)
            : Promise.resolve(null),
        ])
        setPrimaryRoute(a)
        setSecondaryRoute(b)
        setRouteTargetIds({
          primary: primary.id,
          secondary: secondary?.id ?? null,
        })
      } catch {
        setPrimaryRoute(null)
        setSecondaryRoute(null)
        setRouteTargetIds({ primary: null, secondary: null })
      }
    }
    void run()
    return () => controller.abort()
  }, [token, targetCoords.lat, targetCoords.lng, dispatchSequence, responders])

  const activityLabel = useMemo(() => {
    if (status === "recording") return "Receiving distress audio"
    if (status === "analyzing") return "Gemini reasoning in progress"
    if (status === "speaking") return "Playing guidance response"
    if (status === "done") return "Responder notified"
    if (status === "error") return "Pipeline error"
    if (status === "omi-listening") return "Receiving OMI device audio"
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
          pitch: MAP_3D_PITCH,
          bearing: MAP_3D_BEARING,
        }}
        maxPitch={85}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={(e) => configureTerrainAndBuildings(e.target)}
      >
        <NavigationControl position="top-left" />

        {primaryRoute && (
          <Source id="dispatch-route-primary" type="geojson" data={primaryRoute}>
            <Layer
              id="route-glow"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#25abff",
                "line-width": 10,
                "line-opacity": 0.2,
                "line-blur": 3,
              }}
            />
            <Layer
              id="route-line-primary"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#25abff",
                "line-width": 4,
                "line-opacity": 0.92,
              }}
            />
          </Source>
        )}

        {secondaryRoute && (
          <Source id="dispatch-route-secondary" type="geojson" data={secondaryRoute}>
            <Layer
              id="route-line-secondary"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "rgba(245, 158, 11, 0.95)",
                "line-width": 3,
                "line-opacity": 0.8,
                "line-dasharray": [1.5, 2],
              }}
            />
          </Source>
        )}

        <Marker latitude={targetCoords.lat} longitude={targetCoords.lng} anchor="center">
          <div className="relative">
            <span className="absolute -inset-3 rounded-full border border-alert/80 animate-ping" />
            <span className="absolute -inset-6 rounded-full border border-alert/40 animate-[ping_2s_linear_infinite]" />
            <span className="relative block h-4 w-4 rounded-full bg-alert border-2 border-white shadow-[0_0_20px_rgba(255,68,68,0.8)]" />
          </div>
        </Marker>

        {responders.map((responder) => (
          <Marker key={responder.id} latitude={responder.lat} longitude={responder.lng} anchor="bottom">
            <button
              type="button"
              onClick={() => setSelectedResponder((prev) => (prev === responder.id ? null : responder.id))}
              className="group relative"
            >
              {(routeTargetIds.primary === responder.id || routeTargetIds.secondary === responder.id) && (
                <span
                  className={`pointer-events-none absolute -inset-2 rounded-full border-2 animate-pulse ${
                    routeTargetIds.primary === responder.id
                      ? "border-primary shadow-[0_0_12px_rgba(37,171,255,0.6)]"
                      : "border-amber-400/90 shadow-[0_0_10px_rgba(245,158,11,0.45)]"
                  }`}
                />
              )}
              <div
                className={`relative h-5 w-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${
                  responder.kind === "hospital"
                    ? "bg-primary border-primary-foreground/80 text-white shadow-[0_0_10px_rgba(37,171,255,0.5)]"
                    : responder.kind === "police"
                      ? "bg-amber-500 border-amber-200 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                      : "bg-red-600 border-red-200 text-white shadow-[0_0_10px_rgba(220,38,38,0.45)]"
                }`}
              >
                {responder.kind === "hospital" ? "H" : responder.kind === "police" ? "P" : "F"}
              </div>
              {selectedResponder === responder.id && (
                <div className="mt-2 rounded bg-card/95 border border-border px-2 py-1 text-[10px] text-left min-w-36">
                  <p className="text-foreground">{responder.name}</p>
                  <p className="text-muted-foreground">{responder.distance ?? "N/A"}</p>
                  <p className="text-muted-foreground">{responder.status}</p>
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

      <div className="absolute left-4 right-4 bottom-4 rounded bg-card/85 border border-border px-3 py-2 text-xs space-y-1">
        <p className="text-muted-foreground uppercase tracking-widest text-[10px]">Map Status</p>
        <p className="text-foreground">{activityLabel}</p>
        {(primaryRoute || secondaryRoute) && (
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
            <span className="text-primary">━━</span> driving route to nearest ER/PD ·{" "}
            <span className="text-amber-400">╍╍</span> second-nearest (when available)
          </p>
        )}
      </div>
    </div>
  )
}
