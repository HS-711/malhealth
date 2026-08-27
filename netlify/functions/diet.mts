import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { requireAuth, json } from "./_shared/auth.mts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEALS = ["breakfast", "lunch", "dinner"] as const;
type Meal = (typeof MEALS)[number];

export default async (req: Request) => {
  const store = getStore({ name: "diet", consistency: "strong" });

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
          | { menu: string; memo: string; updatedAt: number }
          | null;
        const [, meal, username] = b.key.split("/");
        return { username, meal: meal as Meal, menu: data?.menu || "", memo: data?.memo || "" };
      })
    );

    return json({ date, records });
  }

  if (req.method === "POST") {
    const session = await requireAuth(req);
    if (!session) return json({ error: "로그인이 필요합니다" }, 401);

    let body: { date?: string; meal?: string; menu?: string; memo?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "잘못된 요청 형식입니다" }, 400);
    }

    const date = body.date || "";
    const meal = (body.meal || "") as Meal;
    if (!DATE_RE.test(date)) {
      return json({ error: "date=YYYY-MM-DD 형식이 필요합니다" }, 400);
    }
    if (!MEALS.includes(meal)) {
      return json({ error: "meal은 breakfast, lunch, dinner 중 하나여야 합니다" }, 400);
    }

    const key = `${date}/${meal}/${session.username}`;
    await store.setJSON(key, {
      menu: (body.menu || "").slice(0, 300),
      memo: (body.memo || "").slice(0, 300),
      updatedAt: Date.now(),
    });

    return json({ ok: true });
  }

  return json({ error: "허용되지 않은 메서드입니다" }, 405);
};

export const config: Config = { path: "/api/diet" };
