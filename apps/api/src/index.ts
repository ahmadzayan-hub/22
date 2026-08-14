import Fastify from "fastify";
import { systemRoutes } from "./routes/system.js";
import { gbrainRoutes } from "./routes/gbrain.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, ts: Date.now() }));
app.register(systemRoutes, { prefix: "/api/v1/system" });
app.register(gbrainRoutes, { prefix: "/api/v1/gbrain" });

app.listen({ port: 8080, host: "0.0.0.0" });
