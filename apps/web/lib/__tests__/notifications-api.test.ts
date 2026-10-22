import { describe, it, expect, vi, afterEach } from "vitest";
import { notificationsApi } from "../notifications-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notificationsApi.list", () => {
  it("ページなどの条件をクエリに含めて取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { total: 0, page: 2, perPage: 20 } })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await notificationsApi.list("o", { page: 2, status: "unread" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/o/notifications?page=2&status=unread",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("エラー応答ではAPIのエラーメッセージで例外を投げる（HTTP/2でstatusTextが空でも表示できる）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "VALIDATION_ERROR", message: "pageは正の整数で指定してください" },
          }),
          { status: 400, statusText: "" },
        ),
      ),
    );

    await expect(notificationsApi.list("o", {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "pageは正の整数で指定してください",
      status: 400,
    });
  });
});
