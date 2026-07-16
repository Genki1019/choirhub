import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditForm } from "../EditForm";
import type { MemberProfile } from "@/lib/api-types";

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: "ヤマダタロウ",
    nameEn: null,
    avatarUrl: null,
    part: null,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
    email: "test@example.com",
    phone: null,
    adminMemo: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  URL.createObjectURL = vi.fn(() => "blob:mock-preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditForm（表示・入力）", () => {
  it("各フィールドが初期値で表示される", () => {
    render(
      <EditForm
        member={makeMember({ nameJa: "山田太郎", job: "エンジニア", phone: "090-1234-5678" })}
        org="tokyo"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("氏名")).toHaveValue("山田太郎");
    expect(screen.getByLabelText("職業")).toHaveValue("エンジニア");
    expect(screen.getByLabelText("電話番号")).toHaveValue("090-1234-5678");
  });

  it("入力すると値が更新される", async () => {
    const user = userEvent.setup();
    render(
      <EditForm member={makeMember({ job: "" })} org="tokyo" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const jobInput = screen.getByLabelText("職業");
    await user.type(jobInput, "デザイナー");
    expect(jobInput).toHaveValue("デザイナー");
  });

  it("ひとことの文字数カウンターが入力に応じて変化する", async () => {
    const user = userEvent.setup();
    render(
      <EditForm member={makeMember({ bio: "" })} org="tokyo" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("0/200")).toBeInTheDocument();
    await user.type(screen.getByLabelText("ひとこと"), "よろしく");
    expect(screen.getByText("4/200")).toBeInTheDocument();
  });
});

describe("EditForm（アバターアップロード）", () => {
  it("ファイル選択でプレビューが即座に切り替わる", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();
    render(<EditForm member={makeMember()} org="tokyo" onSave={vi.fn()} onCancel={vi.fn()} />);

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(screen.getByAltText("preview")).toHaveAttribute("src", "blob:mock-preview");
  });

  it("アップロード成功: fetchが正しいURL・FormDataで呼ばれる", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();
    render(<EditForm member={makeMember()} org="tokyo" onSave={vi.fn()} onCancel={vi.fn()} />);

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/tokyo/members/me/avatar",
        expect.objectContaining({ method: "POST", credentials: "include" }),
      );
    });
    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeInstanceOf(FormData);
  });

  it("アップロード失敗: エラーメッセージを表示し、プレビューが元に戻る", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "アップロードに失敗しました" } }),
    } as Response);
    const user = userEvent.setup();
    render(
      <EditForm
        member={makeMember({ avatarUrl: "https://example.com/original.png" })}
        org="tokyo"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText("アップロードに失敗しました")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByAltText("preview")).toHaveAttribute(
        "src",
        "https://example.com/original.png",
      );
    });
  });

  it("アンマウント時にURL.revokeObjectURLでクリーンアップする", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const { unmount } = render(
      <EditForm member={makeMember()} org="tokyo" onSave={vi.fn()} onCancel={vi.fn()} />,
    );

    const file = new File(["dummy"], "avatar.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview");
  });
});

describe("EditForm（保存・キャンセル）", () => {
  it("保存: onSaveがavatarUrlを含まないペイロードで呼ばれる", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EditForm
        member={makeMember({ nameJa: "山田太郎", job: "エンジニア" })}
        org="tokyo"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByText("保存する"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ nameJa: "山田太郎", job: "エンジニア" }),
      );
    });
    const payload = onSave.mock.calls[0][0];
    expect(payload).not.toHaveProperty("avatarUrl");
  });

  it("保存中はボタンがdisabledになる", async () => {
    let resolveSave: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<EditForm member={makeMember()} org="tokyo" onSave={onSave} onCancel={vi.fn()} />);

    await user.click(screen.getByText("保存する"));
    expect(screen.getByText("保存する").closest("button")).toBeDisabled();

    resolveSave!();
    await waitFor(() => {
      expect(screen.getByText("保存する").closest("button")).toBeEnabled();
    });
  });

  it("キャンセル: onCancelが呼ばれる", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<EditForm member={makeMember()} org="tokyo" onSave={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText("キャンセル"));
    expect(onCancel).toHaveBeenCalled();
  });
});
