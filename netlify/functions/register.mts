import type { Config } from "@netlify/functions";
import { hashPassword } from "./_shared/password.mts";
import { json, usersStore } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "허용되지 않은 메서드입니다" }, 405);
  }

  let body: { username?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "잘못된 요청 형식입니다" }, 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  const displayName = (body.displayName || "").trim() || username;

  if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
    return json({ error: "아이디는 영문 소문자/숫자/-/_ 3~20자로 입력해주세요" }, 400);
  }
  if (password.length < 4) {
    return json({ error: "비밀번호는 4자 이상이어야 합니다" }, 400);
  }

  const users = usersStore();
  const existing = await users.get(username);
  if (existing) {
    return json({ error: "이미 존재하는 아이디입니다" }, 409);
  }

  const { salt, hash } = hashPassword(password);
  await users.setJSON(username, {
    username,
    displayName,
    salt,
    hash,
    createdAt: Date.now(),
  });

  return json({ ok: true, username, displayName });
};

export const config: Config = { path: "/api/register" };
