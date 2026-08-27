import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { requireAuth, json } from "./_shared/auth.mts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 2 * 1024 * 1024; // 클라이언트에서 리사이즈해서 올리므로 2MB면 충분히 여유있는 상한선

function photoStore() {
  return getStore({ name: "photos", consistency: "strong" });
}

export default async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const date = url.searchParams.get("date") || "";
    const username = url.searchParams.get("username") || "";
    if (!DATE_RE.test(date)) {
      return json({ error: "date 파라미터가 필요합니다" }, 400);
    }

    if (!username) {
      // username 없이 date만 주어지면, 그 날짜에 사진을 올린 사용자 목록만 가볍게 반환
      const { blobs } = await photoStore().list({ prefix: `${date}/` });
      const usernames = blobs.map((b) => b.key.slice(`${date}/`.length));
      return json({ date, usernames });
    }

    const buf = await photoStore().get(`${date}/${username}`, { type: "arrayBuffer" });
    if (!buf) return json({ error: "사진이 없습니다" }, 404);

    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=60",
      },
    });
  }

  if (req.method === "POST") {
    const session = await requireAuth(req);
    if (!session) return json({ error: "로그인이 필요합니다" }, 401);

    const date = url.searchParams.get("date") || "";
    if (!DATE_RE.test(date)) {
      return json({ error: "date=YYYY-MM-DD 파라미터가 필요합니다" }, 400);
    }

    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0) {
      return json({ error: "이미지 데이터가 비어있습니다" }, 400);
    }
    if (buf.byteLength > MAX_BYTES) {
      return json({ error: "이미지가 너무 큽니다 (최대 2MB)" }, 413);
    }

    await photoStore().set(`${date}/${session.username}`, buf);
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const session = await requireAuth(req);
    if (!session) return json({ error: "로그인이 필요합니다" }, 401);

    const date = url.searchParams.get("date") || "";
    if (!DATE_RE.test(date)) {
      return json({ error: "date=YYYY-MM-DD 파라미터가 필요합니다" }, 400);
    }

    await photoStore().delete(`${date}/${session.username}`);
    return json({ ok: true });
  }

  return json({ error: "허용되지 않은 메서드입니다" }, 405);
};

export const config: Config = { path: "/api/photo" };
