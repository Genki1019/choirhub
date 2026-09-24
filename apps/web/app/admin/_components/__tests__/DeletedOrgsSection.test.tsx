import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeletedOrgsSection } from "../DeletedOrgsSection";
import { deletedOrgsApi, type DeletedOrg } from "@/lib/deleted-orgs-api";

vi.mock("@/lib/deleted-orgs-api", () => ({
  deletedOrgsApi: { list: vi.fn(), restore: vi.fn() },
}));

const deletedOrg: DeletedOrg = {
  id: "org-1",
  name: "東京男声合唱団",
  slug: "tokyo-men-choir",
  deletedAt: "2026-09-10T00:00:00.000Z",
  deletedByEmail: "admin@example.com",
  purgeScheduledAt: "2026-10-10T00:00:00.000Z",
};

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeletedOrgsSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DeletedOrgsSection", () => {
  it("削除済み団体がない場合は空状態を表示する", async () => {
    vi.mocked(deletedOrgsApi.list).mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText("削除済みの団体はありません")).toBeInTheDocument();
  });

  it("削除日・削除者・完全削除予定日と残り日数を表示する", async () => {
    vi.mocked(deletedOrgsApi.list).mockResolvedValue([deletedOrg]);
    renderSection();

    expect(await screen.findByText("東京男声合唱団")).toBeInTheDocument();
    expect(screen.getByText(/admin@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/完全削除予定: 2026\/10\/10（残り16日）/)).toBeInTheDocument();
  });

  it("復元ボタンでAPIを呼び、一覧から取り除く", async () => {
    vi.mocked(deletedOrgsApi.list).mockResolvedValue([deletedOrg]);
    vi.mocked(deletedOrgsApi.restore).mockResolvedValue({
      id: "org-1",
      name: "東京男声合唱団",
      slug: "tokyo-men-choir",
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "東京男声合唱団を復元" }));

    expect(deletedOrgsApi.restore).toHaveBeenCalledWith("org-1");
    expect(await screen.findByText("削除済みの団体はありません")).toBeInTheDocument();
  });

  it("復元に失敗した場合はエラーを表示し、一覧に残す", async () => {
    vi.mocked(deletedOrgsApi.list).mockResolvedValue([deletedOrg]);
    vi.mocked(deletedOrgsApi.restore).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "東京男声合唱団を復元" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("復元に失敗しました");
    expect(screen.getByText("東京男声合唱団")).toBeInTheDocument();
  });

  it("一覧の取得に失敗した場合はエラーを表示する", async () => {
    vi.mocked(deletedOrgsApi.list).mockRejectedValue(new Error("failed"));
    renderSection();

    expect(await screen.findByRole("alert")).toHaveTextContent("削除済み団体の取得に失敗しました");
  });
});
