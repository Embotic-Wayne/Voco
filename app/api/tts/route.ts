export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return new Response("Missing ELEVENLABS_API_KEY", { status: 500 })
    }

    const body = await request.json()
    const voiceId = body.voiceId || "EXAVITQu4vr4xnSDxMaL"

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: body.text,
        model_id: body.model_id || "eleven_turbo_v2_5",
        optimize_streaming_latency: body.optimize_streaming_latency ?? 4,
        output_format: body.output_format || "mp3_44100_128",
      }),
    })

    if (!response.ok || !response.body) {
      const message = await response.text().catch(() => "ElevenLabs error")
      return new Response(message, { status: response.status || 502 })
    }

    return new Response(response.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    })
  } catch (error) {
    console.error("TTS fallback route failed", error)
    return new Response("TTS fallback route failed", { status: 500 })
  }
}
