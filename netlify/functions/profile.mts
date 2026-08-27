import type { Config } from "@netlify/functions";
import { requireAuth, json, usersStore } from "./_shared/auth.mts";
import { hashPassword, verifyPassword } from "./_shared/password.mts";

type UserRecord = {
  username: string;
  displayName: string;
  salt: string;
  hash: string;
  createdAt: number;
};

export default async (req: Request) => {
  const auth = await requireAuth(req);
  if (!auth) return json({ error: "로그인이 필요합니다" }, 401);

  const users = usersStore();

  if (req.method === "GET") {
    return json({ username: auth.username, displayName: auth.displayName });
  }

  if (req.method === "PATCH") {
    let body: { displayName?: string; currentPassword?: string; newPassword?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "잘못된 요청 형식입니다" }, 400);
    }

    const user = await users.get(auth.username, { type: "json" }) as UserRecord | null;
    if (!user) return json({ error: "사용자를 찾을 수 없습니다" }, 404);

    const updated: UserRecord = { ...user };
    let changed = false;

    if (body.displayName !== undefined) {
      const nextName = body.displayName.trim();
      if (nextName.length < 1 || nextName.length > 30) {
        return json({ error: "닉네임은 1~30자로 입력해주세요" }, 400);
      }
      updated.displayName = nextName;
      changed = true;
    }

    if (body.newPassword !== undefined) {
      if (!body.currentPassword || !verifyPassword(body.currentPassword, user.salt, user.hash)) {
        return json({ error: "현재 비밀번호가 올바르지 않습니다" }, 401);
      }
      if (body.newPassword.length < 4) {
        return json({ error: "새 비밀번호는 4자 이상이어야 합니다" }, 400);
      }
      const { salt, hash } = hashPassword(body.newPassword);
      updated.salt = salt;
      updated.hash = hash;
      changed = true;
    }

    if (!changed) {
      return json({ error: "변경할 내용이 없습니다" }, 400);
    }

    await users.setJSON(auth.username, updated);

    return json({ ok: true, username: updated.username, displayName: updated.displayName });
  }

  return json({ error: "허용되지 않은 메서드입니다" }, 405);
};

export const config: Config = { path: "/api/profile" };
