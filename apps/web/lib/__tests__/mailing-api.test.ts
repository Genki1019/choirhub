import { describe, it, expect, vi, afterEach } from "vitest";
import { mailingApi } from "../mailing-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mailingApi.list", () => {
  it("ページなどの条件をクエリに含めて取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { total: 0, page: 2, perPage: 20 } })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await mailingApi.list("o", { page: 2, perPage: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/o/mailing?page=2&perPage=20",
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

    await expect(mailingApi.list("o", {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "pageは正の整数で指定してください",
      status: 400,
    });
  });
});
