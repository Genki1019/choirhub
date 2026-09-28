import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-client")>()),
  downloadFile: vi.fn(),
}));

import { downloadFile } from "../api-client";
import { accountingApi } from "../accounting-api";

beforeEach(() => {
  vi.mocked(downloadFile).mockReset();
});

describe("accountingApi（CSVエクスポート）", () => {
  it("exportExpenses: 年度付きで支出CSVをダウンロードする", async () => {
    await accountingApi.exportExpenses("o", 2025);
    expect(downloadFile).toHaveBeenCalledWith("/o/finance/expenses/export?year=2025");
  });

  it("exportCollections: 年度付きで徴収一覧CSVをダウンロードする", async () => {
    await accountingApi.exportCollections("o", 2025);
    expect(downloadFile).toHaveBeenCalledWith("/o/finance/collections/export?year=2025");
  });

  it("exportPayments: 年度付きで支払い状況CSVをダウンロードする", async () => {
    await accountingApi.exportPayments("o", 2025);
    expect(downloadFile).toHaveBeenCalledWith("/o/finance/payments/export?year=2025");
  });
});
