import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteOrgModal } from "../DeleteOrgModal";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      deleteOrg: vi.fn(),
    },
  };
});

const ORG_NAME = "東京男声合唱団";

function renderModal(onClose = vi.fn()) {
  render(<DeleteOrgModal orgSlug="tokyo-men-choir" orgName={ORG_NAME} onClose={onClose} />);
  return { onClose };
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name = ORG_NAME, password = "password123" } = {},
) {
  await user.type(screen.getByLabelText(/団体名/), name);
  await user.type(screen.getByLabelText("パスワード"), password);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteOrgModal", () => {
  it("ダイアログとして団体名・30日間の猶予・通知メールについて説明する", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "団体を削除しますか？" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent(ORG_NAME);
    expect(dialog).toHaveTextContent("30日後に");
    expect(dialog).toHaveTextContent("削除通知メール");
  });

  it("団体名が一致しない間は削除ボタンを押せない", async () => {
    const user = userEvent.setup();
    renderModal();

    await fillForm(user, { name: "東京男声" });

    expect(screen.getByRole("button", { name: "団体を削除する" })).toBeDisabled();
  });

  it("パスワード未入力の間は削除ボタンを押せない", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/団体名/), ORG_NAME);

    expect(screen.getByRole("button", { name: "団体を削除する" })).toBeDisabled();
  });

  it("団体名とパスワードを入力して削除すると、APIを呼び団体選択画面へ遷移する", async () => {
    vi.mocked(settingsApi.deleteOrg).mockResolvedValue({
      deletedAt: "2026-09-24T00:00:00.000Z",
      purgeScheduledAt: "2026-10-24T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderModal();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "団体を削除する" }));

    expect(settingsApi.deleteOrg).toHaveBeenCalledWith("tokyo-men-choir", {
      confirmName: ORG_NAME,
      password: "password123",
    });
    expect(replace).toHaveBeenCalledWith("/select-org");
  });

  it("パスワードが違う場合はエラーを表示し、画面遷移しない", async () => {
    vi.mocked(settingsApi.deleteOrg).mockRejectedValue(
      new ApiClientError("INVALID_PASSWORD", "パスワードが正しくありません", 403),
    );
    const user = userEvent.setup();
    renderModal();

    await fillForm(user, { password: "wrong" });
    await user.click(screen.getByRole("button", { name: "団体を削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("パスワードが正しくありません");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "団体を削除する" })).toBeEnabled();
  });

  it("団体名不一致（400）・レート制限（429）などクライアント起因のエラーはサーバーのメッセージを表示する", async () => {
    vi.mocked(settingsApi.deleteOrg).mockRejectedValue(
      new ApiClientError("TOO_MANY_REQUESTS", "しばらく時間をおいてから再試行してください", 429),
    );
    const user = userEvent.setup();
    renderModal();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "団体を削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "しばらく時間をおいてから再試行してください",
    );
  });

  it("サーバーエラー（5xx）や通信失敗時は汎用メッセージを表示する", async () => {
    vi.mocked(settingsApi.deleteOrg).mockRejectedValue(
      new ApiClientError("INTERNAL_ERROR", "Internal Server Error", 500),
    );
    const user = userEvent.setup();
    renderModal();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "団体を削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "削除に失敗しました。もう一度お試しください。",
    );
  });

  it("キャンセルボタン・Escキーで閉じる", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
