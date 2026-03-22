"use client"

import { motion } from "framer-motion"
import type { DemoStatus, DistressData, EvaluationAgents, RealTimeContext } from "./types"
import { BiometricHeatmap } from "./biometric-heatmap"

interface RightSidebarProps {
  status: DemoStatus
  monologueLines: string[]
  voiceResponse: string
  realTimeContext: RealTimeContext
  agentEvaluations: EvaluationAgents
  distressData: DistressData
}

function severityAccent(score: number): string {
  if (score <= 2) return "border-emerald-500/50 bg-emerald-500/10"
  if (score === 3) return "border-amber-500/50 bg-amber-500/10"
  return "border-red-500/50 bg-red-500/10"
}

function severityText(score: number): string {
  if (score <= 2) return "text-emerald-400"
  if (score === 3) return "text-amber-400"
  return "text-red-400"
}

export function RightSidebar({
  status,
  monologueLines,
  voiceResponse,
  realTimeContext,
  agentEvaluations,
  distressData,
}: RightSidebarProps) {
  const bars = Array.from({ length: 18 }, (_, i) => i)
  const liveIntel = [
    ...realTimeContext.hospitals.slice(0, 3),
    ...realTimeContext.policeStations.slice(0, 1),
    ...(realTimeContext.fireStations ?? []).slice(0, 2),
  ]

  return (
    <aside className="flex h-full min-h-0 w-[40%] min-w-[360px] max-w-[520px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="h-11 shrink-0 border-b border-border flex items-center px-4 bg-card/95 z-10">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Intelligence Sidebar</span>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status === "error" ? "bg-alert" : "bg-success"} animate-pulse`} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{status}</span>
        </div>
      </div>

      <div
        id="intel-sidebar-scroll"
        className="scrollbar-none flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:bg-transparent"
      >
        {/* Gemini monologue */}
        <section className="border-b border-border">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 shrink-0 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                <span className="text-xs text-primary font-bold">G</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Gemini Internal Monologue</span>
            </div>
            <span className="ml-auto text-sm text-muted-foreground font-mono">2.5-flash</span>
          </div>
          <div className="p-4 font-mono text-sm space-y-2 bg-background/50">
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
        </section>

        {/* Biometric triage */}
        <section className="border-b border-border">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
                <span className="text-xs text-emerald-400 font-bold">B</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Localized distress</span>
            </div>
          </div>
          <div className="p-4 bg-background/40">
            <BiometricHeatmap distressData={distressData} />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              {distressData.affectedZone
                ? `Active zone: ${distressData.affectedZone.replace(/_/g, " ")}`
                : "Awaiting triage localization from audio"}
            </p>
          </div>
        </section>

        {/* ElevenLabs */}
        <section className="border-b border-border">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center px-0.5">
                <span className="text-xs text-accent font-bold leading-none">XI</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">ElevenLabs Status</span>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {status === "speaking" ? (
              <div className="flex h-8 shrink-0 w-full max-w-[220px] items-end justify-center gap-0.5">
                {bars.map((bar) => (
                  <motion.span
                    key={bar}
                    className="w-0.5 origin-bottom rounded-full bg-accent"
                    initial={false}
                    animate={{ scaleY: [0.28, 1, 0.28] }}
                    transition={{
                      duration: 0.85,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: bar * 0.055,
                    }}
                    style={{
                      height: `${22 + (bar % 6) * 10}%`,
                      maxHeight: "100%",
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-8 shrink-0 w-full max-w-[220px] items-center justify-center px-1">
                <div className="h-0.5 w-full rounded-full bg-muted-foreground/35" />
              </div>
            )}
            <p className="text-sm text-muted-foreground shrink-0">
              {status === "speaking" ? "Streaming Turbo v2.5 voice response..." : "Waveform idle"}
            </p>
            <div className="min-h-[4rem] rounded border border-border/60 bg-background/40 px-3 py-2.5">
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {voiceResponse || "Voice response transcript will appear here after Gemini reasoning."}
              </p>
            </div>
          </div>
        </section>

        {/* Situational awareness */}
        <section className="border-b border-border">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center px-0.5">
                <span className="text-xs text-primary font-bold leading-none">SA</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Situational Awareness</span>
            </div>
            <span className="ml-auto text-xs px-2 py-0.5 rounded border border-primary/40 text-primary shrink-0">
              Source: Perplexity AI
            </span>
          </div>
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            {realTimeContext.searchArea && (
              <p className="text-sm text-muted-foreground/90 pb-1 border-b border-border/40">
                Search area: {realTimeContext.searchArea.city} ({realTimeContext.searchArea.lat.toFixed(4)},{" "}
                {realTimeContext.searchArea.lng.toFixed(4)})
              </p>
            )}
            {liveIntel.length > 0 ? (
              liveIntel.map((entry) => (
                <div key={entry.id} className="rounded border border-border/60 bg-background/40 px-3 py-2.5">
                  <p className="text-base font-medium text-foreground">{entry.name}</p>
                  <p>
                    {entry.kind === "hospital" ? "Hospital" : entry.kind === "police" ? "Police" : "Fire"} ·{" "}
                    {entry.address}
                  </p>
                  <p>Phone: {entry.phone}</p>
                  <p>Live Intel: {entry.status}</p>
                </div>
              ))
            ) : (
              <p>No live intel available yet.</p>
            )}
            {realTimeContext.usedFallback && (
              <p className="text-alert">{realTimeContext.error || "Fallback context currently active."}</p>
            )}
          </div>
        </section>

        {/* Impact agent */}
        <motion.section
          id="impact-agent"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
          className="border-b border-border"
        >
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
                <span className="text-xs text-violet-300 font-bold">I</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Impact Agent</span>
            </div>
            <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">Affected parties</span>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-base text-foreground leading-relaxed">{agentEvaluations.impact.summary}</p>
            {agentEvaluations.impact.bullets.length > 0 && (
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5">
                {agentEvaluations.impact.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        {/* Severity agent */}
        <motion.section id="severity-agent" initial={{ opacity: 0.85 }} animate={{ opacity: 1 }} className="border-b border-border">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center">
                <span className="text-xs text-orange-300 font-bold">S</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Severity Agent</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div
              className={`flex items-center gap-3 rounded border px-3 py-2.5 ${severityAccent(agentEvaluations.severity.score)}`}
            >
              <div className={`text-3xl font-bold tabular-nums ${severityText(agentEvaluations.severity.score)}`}>
                {agentEvaluations.severity.score}
                <span className="text-xs font-normal text-muted-foreground">/5</span>
              </div>
              <div>
                <p className={`text-base font-semibold ${severityText(agentEvaluations.severity.score)}`}>
                  {agentEvaluations.severity.label}
                </p>
                <p className="text-xs text-muted-foreground">Incident severity index</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{agentEvaluations.severity.rationale}</p>
          </div>
        </motion.section>

        {/* Dispatcher / first responder guidance */}
        <motion.section
          id="guidance-agent"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
          className="border-b border-border"
        >
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30 sticky top-0 z-[1] backdrop-blur-sm bg-secondary/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-cyan-500/20 flex items-center justify-center">
                <span className="text-xs text-cyan-300 font-bold">D</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Dispatch &amp; Field Guidance</span>
            </div>
            <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">PSAP + responders</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Dispatcher checklist</p>
              <ol className="list-decimal list-inside text-sm text-foreground space-y-2">
                {agentEvaluations.guidance.dispatcherActions.map((action, i) => (
                  <li key={i} className="leading-relaxed">
                    {action}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded border border-border/60 bg-background/40 px-3 py-2.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">First responders</p>
              <p className="text-base text-foreground leading-relaxed">{agentEvaluations.guidance.firstResponderNotes}</p>
            </div>
          </div>
        </motion.section>

        {/* Snapshot */}
        <section className="pb-6">
          <div className="h-12 border-b border-border flex items-center px-4 bg-secondary/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-alert/20 flex items-center justify-center">
                <span className="text-xs text-alert font-bold">!</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Response Snapshot</span>
            </div>
          </div>
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p>
              Phase: <span className="text-foreground">{status}</span>
            </p>
            <p>
              Monologue lines: <span className="text-foreground">{monologueLines.length}</span>
            </p>
            <p>
              TTS ready: <span className="text-foreground">{voiceResponse ? "Yes" : "No"}</span>
            </p>
          </div>
        </section>
      </div>
    </aside>
  )
}
