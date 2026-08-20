import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectOrgPage from "../page";
import { authApi, ApiClientError } from "@/lib/auth-api";
import { orgApplicationsApi } from "@/lib/org-applications-api";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      me: vi.fn(),
      logout: vi.fn(),
    },
  };
});

vi.mock("@/lib/org-applications-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/org-applications-api")>(
    "@/lib/org-applications-api",
  );
  return {
    ...actual,
    orgApplicationsApi: {
      create: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SelectOrgPage（表示）", () => {
  it("団体一覧を表示する（パート名・在団状況・ロールを含む）", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "user@example.com",
        avatarUrl: null,
        isSystemAdmin: false,
      },
      orgs: [
        {
          orgSlug: "choir-a",
          orgName: "男声合唱団A",
          memberId: "member-a",
          roles: ["member", "tech"],
          partName: "Tenor I",
          status: "active",
        },
        {
          orgSlug: "choir-b",
          orgName: "混声合唱団B",
          memberId: "member-b",
          roles: ["member"],
          partName: "Bass",
          status: "offstage",
        },
      ],
    });
    render(<SelectOrgPage />);

    expect(await screen.findByText("男声合唱団A")).toBeInTheDocument();
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("在団")).toBeInTheDocument();
    expect(screen.getByText("技術系")).toBeInTheDocument();

    expect(screen.getByText("混声合唱団B")).toBeInTheDocument();
    expect(screen.getByText("休団")).toBeInTheDocument();
  });

  it("所属団体が0件の場合は空状態を表示する", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "user@example.com",
        avatarUrl: null,
        isSystemAdmin: false,
      },
      orgs: [],
    });
    render(<SelectOrgPage />);

    expect(await screen.findByText("所属している団体がありません")).toBeInTheDocument();
  });

  it("401エラー時はログイン画面へ自動リダイレクトする", async () => {
    vi.mocked(authApi.me).mockRejectedValue(
      new ApiClientError("UNAUTHORIZED", "unauthorized", 401),
    );
    render(<SelectOrgPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  it("401以外のエラー時は0件時とは異なるエラーメッセージを表示する", async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error("network error"));
    render(<SelectOrgPage />);

    expect(
      await screen.findByText("団体情報の取得に失敗しました。しばらくしてから再度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("所属している団体がありません")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("SelectOrgPage（団体選択・ログアウト）", () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "user@example.com",
        avatarUrl: null,
        isSystemAdmin: false,
      },
      orgs: [
        {
          orgSlug: "choir-a",
          orgName: "男声合唱団A",
          memberId: "member-a",
          roles: ["member"],
          partName: null,
          status: "active",
        },
      ],
    });
  });

  it("団体カードをクリックすると/{orgSlug}へ遷移する", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("男声合唱団A"));

    expect(push).toHaveBeenCalledWith("/choir-a");
  });

  it("ログアウトをクリックするとauthApi.logoutが呼ばれ/loginへ遷移する", async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("ログアウト"));

    expect(authApi.logout).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("システム管理者でなければコンソールリンクは表示されない", async () => {
    render(<SelectOrgPage />);
    await screen.findByText("男声合唱団A");

    expect(screen.queryByText("システム管理者コンソール")).not.toBeInTheDocument();
  });
});

describe("SelectOrgPage（システム管理者コンソールリンク）", () => {
  it("システム管理者の場合はコンソールリンクが表示され、クリックで/adminへ遷移する", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "admin@example.com",
        avatarUrl: null,
        isSystemAdmin: true,
      },
      orgs: [],
    });
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    const link = await screen.findByText("システム管理者コンソール");
    await user.click(link);

    expect(push).toHaveBeenCalledWith("/admin");
  });
});

describe("SelectOrgPage（団体作成を申請する）", () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({
      user: {
        id: "u1",
        nameJa: "山田太郎",
        email: "user@example.com",
        avatarUrl: null,
        isSystemAdmin: false,
      },
      orgs: [],
    });
  });

  it("「団体作成を申請する」をクリックすると申請フォームが表示される（氏名・メールはプリフィル）", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("団体作成を申請する"));

    expect(screen.getByLabelText("団体名")).toBeInTheDocument();
    expect(screen.getByLabelText("管理者氏名")).toHaveValue("山田太郎");
    expect(screen.getByLabelText("管理者メールアドレス")).toHaveValue("user@example.com");
  });

  it("[×]ボタンでフォームを閉じられる", async () => {
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("団体作成を申請する"));
    expect(screen.getByLabelText("団体名")).toBeInTheDocument();

    await user.click(screen.getByLabelText("団体作成申請フォームを閉じる"));
    expect(screen.queryByLabelText("団体名")).not.toBeInTheDocument();
  });

  it("申請成功時はorgApplicationsApi.createが呼ばれ確認メッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.create).mockResolvedValue({ message: "送信しました" });
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("団体作成を申請する"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.click(screen.getByText("申請する"));

    await waitFor(() => {
      expect(orgApplicationsApi.create).toHaveBeenCalledWith({
        orgName: "My Choir",
        slug: "my-choir",
        templateKey: "mixed4",
        applicantName: "山田太郎",
        applicantEmail: "user@example.com",
        message: undefined,
      });
    });
    expect(
      await screen.findByText("送信しました。システム管理者の承認をお待ちください。"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("申請エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(orgApplicationsApi.create).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<SelectOrgPage />);

    await user.click(await screen.findByText("団体作成を申請する"));
    await user.type(screen.getByLabelText("団体名"), "My Choir");
    await user.click(screen.getByText("申請する"));

    expect(
      await screen.findByText("送信に失敗しました。しばらくしてから再試行してください"),
    ).toBeInTheDocument();
  });
});
