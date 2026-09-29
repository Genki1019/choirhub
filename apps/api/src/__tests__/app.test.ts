import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {} }));

import { app } from "../app.js";

describe("CORS", () => {
  it("許可オリジンにはCSVのファイル名を読めるようContent-Dispositionを公開する", async () => {
    const res = await app.request("/health", { headers: { Origin: "http://localhost:3000" } });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe("Content-Disposition");
  });

  it("許可されていないオリジンにはCORSヘッダーを返さない", async () => {
    const res = await app.request("/health", { headers: { Origin: "https://evil.example.com" } });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("定期バッチのルーティング", () => {
  it.each(["attendance-due", "notifications-cleanup", "org-purge", "audit-logs-cleanup"])(
    "Vercel Cron と同じ GET で %s のバッチに到達する（テナント認証を通らない）",
    async (name) => {
      process.env.CRON_SECRET = "secret-abc";
      const res = await app.request(`/api/v1/internal/cron/${name}`, {
        headers: { Authorization: "Bearer wrong" },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: { code: "UNAUTHORIZED", message: "許可されていません" },
      });
    },
  );
});
