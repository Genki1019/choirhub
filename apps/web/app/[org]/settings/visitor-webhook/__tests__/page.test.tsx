import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VisitorWebhookPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
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

  it("発行済みで「再発行する」を押すと確認を出し、確定で新しいtokenに切り替わる", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "old-token" });
    vi.mocked(settingsApi.regenerateVisitorWebhookToken).mockResolvedValue({ token: "new-token" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("old-token");
    await user.click(screen.getByText("再発行する"));
    expect(settingsApi.regenerateVisitorWebhookToken).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { name: "トークンを再発行しますか？" });
    await user.click(within(dialog).getByRole("button", { name: "再発行する" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("new-token")).toBeInTheDocument();
    });
  });

  it("再発行の確認でキャンセルするとtokenは変わらない", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "old-token" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("old-token");
    await user.click(screen.getByText("再発行する"));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(settingsApi.regenerateVisitorWebhookToken).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("old-token")).toBeInTheDocument();
  });

  it("再発行に失敗したら確認ダイアログの中にエラーを表示する", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "old-token" });
    vi.mocked(settingsApi.regenerateVisitorWebhookToken).mockRejectedValue(
      new Error("network error"),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("old-token");
    await user.click(screen.getByText("再発行する"));
    await user.click(screen.getByRole("button", { name: "再発行する" }));

    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "トークンの発行に失敗しました。もう一度お試しください。",
    );
  });

  it("再発行に失敗したあと確認をキャンセルすると、エラーは画面に残らない", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockResolvedValue({ token: "old-token" });
    vi.mocked(settingsApi.regenerateVisitorWebhookToken).mockRejectedValue(
      new Error("network error"),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("old-token");
    await user.click(screen.getByText("再発行する"));
    await user.click(screen.getByRole("button", { name: "再発行する" }));
    await within(screen.getByRole("alertdialog")).findByRole("alert");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(
      screen.queryByText("トークンの発行に失敗しました。もう一度お試しください。"),
    ).not.toBeInTheDocument();
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

describe("VisitorWebhookPage（トークンの取得失敗）", () => {
  it("取得に失敗したら理由を出し、確認なしで発行できるボタンは出さない", async () => {
    vi.mocked(settingsApi.getVisitorWebhookToken).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "トークンの読み込みに失敗しました。ページを再読み込みしてください。",
    );
    expect(screen.queryByRole("button", { name: /発行する/ })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("未発行")).not.toBeInTheDocument();
  });
});

describe("VisitorWebhookPage（admin 以外）", () => {
  it("会計担当が直接開いても、トークンを取得せず、発行ボタンも出さない", async () => {
    renderPage(["finance"]);

    expect(await screen.findByText("このページにアクセスする権限がありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /発行する/ })).not.toBeInTheDocument();
    expect(settingsApi.getVisitorWebhookToken).not.toHaveBeenCalled();
  });
});
