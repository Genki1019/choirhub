import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClientError, downloadFile } from "../api-client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("downloadFile", () => {
  it("Content-DispositionのUTF-8ファイル名で保存する", async () => {
    fetchMock.mockResolvedValue(
      new Response("a,b", {
        headers: {
          "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent("名簿_20260928.csv")}`,
        },
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadFile("/o/members/export");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/o/members/export"),
      expect.objectContaining({ credentials: "include" }),
    );
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("名簿_20260928.csv");
    expect(anchor.href).toBe("blob:mock");
    expect(anchor.isConnected).toBe(false);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock"));
  });

  it("ファイル名ヘッダーが無い場合は export.csv にする", async () => {
    fetchMock.mockResolvedValue(new Response("a,b"));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadFile("/o/members/export");

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("export.csv");
  });

  it("エラー応答はApiClientErrorとして投げる", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "権限がありません" } }), {
        status: 403,
      }),
    );

    await expect(downloadFile("/o/members/export")).rejects.toEqual(
      new ApiClientError("FORBIDDEN", "権限がありません", 403),
    );
  });
});
