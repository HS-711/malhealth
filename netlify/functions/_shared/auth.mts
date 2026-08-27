import { getStore } from "@netlify/blobs";

export type Session = {
  username: string;
  expiresAt: number;
};

export type AuthedUser = {
  username: string;
  displayName: string;
};

// 세션은 60일간 유효. 유효한 요청이 올 때마다 만료 시각을 다시 60일 뒤로
// 늘려주는 "슬라이딩 만료" 방식이라, 종종 접속하는 한 계속 로그인이 유지된다.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 60;

export function sessionStore() {
  // 세션은 로그인 직후 바로 다음 요청에서 읽히는 게 중요하므로 strong consistency 사용
  return getStore({ name: "sessions", consistency: "strong" });
}

export function usersStore() {
  return getStore({ name: "users", consistency: "strong" });
}

/**
 * Authorization: Bearer <token> 헤더를 읽어 세션을 검증하고, users 스토어에서
 * 최신 닉네임을 함께 조회해 반환한다. 닉네임을 세션에 캐시해두지 않기 때문에
 * 프로필을 수정하면 재로그인 없이 바로 다음 요청부터 반영된다.
 * 유효하지 않으면 null을 반환한다.
 */
export async function requireAuth(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const sessions = sessionStore();
  const session = await sessions.get(token, { type: "json" }) as Session | null;
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    await sessions.delete(token);
    return null;
  }

  const refreshed: Session = { username: session.username, expiresAt: Date.now() + SESSION_TTL_MS };
  await sessions.setJSON(token, refreshed);

  const user = await usersStore().get(session.username, { type: "json" }) as
    | { username: string; displayName: string }
    | null;
  if (!user) return null; // 탈퇴 등으로 사용자가 사라진 경우

  return { username: user.username, displayName: user.displayName };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
