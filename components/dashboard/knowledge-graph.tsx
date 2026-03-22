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
  /** Server runs Gemini + Perplexity during the same analyze phase */
  thinking: ["gemini", "perplexity"],
  tts: ["tts"],
  notified: ["notified"],
  "omi-processing": ["audio-in", "gemini"],
}

type PipelineNodeData = {
  title: string
  subtitle: string
  active: boolean
}

function PipelineNode({ data }: NodeProps<Node<PipelineNodeData>>) {
  return (
    <div
      className={`rounded border px-1.5 py-0.5 min-w-[76px] max-w-[92px] bg-[#0c101ccc] ${data.active ? "border-white/70 shadow-[0_0_0_1px_rgba(37,171,255,0.45),0_0_10px_rgba(37,171,255,0.25)]" : "border-white/20"}`}
    >
      <Handle type="target" position={Position.Left} className="!w-1 !h-1 !bg-primary/80 !border-none" />
      <p className="text-[8px] font-semibold text-white leading-tight">{data.title}</p>
      <p className="text-[7px] text-muted-foreground mt-px leading-snug">{data.subtitle}</p>
      <Handle type="source" position={Position.Right} className="!w-1 !h-1 !bg-primary/80 !border-none" />
    </div>
  )
}

const initialNodes: Node<PipelineNodeData>[] = [
  {
    id: "audio-in",
    type: "pipeline",
    position: { x: 2, y: 36 },
    data: { title: "Voice Intake", subtitle: "Omi.me", active: false },
  },
  {
    id: "gemini",
    type: "pipeline",
    position: { x: 72, y: 36 },
    data: { title: "Reasoning Model", subtitle: "Gemini 2.5 Flash", active: false },
  },
  {
    id: "perplexity",
    type: "pipeline",
    position: { x: 142, y: 36 },
    data: { title: "Live Intel", subtitle: "Perplexity Sonar", active: false },
  },
  {
    id: "tts",
    type: "pipeline",
    position: { x: 212, y: 36 },
    data: { title: "Feedback Response", subtitle: "ElevenLabs", active: false },
  },
  {
    id: "notified",
    type: "pipeline",
    position: { x: 282, y: 36 },
    data: { title: "Responder Notified", subtitle: "Dispatch Trigger", active: false },
  },
]

/** Matches inactive node border `border-white/20` */
const PIPELINE_EDGE_COLOR = "rgba(255, 255, 255, 0.22)"

const initialEdges: Edge[] = [
  {
    id: "audio-gemini",
    source: "audio-in",
    target: "gemini",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: PIPELINE_EDGE_COLOR, width: 10, height: 10 },
  },
  {
    id: "gemini-perplexity",
    source: "gemini",
    target: "perplexity",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: PIPELINE_EDGE_COLOR, width: 10, height: 10 },
  },
  {
    id: "perplexity-tts",
    source: "perplexity",
    target: "tts",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: PIPELINE_EDGE_COLOR, width: 10, height: 10 },
  },
  {
    id: "tts-notified",
    source: "tts",
    target: "notified",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: PIPELINE_EDGE_COLOR, width: 10, height: 10 },
  },
]

export function KnowledgeGraph({ graphState }: KnowledgeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const styledEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      style: {
        stroke: PIPELINE_EDGE_COLOR,
        strokeWidth: 1.25,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: PIPELINE_EDGE_COLOR,
        width: 10,
        height: 10,
      },
    }))
  }, [edges])

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
