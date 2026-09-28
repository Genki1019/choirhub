import { describe, it, expect, vi } from "vitest";

vi.mock("../api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-client")>()),
  downloadFile: vi.fn(),
}));

import { downloadFile } from "../api-client";
import { membersApi } from "../members-api";

describe("membersApi.exportCsv", () => {
  it("名簿CSVをダウンロードする", async () => {
    await membersApi.exportCsv("o");
    expect(downloadFile).toHaveBeenCalledWith("/o/members/export");
  });
});
