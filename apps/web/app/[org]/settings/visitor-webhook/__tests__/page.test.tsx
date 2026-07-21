import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VisitorWebhookPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      getVisitorWebhookToken: vi.fn(),
      regenerateVisitorWebhookToken: vi.fn(),
      // このページはIntroTemplateCardも描画するため、そちらが呼ぶAPIもモックしておく（既定値はbeforeEachで設定）
      getVisitorIntroTemplate: vi.fn(),
      updateVisitorIntroTemplate: vi.fn(),
    },
  };
});

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <VisitorWebhookPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

function stubClipboard() {
  if (navigator.clipboard) {
    return vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  }
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

beforeEach(() => {
  vi.resetAllMocks();
  stubClipboard();
  vi.mocked(settingsApi.getVisitorIntroTemplate).mockResolvedValue({
    subjectTemplate: "見学者のご紹介",
    bodyTemplate: "以下の方が見学にいらっしゃいます。\n\n{lines}",
    lineTemplate: "・{name}さん（希望パート: {part}[ / 出身団体: {origin}]）",
  });
});

describe("VisitorWebhookPage", () => {
  it("未発行の場合は「発行する」ボタンを表示する", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: null });
    renderPage();

    expect(await screen.findByText("発行する")).toBeInTheDocument();
    expect(screen.getByDisplayValue("未発行")).toBeInTheDocument();
  });

  it("発行済みの場合はtokenと「再発行する」ボタンを表示する", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "abc-123" });
    renderPage();

    expect(await screen.findByDisplayValue("abc-123")).toBeInTheDocument();
    expect(screen.getByText("再発行する")).toBeInTheDocument();
  });

  it("発行ボタンクリックで新しいtokenを取得し画面に反映する", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: null });
    vi.mocked(settingsApi.regenerateVisitorWebhookToken).mockResolvedValue({ token: "new-token" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("発行する");
    await user.click(screen.getByText("発行する"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("new-token")).toBeInTheDocument();
    });
  });

  it("発行に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: null });
    vi.mocked(settingsApi.regenerateVisitorWebhookToken).mockRejectedValue(
      new Error("network error"),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("発行する");
    await user.click(screen.getByText("発行する"));

    expect(
      await screen.findByText("トークンの発行に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });

  it("Webhook URLをコピーできる", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "abc-123" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("abc-123");
    await user.click(screen.getByLabelText("Webhook URLをコピー"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/public/visitor-applications"),
    );
  });
});
