import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailChangeSection } from "../EmailChangeSection";

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      requestEmailChange: vi.fn(),
    },
  };
});

import { membersApi } from "@/lib/members-api";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EmailChangeSection", () => {
  it("現在のメールアドレスを表示する", () => {
    render(<EmailChangeSection org="tokyo" currentEmail="current@example.com" />);
    expect(screen.getByText("current@example.com")).toBeInTheDocument();
  });

  it("送信すると requestEmailChange が呼ばれ、成功表示に切り替わる", async () => {
    vi.mocked(membersApi.requestEmailChange).mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<EmailChangeSection org="tokyo" currentEmail="current@example.com" />);

    await user.type(screen.getByLabelText("新しいメールアドレス"), "new@example.com");
    await user.click(screen.getByText("確認メールを送信"));

    await waitFor(() => {
      expect(membersApi.requestEmailChange).toHaveBeenCalledWith("tokyo", "new@example.com");
    });
    expect(
      await screen.findByText(/new@example\.com 宛に確認メールを送信しました/),
    ).toBeInTheDocument();
  });

  it("送信に失敗するとエラーメッセージを表示する", async () => {
    vi.mocked(membersApi.requestEmailChange).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    render(<EmailChangeSection org="tokyo" currentEmail="current@example.com" />);

    await user.type(screen.getByLabelText("新しいメールアドレス"), "new@example.com");
    await user.click(screen.getByText("確認メールを送信"));

    expect(
      await screen.findByText("送信に失敗しました。しばらく後でお試しください。"),
    ).toBeInTheDocument();
  });
});
