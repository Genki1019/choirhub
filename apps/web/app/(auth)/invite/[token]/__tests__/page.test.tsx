import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import InviteAcceptPage from "../page";
import { authApi } from "@/lib/auth-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "test-token" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-api")>("@/lib/auth-api");
  return {
    ...actual,
    authApi: {
      getInvite: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InviteAcceptPage", () => {
  it("招待情報の取得中はローディングスピナーを表示する", () => {
    vi.mocked(authApi.getInvite).mockReturnValue(new Promise(() => {}));
    const { container } = render(<InviteAcceptPage />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("招待情報の取得に成功したら登録フォームを表示する", async () => {
    vi.mocked(authApi.getInvite).mockResolvedValue({
      email: "user@example.com",
      nameJa: null,
      orgName: "テスト合唱団",
      orgSlug: "test-choir",
      expiresAt: "2026-12-31T00:00:00.000Z",
    });
    render(<InviteAcceptPage />);

    expect(await screen.findByText("テスト合唱団 への参加登録")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("招待情報の取得に失敗したらエラーメッセージを表示する", async () => {
    vi.mocked(authApi.getInvite).mockRejectedValue(new Error("not found"));
    render(<InviteAcceptPage />);

    await waitFor(() => {
      expect(
        screen.getByText("招待リンクが無効または期限切れです。管理者に再発行を依頼してください。"),
      ).toBeInTheDocument();
    });
  });
});
