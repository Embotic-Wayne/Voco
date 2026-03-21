"use client"

import { motion } from "framer-motion"
import type { DemoStatus } from "./types"

interface RightSidebarProps {
  status: DemoStatus
  monologueLines: string[]
  voiceResponse: string
}

export function RightSidebar({ status, monologueLines, voiceResponse }: RightSidebarProps) {
  const bars = Array.from({ length: 18 }, (_, i) => i)

  return (
    <aside className="w-[40%] min-w-[360px] border-l border-border bg-card flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Intelligence Sidebar</span>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status === "error" ? "bg-alert" : "bg-success"} animate-pulse`} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{status}</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 max-h-[38%] min-h-0 border-b border-border flex flex-col"
      >
        <div className="h-9 border-b border-border flex items-center px-4 bg-secondary/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center">
              <span className="text-[8px] text-primary font-bold">G</span>
            </div>
            <span className="text-xs font-medium text-foreground">Gemini Internal Monologue</span>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">1.5-pro</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 bg-background/50 min-h-0">
          {monologueLines.map((line, index) => (
            <div key={`${line}-${index}`} className="flex gap-2 text-muted-foreground">
              <span className="text-primary/60 shrink-0">[{String(index + 1).padStart(2, "0")}]</span>
              <span className="leading-relaxed">{line}</span>
            </div>
          ))}
          {monologueLines.length === 0 && (
            <div className="flex gap-2 text-muted-foreground">
              <span className="text-primary/60">[--]</span>
              <span>Awaiting recorded audio input...</span>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 min-h-[140px] border-b border-border flex flex-col min-h-0"
      >
        <div className="h-9 border-b border-border flex items-center px-4 bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent/20 flex items-center justify-center">
              <span className="text-[8px] text-accent font-bold">XI</span>
            </div>
            <span className="text-xs font-medium text-foreground">ElevenLabs Status</span>
          </div>
        </div>

        <div className="flex-1 p-3 flex flex-col gap-2 min-h-0">
          <div className="flex items-end gap-0.5 h-8 shrink-0">
            {bars.map((bar) => (
              <span
                key={bar}
                className={`w-0.5 rounded ${status === "speaking" ? "bg-accent animate-wave" : "bg-muted-foreground/30"}`}
                style={{
                  height: `${20 + (bar % 6) * 8}%`,
                  animationDelay: `${bar * 0.06}s`,
                }}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground shrink-0">
            {status === "speaking" ? "Streaming Turbo v2.5 voice response..." : "Waveform idle"}
          </p>
          <div className="flex-1 min-h-[4rem] overflow-y-auto rounded border border-border/60 bg-background/40 px-2 py-2">
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {voiceResponse || "Voice response transcript will appear here after Gemini reasoning."}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex-none shrink-0 max-h-[28%] overflow-y-auto">
        <div className="h-9 border-b border-border flex items-center px-4 bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-alert/20 flex items-center justify-center">
              <span className="text-[8px] text-alert font-bold">!</span>
            </div>
            <span className="text-xs font-medium text-foreground">Response Snapshot</span>
          </div>
        </div>
        <div className="p-4 text-xs text-muted-foreground space-y-2">
          <p>Phase: <span className="text-foreground">{status}</span></p>
          <p>Monologue lines: <span className="text-foreground">{monologueLines.length}</span></p>
          <p>TTS ready: <span className="text-foreground">{voiceResponse ? "Yes" : "No"}</span></p>
        </div>
      </div>
    </aside>
  )
}
