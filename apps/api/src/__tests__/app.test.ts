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
