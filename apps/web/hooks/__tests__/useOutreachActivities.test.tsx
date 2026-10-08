import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOutreachActivities } from "../useOutreachActivities";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return { ...actual, ticketsApi: { listOutreachActivities: vi.fn() } };
});

function makeActivity(overrides: Partial<OutreachActivityRow> = {}): OutreachActivityRow {
  return {
    id: "a1",
    concertId: "c1",
    destination: "渋谷駅前",
    activityDate: "2026-05-10",
    note: null,
    status: "pending",
    paidAt: null,
    createdById: "m1",
    creatorName: "田中太郎",
    createdAt: "2026-05-10T00:00:00+09:00",
    participants: [],
    ...overrides,
  };
}

function listOf(activities: OutreachActivityRow[]) {
  return { concert: { id: "c1", title: "第20回定期演奏会" }, activities };
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useOutreachActivities("o", "c1"), { wrapper }) };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useOutreachActivities", () => {
  it("演奏会名と一覧を返す", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue(listOf([makeActivity()]));
    const { result } = setup();

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.concert.title).toBe("第20回定期演奏会");
    expect(result.current.data?.activities).toHaveLength(1);
  });

  it("追加・更新・削除をキャッシュに反映する", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValue(listOf([makeActivity()]));
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.updateActivity(makeActivity({ status: "paid" })));
    await waitFor(() => expect(result.current.data?.activities[0].status).toBe("paid"));

    act(() => result.current.addActivity(makeActivity({ id: "a2" })));
    await waitFor(() =>
      expect(result.current.data?.activities.map((a) => a.id)).toEqual(["a2", "a1"]),
    );

    act(() => result.current.removeActivity("a1"));
    await waitFor(() => expect(result.current.data?.activities.map((a) => a.id)).toEqual(["a2"]));
    expect(result.current.data?.concert.title).toBe("第20回定期演奏会");
  });

  it("取り直しの途中で書き換えたら、古い応答で上書きしないよう取り直し直す", async () => {
    vi.mocked(ticketsApi.listOutreachActivities).mockResolvedValueOnce(listOf([makeActivity()]));
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.data).toBeDefined());

    let resolveStale: (v: ReturnType<typeof listOf>) => void = () => {};
    vi.mocked(ticketsApi.listOutreachActivities)
      .mockReturnValueOnce(new Promise((r) => (resolveStale = r)))
      .mockResolvedValueOnce(listOf([makeActivity({ status: "paid" })]));
    act(() => {
      void queryClient.invalidateQueries();
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(1));

    act(() => result.current.updateActivity(makeActivity({ status: "paid" })));
    resolveStale(listOf([makeActivity({ status: "pending" })]));

    await waitFor(() => expect(ticketsApi.listOutreachActivities).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(result.current.data?.activities[0].status).toBe("paid");
  });
});
