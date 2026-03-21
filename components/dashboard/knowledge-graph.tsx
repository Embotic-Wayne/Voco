"use client"

import { useEffect, useMemo } from "react"
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type NodeProps,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { GraphState } from "./types"

interface KnowledgeGraphProps {
  graphState: GraphState
}

const activeByState: Record<GraphState, string[]> = {
  idle: [],
  audio: ["audio-in"],
  thinking: ["gemini"],
  tts: ["tts"],
  notified: ["notified"],
}

type PipelineNodeData = {
  title: string
  subtitle: string
  active: boolean
}

function PipelineNode({ data }: NodeProps<Node<PipelineNodeData>>) {
  return (
    <div
      className={`rounded border px-2 py-1 min-w-[118px] max-w-[140px] bg-[#0c101ccc] ${data.active ? "border-white/70 shadow-[0_0_0_1px_rgba(37,171,255,0.45),0_0_10px_rgba(37,171,255,0.25)]" : "border-white/20"}`}
    >
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-primary !border-none" />
      <p className="text-[10px] font-semibold text-white leading-tight">{data.title}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{data.subtitle}</p>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-primary !border-none" />
    </div>
  )
}

const initialNodes: Node<PipelineNodeData>[] = [
  {
    id: "audio-in",
    type: "pipeline",
    position: { x: 8, y: 28 },
    data: { title: "Voice Intake", subtitle: "Omi.me", active: false },
  },
  {
    id: "gemini",
    type: "pipeline",
    position: { x: 150, y: 28 },
    data: { title: "Reasoning Model", subtitle: "Gemini 2.5 Flash", active: false },
  },
  {
    id: "tts",
    type: "pipeline",
    position: { x: 292, y: 28 },
    data: { title: "Feedback Response", subtitle: "ElevenLabs", active: false },
  },
  {
    id: "notified",
    type: "pipeline",
    position: { x: 434, y: 28 },
    data: { title: "Responder Notified", subtitle: "Dispatch Trigger", active: false },
  },
]

const initialEdges: Edge[] = [
  { id: "audio-gemini", source: "audio-in", target: "gemini", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "gemini-tts", source: "gemini", target: "tts", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
  { id: "tts-notified", source: "tts", target: "notified", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
]

export function KnowledgeGraph({ graphState }: KnowledgeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const styledEdges = useMemo(() => {
    const accent = graphState === "thinking" ? "#f4c357" : graphState === "tts" ? "#2ed392" : "#25abff"
    return edges.map((edge) => ({
      ...edge,
      style: {
        stroke: accent,
        strokeWidth: 1.75,
        opacity: 0.85,
      },
    }))
  }, [edges, graphState])

  useEffect(() => {
    const activeSet = new Set(activeByState[graphState])
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          active: activeSet.has(node.id),
        },
      }))
    )
    setEdges((current) => current)
  }, [graphState, setEdges, setNodes])

  return (
    <div className="shrink-0 h-[220px] border-t border-border bg-card">
      <div className="h-8 border-b border-border flex items-center px-3 bg-secondary/30">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-primary/20 flex items-center justify-center">
            <svg className="w-2 h-2 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span className="text-xs font-medium text-foreground">Reasoning Pipeline</span>
        </div>
        <div className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          Active phase: <span className="text-foreground">{graphState}</span>
        </div>
      </div>

      <div className="h-[calc(100%-2rem)] min-h-[160px]">
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          nodeTypes={{ pipeline: PipelineNode }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll={false}
          zoomOnScroll={false}
        >
          <Background color="rgba(255,255,255,0.06)" gap={14} />
        </ReactFlow>
      </div>
    </div>
  )
}
