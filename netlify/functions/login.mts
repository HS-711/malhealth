import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { verifyPassword } from "./_shared/password.mts";
import { json, sessionStore, usersStore, SESSION_TTL_MS } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "허용되지 않은 메서드입니다" }, 405);
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청 형식입니다" }, 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

  const users = usersStore();
  const user = await users.get(username, { type: "json" }) as
    | { username: string; displayName: string; salt: string; hash: string }
    | null;

  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, 401);
  }

  const sessions = sessionStore();
  const token = randomUUID();
  await sessions.setJSON(token, {
    username: user.username,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return json({ ok: true, token, username: user.username, displayName: user.displayName });
};

export const config: Config = { path: "/api/login" };
