"use client"

import type { BiometricZone, DistressData } from "./types"

const ZONE_PATHS: Record<Exclude<BiometricZone, null>, string> = {
  head: "M 50 12 C 38 12 30 22 30 34 C 30 44 36 52 50 52 C 64 52 70 44 70 34 C 70 22 62 12 50 12 Z",
  chest: "M 32 54 L 32 78 L 68 78 L 68 54 C 58 48 42 48 32 54 Z",
  abdomen: "M 34 80 L 34 108 L 66 108 L 66 80 Z",
  left_arm: "M 28 56 L 12 62 L 8 98 L 22 102 L 30 78 Z",
  right_arm: "M 72 56 L 88 62 L 92 98 L 78 102 L 70 78 Z",
  left_leg: "M 36 110 L 32 168 L 46 172 L 50 118 Z",
  right_leg: "M 64 110 L 68 168 L 54 172 L 50 118 Z",
}

interface BiometricHeatmapProps {
  distressData: DistressData
}

export function BiometricHeatmap({ distressData }: BiometricHeatmapProps) {
  const active = distressData.affectedZone

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 100 180" className="h-44 w-auto max-w-full text-muted-foreground/60" aria-hidden>
        <defs>
          <linearGradient id="heat" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {(Object.keys(ZONE_PATHS) as BiometricZone[]).map((zone) => {
          const isActive = active === zone
          return (
            <path
              key={zone}
              d={ZONE_PATHS[zone]}
              fill={isActive ? "url(#heat)" : "currentColor"}
              stroke={isActive ? "rgb(16 185 129)" : "currentColor"}
              strokeWidth={isActive ? 1.5 : 0.5}
              className={isActive ? "text-emerald-500/30" : "text-border"}
            />
          )
        })}
      </svg>
    </div>
  )
}
