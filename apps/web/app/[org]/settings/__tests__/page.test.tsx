import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { settingsApi, type OrgSettings } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      get: vi.fn(),
      update: vi.fn(),
    },
  };
});

function makeSettings(overrides: Partial<OrgSettings> = {}): OrgSettings {
  return {
    id: "org-1",
    name: "東京男声合唱団",
    slug: "tokyo-men-choir",
    ...overrides,
  };
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <SettingsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SettingsPage（表示）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(settingsApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(settingsApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("団体名・スラッグを表示する", async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(makeSettings());
    renderPage();

    expect(await screen.findByDisplayValue("東京男声合唱団")).toBeInTheDocument();
    expect(screen.getByDisplayValue("tokyo-men-choir")).toBeInTheDocument();
  });
});

describe("SettingsPage（危険な操作セクション）", () => {
  it("adminの場合は「危険な操作」セクションを表示する", async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(makeSettings());
    renderPage(["admin"]);

    expect(await screen.findByText("危険な操作")).toBeInTheDocument();
    expect(screen.getByText("削除")).toBeDisabled();
  });

  it("finance（admin以外）の場合は「危険な操作」セクションを表示しない", async () => {
    vi.mocked(settingsApi.get).mockResolvedValue(makeSettings());
    renderPage(["finance"]);

    await screen.findByDisplayValue("東京男声合唱団");
    expect(screen.queryByText("危険な操作")).not.toBeInTheDocument();
  });
});
