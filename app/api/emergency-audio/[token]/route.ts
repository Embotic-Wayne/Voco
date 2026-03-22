import { NextResponse } from "next/server"
import { getEmergencyAudio } from "@/lib/emergency-audio-store"

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (!token) {
    return new NextResponse(null, { status: 404 })
  }

  const buf = getEmergencyAudio(token)
  if (!buf) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  })
}
