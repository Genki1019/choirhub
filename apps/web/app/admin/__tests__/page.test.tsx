import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "../page";
import { orgApplicationsApi } from "@/lib/org-applications-api";
import { ApiClientError } from "@/lib/auth-api";

vi.mock("@/lib/org-applications-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/org-applications-api")>(
    "@/lib/org-applications-api",
  );
  return {
    ...actual,
    orgApplicationsApi: {
      listPending: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      createDirect: vi.fn(),
    },
  };
});

const testApplication = {
  id: "app-1",
  orgName: "○○混声合唱団",
  slug: "circle-choir",
  templateKey: "mixed4" as const,
  applicantName: "鈴木 花子",
  applicantEmail: "hanako@example.com",
  message: "40名程度の学生団体です",
  status: "pending" as const,
  reviewedByEmail: null,
  reviewedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminPage（表示）", () => {
  it("保留中の申請一覧を表示する（団体名・パート構成・申請者情報・メッセージ）", async () => {
    vi.mocked(orgApplicationsApi.listPending).mockResolvedValue([testApplication]);
    renderPage();

    expect(await screen.findByText("○○混声合唱団")).toBeInTheDocument();
    expect(screen.getByText("パート構成: 混声四部")).toBeInTheDocument();
    expect(screen.getByText("申請者: 鈴木 花子（hanako@example.com）")).toBeInTheDocument();
    expect(screen.getByText("メッセージ: 40名程度の学生団体です")).toBeInTheDocument();
    expect(screen.getByLabelText("スラグ")).toHaveValue("circle-choir");
  });

  it("保留中の申請が0件の場合は空状態を表示する", async () => {
    vi.mocked(orgApplicationsApi.listPending).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("保留中の申請はありません")).toBeInTheDocument();
  });

  it("取得失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.listPending).mockRejectedValue(new Error("network error"));
    renderPage();

    expect(
      await screen.findByText("申請一覧の取得に失敗しました。しばらくしてから再度お試しください。"),
    ).toBeInTheDocument();
  });
});

describe("AdminPage（承認・却下）", () => {
  beforeEach(() => {
    vi.mocked(orgApplicationsApi.listPending).mockResolvedValue([testApplication]);
  });

  it("承認をクリックすると申請時のスラグでapproveが呼ばれ一覧から消える", async () => {
    vi.mocked(orgApplicationsApi.approve).mockResolvedValue({
      ...testApplication,
      status: "approved",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    await user.click(screen.getByLabelText("承認"));

    await waitFor(() => {
      expect(orgApplicationsApi.approve).toHaveBeenCalledWith("app-1", "circle-choir");
    });
    await waitFor(() => {
      expect(screen.queryByText("○○混声合唱団")).not.toBeInTheDocument();
    });
  });

  it("スラグを編集してから承認すると編集後の値でapproveが呼ばれる", async () => {
    vi.mocked(orgApplicationsApi.approve).mockResolvedValue({
      ...testApplication,
      status: "approved",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    const slugInput = screen.getByLabelText("スラグ");
    await user.clear(slugInput);
    await user.type(slugInput, "new-slug");
    await user.click(screen.getByLabelText("承認"));

    await waitFor(() => {
      expect(orgApplicationsApi.approve).toHaveBeenCalledWith("app-1", "new-slug");
    });
  });

  it("スラグを1文字にすると承認ボタンが無効化され、有効な値に戻すと再度押せる", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    const slugInput = screen.getByLabelText("スラグ");
    const approveButton = screen.getByLabelText("承認");
    expect(approveButton).not.toBeDisabled();

    await user.clear(slugInput);
    await user.type(slugInput, "a");
    expect(approveButton).toBeDisabled();

    await user.type(slugInput, "b");
    expect(approveButton).not.toBeDisabled();
  });

  it("承認が400（スラグ形式不正）で失敗した場合は専用メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.approve).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "invalid", 400),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    await user.click(screen.getByLabelText("承認"));

    expect(
      await screen.findByText(
        "スラグの形式が正しくありません（英小文字・数字・ハイフン、2〜50文字）",
      ),
    ).toBeInTheDocument();
  });

  it("承認が409（スラグ重複）で失敗した場合は専用メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.approve).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    await user.click(screen.getByLabelText("承認"));

    expect(await screen.findByText("このスラグはすでに使用されています")).toBeInTheDocument();
  });

  it("却下をクリックするとrejectが呼ばれ一覧から消える", async () => {
    vi.mocked(orgApplicationsApi.reject).mockResolvedValue({
      ...testApplication,
      status: "rejected",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    await user.click(screen.getByLabelText("却下"));

    await waitFor(() => {
      expect(orgApplicationsApi.reject).toHaveBeenCalledWith("app-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("○○混声合唱団")).not.toBeInTheDocument();
    });
  });

  it("操作失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.approve).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("○○混声合唱団");
    await user.click(screen.getByLabelText("承認"));

    expect(
      await screen.findByText("操作に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });
});

describe("AdminPage（団体を作成する）", () => {
  beforeEach(() => {
    vi.mocked(orgApplicationsApi.listPending).mockResolvedValue([]);
  });

  it("「団体を作成する」をクリックするとフォームが表示される", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("保留中の申請はありません");
    await user.click(screen.getByText("団体を作成する"));

    expect(screen.getByLabelText("団体名")).toBeInTheDocument();
    expect(screen.getByText("作成する")).toBeInTheDocument();
  });

  it("[×]ボタンでフォームを閉じられる", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("保留中の申請はありません");
    await user.click(screen.getByText("団体を作成する"));
    expect(screen.getByLabelText("団体名")).toBeInTheDocument();

    await user.click(screen.getByLabelText("作成フォームを閉じる"));
    expect(screen.queryByLabelText("団体名")).not.toBeInTheDocument();
  });

  it("送信するとorgApplicationsApi.createDirectが呼ばれ成功メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.createDirect).mockResolvedValue({
      message: "団体を作成し、招待メールを送信しました",
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("保留中の申請はありません");
    await user.click(screen.getByText("団体を作成する"));

    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.type(screen.getByLabelText("管理者氏名"), "鈴木花子");
    await user.type(screen.getByLabelText("管理者メールアドレス"), "hanako@example.com");
    await user.click(screen.getByText("作成する"));

    expect(orgApplicationsApi.createDirect).toHaveBeenCalledWith(
      expect.objectContaining({ orgName: "My Choir", slug: "my-choir" }),
    );
    expect(await screen.findByText("団体を作成し、招待メールを送信しました。")).toBeInTheDocument();
  });
});
