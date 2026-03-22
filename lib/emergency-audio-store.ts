import { randomUUID } from "crypto"

const TTL_MS = 15 * 60 * 1000

const entries = new Map<string, { buf: Buffer; expiresAt: number }>()

function pruneExpired() {
  const now = Date.now()
  for (const [key, value] of entries) {
    if (value.expiresAt < now) entries.delete(key)
  }
}

export function storeEmergencyAudio(buffer: Buffer): string {
  pruneExpired()
  const token = randomUUID()
  entries.set(token, { buf: buffer, expiresAt: Date.now() + TTL_MS })
  return token
}

export function getEmergencyAudio(token: string): Buffer | null {
  pruneExpired()
  const entry = entries.get(token)
  if (!entry || entry.expiresAt < Date.now()) {
    entries.delete(token)
    return null
  }
  return entry.buf
}
