import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { requireAuth, json } from "./_shared/auth.mts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function scoreStore() {
  return getStore({ name: "dietScore", consistency: "strong" });
}

export default async (req: Request) => {
  const store = scoreStore();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || "";
    if (!DATE_RE.test(date)) {
      return json({ error: "date=YYYY-MM-DD 형식의 파라미터가 필요합니다" }, 400);
    }

    const prefix = `${date}/`;
    const { blobs } = await store.list({ prefix });
    const records = await Promise.all(
      blobs.map(async (b) => {
        const data = await store.get(b.key, { type: "json" }) as
          | { score: number; memo: string; updatedAt: number }
          | null;
        const username = b.key.slice(prefix.length);
        return { username, score: data?.score ?? null, memo: data?.memo || "" };
      })
    );

    return json({ date, records });
  }

  if (req.method === "POST") {
    const session = await requireAuth(req);
    if (!session) return json({ error: "로그인이 필요합니다" }, 401);

    let body: { date?: string; score?: number; memo?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "잘못된 요청 형식입니다" }, 400);
    }

    const date = body.date || "";
    if (!DATE_RE.test(date)) {
      return json({ error: "date=YYYY-MM-DD 형식이 필요합니다" }, 400);
    }

    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return json({ error: "score는 1~5 사이의 정수여야 합니다" }, 400);
    }

    const key = `${date}/${session.username}`;
    await store.setJSON(key, {
      score,
      memo: (body.memo || "").slice(0, 200),
      updatedAt: Date.now(),
    });

    return json({ ok: true });
  }

  return json({ error: "허용되지 않은 메서드입니다" }, 405);
};

export const config: Config = { path: "/api/diet-score" };
