import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { attachSocketIO } from "./socket"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "0.0.0.0"
const port = Number(process.env.PORT) || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true)
    void handle(req, res, parsedUrl)
  })

  attachSocketIO(httpServer)

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`)
  })
})
