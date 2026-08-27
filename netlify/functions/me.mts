import type { Config } from "@netlify/functions";
import { requireAuth, json, sessionStore } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method === "GET") {
    const session = await requireAuth(req);
    if (!session) return json({ error: "로그인이 필요합니다" }, 401);
    return json({ username: session.username, displayName: session.displayName });
  }

  if (req.method === "DELETE") {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token) {
      await sessionStore().delete(token);
    }
    return json({ ok: true });
  }

  return json({ error: "허용되지 않은 메서드입니다" }, 405);
};

export const config: Config = { path: "/api/me" };
