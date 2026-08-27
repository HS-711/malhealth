import type { Config } from "@netlify/functions";
import { json, usersStore } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return json({ error: "허용되지 않은 메서드입니다" }, 405);
  }

  const users = usersStore();
  const { blobs } = await users.list();

  const friends = await Promise.all(
    blobs.map(async (b) => {
      const u = await users.get(b.key, { type: "json" }) as
        | { username: string; displayName: string }
        | null;
      return u ? { username: u.username, displayName: u.displayName } : null;
    })
  );

  return json({ friends: friends.filter(Boolean) });
};

export const config: Config = { path: "/api/friends" };
