/**
 * Server-side ElevenLabs TTS; uses ELEVENLABS_API_KEY (not the public key).
 */
export async function synthesizeElevenLabsToBuffer(text: string, voiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY")
  }

  const vid =
    voiceId?.trim() ||
    process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID?.trim() ||
    "EXAVITQu4vr4xnSDxMaL"

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      optimize_streaming_latency: 4,
      output_format: "mp3_44100_128",
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail || "unknown"}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
