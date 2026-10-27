import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventCategoriesPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { settingsApi, type EventCategory } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      listEventCategories: vi.fn(),
    },
  };
});

function makeCats(): EventCategory[] {
  return [
    { id: "cat-1", name: "練習", slug: "rehearsal", color: "#10B981", sortOrder: 1 },
    { id: "cat-2", name: "合宿", slug: null, color: "#F97316", sortOrder: 2 },
  ];
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <EventCategoriesPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EventCategoriesPage", () => {
  it("区分一覧を表示する", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValue(makeCats());
    renderPage();

    expect(await screen.findByText("練習")).toBeInTheDocument();
    expect(screen.getByText("合宿")).toBeInTheDocument();
    expect(screen.getByText("標準")).toBeInTheDocument();
  });

  it("取得エラーは理由を読み上げ、空の一覧や追加フォームは出さない", async () => {
    vi.mocked(settingsApi.listEventCategories).mockRejectedValue(
      new ApiClientError("UNKNOWN", "", 500),
    );
    renderPage(["admin"]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "区分の読み込みに失敗しました。ページを再読み込みしてください。",
    );
    expect(screen.queryByText("区分を追加")).not.toBeInTheDocument();
  });

  it("取得済みの一覧があるときは、裏の取り直しに失敗しても一覧と追加フォームを残す", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValueOnce(makeCats());
    const { queryClient } = renderPage(["admin"]);
    expect(await screen.findByText("区分を追加")).toBeInTheDocument();

    vi.mocked(settingsApi.listEventCategories).mockRejectedValue(
      new ApiClientError("UNKNOWN", "", 500),
    );
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(queryClient.getQueryCache().getAll()[0].state.status).toBe("error");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("区分を追加")).toBeInTheDocument();
  });

  it("adminの場合は「区分を追加」フォームを表示する", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValue(makeCats());
    renderPage(["admin"]);

    await screen.findByText("練習");
    expect(screen.getByText("区分を追加")).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は「区分を追加」フォームを表示しない", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValue(makeCats());
    renderPage(["finance"]);

    await screen.findByText("練習");
    expect(screen.queryByText("区分を追加")).not.toBeInTheDocument();
  });

  it("finance（admin以外）の場合でも標準区分に関する説明文は表示する", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValue(makeCats());
    renderPage(["finance"]);

    expect(await screen.findByText(/システム標準区分は削除できません/)).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は並び替えの案内文を表示しない", async () => {
    vi.mocked(settingsApi.listEventCategories).mockResolvedValue(makeCats());
    renderPage(["finance"]);

    await screen.findByText("練習");
    expect(screen.queryByText("ドラッグして表示順を変更できます。")).not.toBeInTheDocument();
  });
});
