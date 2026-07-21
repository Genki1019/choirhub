import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VisitorApplicationsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { visitorApplicationsApi } from "@/lib/visitor-applications-api";
import { membersApi } from "@/lib/members-api";
import type { VisitorApplication } from "@/lib/api-types";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/visitor-applications-api", () => ({
  visitorApplicationsApi: {
    listPending: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    bulkApprove: vi.fn(),
  },
}));

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    parts: vi.fn(),
  },
}));

function makeApplications(): VisitorApplication[] {
  return [
    {
      id: "app-1",
      name: "見学 太郎",
      partHope: "テノール",
      originGroup: "○○大学",
      contact: null,
      message: null,
      source: "manual",
      status: "pending",
      createdByName: "山田太郎",
      reviewedByName: null,
      reviewedAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    },
    {
      id: "app-2",
      name: "見学 花子",
      partHope: null,
      originGroup: null,
      contact: null,
      message: null,
      source: "google_form",
      status: "pending",
      createdByName: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: "2026-07-20T00:00:00Z",
    },
  ];
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <VisitorApplicationsPage />
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
  vi.mocked(membersApi.parts).mockResolvedValue([]);
  stubClipboard();
  sessionStorage.clear();
});

describe("VisitorApplicationsPage", () => {
  it("admin以外: リダイレクトし何も表示しない", () => {
    renderPage(["member"]);
    expect(replace).toHaveBeenCalledWith("/tokyo-men-choir/members");
    expect(screen.queryByText("見学 太郎")).not.toBeInTheDocument();
  });

  it("admin: 保留中の申込一覧を表示する", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    renderPage();

    expect(await screen.findByText("見学 太郎")).toBeInTheDocument();
    expect(screen.getByText("見学 花子")).toBeInTheDocument();
    expect(screen.getByText("希望パート: テノール")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("申込がない場合は案内文を表示する", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("保留中の見学申込はありません")).toBeInTheDocument();
  });

  it("承認ボタンで該当行が消え、紹介メールの導線が表示される", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockResolvedValue({
      application: { ...makeApplications()[0], status: "approved" },
      draft: { subject: "見学者のご紹介", body: "・見学 太郎さん（希望パート: テノール）" },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);

    await waitFor(() => {
      expect(screen.queryByText("見学 太郎")).not.toBeInTheDocument();
    });
    expect(screen.getByText("承認しました。団員へ共有しますか？")).toBeInTheDocument();
  });

  it("却下ボタンで該当行が消える", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.reject).mockResolvedValue({
      ...makeApplications()[0],
      status: "rejected",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("却下")[0]);

    await waitFor(() => {
      expect(screen.queryByText("見学 太郎")).not.toBeInTheDocument();
    });
  });

  it("承認に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);

    expect(
      await screen.findByText("操作に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.getByText("見学 太郎")).toBeInTheDocument();
  });

  it("却下に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.reject).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("却下")[0]);

    expect(
      await screen.findByText("操作に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });

  it("チェックボックスで複数選択し、一括承認できる", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.bulkApprove).mockResolvedValue({
      applications: makeApplications().map((a) => ({ ...a, status: "approved" })),
      draft: {
        subject: "見学者のご紹介",
        body: "・見学 太郎さん\n・見学 花子さん",
      },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    await user.click(screen.getByText("選択した2件を一括承認"));

    await waitFor(() => {
      expect(visitorApplicationsApi.bulkApprove).toHaveBeenCalledWith("tokyo-men-choir", [
        "app-1",
        "app-2",
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByText("見学 太郎")).not.toBeInTheDocument();
      expect(screen.queryByText("見学 花子")).not.toBeInTheDocument();
    });
  });

  it("一括承認に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.bulkApprove).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByText("選択した1件を一括承認"));

    expect(
      await screen.findByText("操作に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.getByText("見学 太郎")).toBeInTheDocument();
  });

  it("テキストをコピーするとクリップボードに整形テキストが入る", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockResolvedValue({
      application: { ...makeApplications()[0], status: "approved" },
      draft: { subject: "見学者のご紹介", body: "・見学 太郎さん（希望パート: テノール）" },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);
    await screen.findByText("承認しました。団員へ共有しますか？");

    await user.click(screen.getByText("テキストをコピーする"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "・見学 太郎さん（希望パート: テノール）",
    );
    expect(await screen.findByText("コピーしました")).toBeInTheDocument();
  });

  it("今すぐ紹介メールを送るボタンでComposeModalが下書き済みで開く", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockResolvedValue({
      application: { ...makeApplications()[0], status: "approved" },
      draft: { subject: "見学者のご紹介", body: "・見学 太郎さん（希望パート: テノール）" },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);
    await screen.findByText("承認しました。団員へ共有しますか？");

    await user.click(screen.getByText("今すぐ紹介メールを送る"));

    expect(await screen.findByDisplayValue("見学者のご紹介")).toBeInTheDocument();
    expect(screen.getByDisplayValue("・見学 太郎さん（希望パート: テノール）")).toBeInTheDocument();
  });

  it("コピーだけして画面を離れても、戻ると案内バナーが残っている（セッション保持）", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockResolvedValue({
      application: { ...makeApplications()[0], status: "approved" },
      draft: { subject: "見学者のご紹介", body: "・見学 太郎さん（希望パート: テノール）" },
    });
    const user = userEvent.setup();
    const { unmount } = renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);
    await screen.findByText("承認しました。団員へ共有しますか？");
    await user.click(screen.getByText("テキストをコピーする"));
    await screen.findByText("コピーしました");

    // 画面遷移相当（コンポーネントのアンマウント→別画面での再マウント）
    unmount();
    renderPage();

    expect(await screen.findByText("承認しました。団員へ共有しますか？")).toBeInTheDocument();

    // 再マウント後も同じ下書き内容が保持されていることを、ComposeModalへの引き継ぎで確認
    await user.click(screen.getByText("今すぐ紹介メールを送る"));
    expect(await screen.findByDisplayValue("見学者のご紹介")).toBeInTheDocument();
    expect(screen.getByDisplayValue("・見学 太郎さん（希望パート: テノール）")).toBeInTheDocument();
  });

  it("案内バナーの「閉じる」を押すと消え、再訪しても復活しない", async () => {
    vi.mocked(visitorApplicationsApi.listPending).mockResolvedValue(makeApplications());
    vi.mocked(visitorApplicationsApi.approve).mockResolvedValue({
      application: { ...makeApplications()[0], status: "approved" },
      draft: { subject: "見学者のご紹介", body: "・見学 太郎さん（希望パート: テノール）" },
    });
    const user = userEvent.setup();
    const { unmount } = renderPage();

    await screen.findByText("見学 太郎");
    await user.click(screen.getAllByText("承認")[0]);
    await screen.findByText("承認しました。団員へ共有しますか？");

    await user.click(screen.getByLabelText("閉じる"));
    expect(screen.queryByText("承認しました。団員へ共有しますか？")).not.toBeInTheDocument();

    unmount();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("承認しました。団員へ共有しますか？")).not.toBeInTheDocument();
    });
  });
});
