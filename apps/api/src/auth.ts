import { FastifyRequest } from "fastify";

export async function auth(req: FastifyRequest) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  if (t !== process.env.OPERATOR_TOKEN) throw { statusCode: 401, error: "unauthorized" };
}
