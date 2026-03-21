"use client"

import { useEffect, useState } from "react"

export function TopNavigation() {
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(0.3))

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveHeights(prev => 
        prev.map(() => 0.2 + Math.random() * 0.8)
      )
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/40">
            <span className="text-primary font-bold text-sm tracking-tighter">V</span>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-alert animate-pulse-alert" />
        </div>
        <span className="font-semibold text-foreground tracking-widest text-sm">VOCO</span>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">System Status:</span>
          <span className="text-xs text-success font-medium uppercase tracking-wider">Active</span>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Live Audio Waveform */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-alert animate-pulse-glow" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Live Audio</span>
          <div className="flex items-end gap-0.5 h-5 px-2">
            {waveHeights.map((height, i) => (
              <div 
                key={i}
                className="w-0.5 bg-primary rounded-full transition-all duration-100"
                style={{ 
                  height: `${height * 20}px`,
                  opacity: 0.4 + height * 0.6
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Time & Connection */}
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground font-mono">
          <span className="text-foreground">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
          <span className="mx-1 text-border">|</span>
          <span>UTC-8</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground ml-1">Connected</span>
        </div>
      </div>
    </header>
  )
}
