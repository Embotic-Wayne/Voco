import { NextResponse } from "next/server"
import { omiStore } from "@/lib/omi-store"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get("limit") || "10", 10)

  const events = omiStore.getEvents(Math.min(limit, 50))

  return NextResponse.json({
    events,
    count: events.length,
  })
}
