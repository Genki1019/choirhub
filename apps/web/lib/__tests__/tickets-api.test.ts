import { describe, it, expect, vi } from "vitest";

vi.mock("../api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api-client")>()),
  downloadFile: vi.fn(),
}));

import { downloadFile } from "../api-client";
import { ticketsApi } from "../tickets-api";

describe("ticketsApi.exportCsv", () => {
  it("演奏会の配券・販売実績CSVをダウンロードする", async () => {
    await ticketsApi.exportCsv("o", "concert-1");
    expect(downloadFile).toHaveBeenCalledWith("/o/tickets/concert-1/export");
  });
});
