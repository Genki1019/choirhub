import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-client")>()),
  downloadFile: vi.fn(),
}));

import { downloadFile } from "../api-client";
import { auditLogsApi } from "../audit-logs-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auditLogsApi.list", () => {
  it("未指定の条件はクエリに含めない", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { total: 0, page: 1, perPage: 50 } })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await auditLogsApi.list("o", { page: 2, category: "finance", from: undefined });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/o/settings/audit-logs?page=2&category=finance",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("エラー応答ではAPIのエラーメッセージで例外を投げる（HTTP/2でstatusTextが空でも表示できる）", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: "FORBIDDEN", message: "管理者権限が必要です" } }),
            { status: 403, statusText: "" },
          ),
        ),
    );
    await expect(auditLogsApi.list("o", {})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "管理者権限が必要です",
      status: 403,
    });
  });
});

describe("auditLogsApi.exportCsv", () => {
  it("絞り込み条件付きでCSVをダウンロードする", async () => {
    await auditLogsApi.exportCsv("o", { from: "2026-09-01", actorId: "m-1" });
    expect(downloadFile).toHaveBeenCalledWith(
      "/o/settings/audit-logs/export?from=2026-09-01&actorId=m-1",
    );
  });
});
