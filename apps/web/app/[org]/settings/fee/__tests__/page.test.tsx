import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FeeSettingsPage from "../page";
import { settingsApi, type FeeSettings } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      getFee: vi.fn(),
      updateFee: vi.fn(),
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeeSettingsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("FeeSettingsPage", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(settingsApi.getFee).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得した徴収方法・金額を表示する", async () => {
    const feeData: FeeSettings = { feeType: "monthly", defaultFeeAmount: 3000 };
    vi.mocked(settingsApi.getFee).mockResolvedValue(feeData);
    renderPage();

    expect(await screen.findByDisplayValue("3000")).toBeInTheDocument();
    expect(screen.getByLabelText(/^月額制/)).toBeChecked();
  });

  it("未取得時はデフォルト値（練習ごと・空欄）で表示する", async () => {
    vi.mocked(settingsApi.getFee).mockResolvedValue({
      feeType: "per_rehearsal",
      defaultFeeAmount: null,
    });
    renderPage();

    await screen.findByText("会費の徴収方法");
    expect(screen.getByLabelText(/^練習ごとの場所代/)).toBeChecked();
  });
});
