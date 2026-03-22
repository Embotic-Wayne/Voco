import type { Server as HttpServer } from "http"
import { Server as SocketIOServer } from "socket.io"

let io: SocketIOServer | null = null

export function getIo(): SocketIOServer | null {
  return io
}

export function attachSocketIO(httpServer: HttpServer): SocketIOServer {
  const corsOrigin =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SOCKET_URL || true
      : true

  const socketIo = new SocketIOServer(httpServer, {
    path: "/socket.io/",
    cors: { origin: corsOrigin },
  })

  io = socketIo
  return socketIo
}
