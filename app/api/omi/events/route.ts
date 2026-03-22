import { omiStore } from "@/lib/omi-store"

export const dynamic = "force-dynamic"

// Server-Sent Events endpoint for real-time OMI updates
export async function GET() {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const stream = new ReadableStream({
    start(controller) {
      omiStore.addClient({ id: clientId, controller })

      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`)
      )

      const latestEvent = omiStore.getLatestEvent()
      if (latestEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(latestEvent)}\n\n`))
      }
    },
    cancel() {
      omiStore.removeClient(clientId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
