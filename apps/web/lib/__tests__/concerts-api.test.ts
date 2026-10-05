import { describe, it, expect, vi } from "vitest";

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, put: vi.fn() } };
});

import { apiClient } from "../api-client";
import { concertsApi } from "../concerts-api";

describe("concertsApi.respondSurvey", () => {
  it("メモを消すときはmemo: nullを送る", async () => {
    await concertsApi.respondSurvey("o", "c1", "s1", [], null);

    expect(apiClient.put).toHaveBeenCalledWith("/o/concerts/c1/surveys/s1/respond", {
      responses: [],
      memo: null,
      targetMemberId: undefined,
    });
  });
});
