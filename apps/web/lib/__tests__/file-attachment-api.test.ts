import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadAttachment } from "../file-attachment-api";
import { userErrorMessage } from "../api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

const params = {
  presignPath: "/o/concerts/c1/files/presign",
  confirmPath: "/o/concerts/c1/files/confirm",
  fallbackPath: "/o/concerts/c1/files",
  file: new File(["%PDF"], "a.pdf", { type: "application/pdf" }),
};

describe("uploadAttachment", () => {
  it("ストレージへの送信が失敗したら、内部のサービス名を出さない利用者向けの文言で失敗する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              presignedUrl: "https://storage.example/put",
              key: "k",
              contentType: "application/pdf",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const err = await uploadAttachment(params).catch((e: unknown) => e);

    expect(userErrorMessage(err, "fallback")).toBe(
      "ファイルを送信できませんでした。もう一度お試しください。",
    );
    expect(String(userErrorMessage(err, "fallback"))).not.toContain("R2");
  });
});
