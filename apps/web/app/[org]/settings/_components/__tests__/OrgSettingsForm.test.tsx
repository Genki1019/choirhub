import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgSettingsForm } from "../OrgSettingsForm";
import { settingsApi } from "@/lib/settings-api";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      update: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OrgSettingsForm（canEdit: true）", () => {
  it("団体名を変更して保存するとsettingsApi.updateが呼ばれ「保存しました」が表示される", async () => {
    vi.mocked(settingsApi.update).mockResolvedValue({
      id: "org-1",
      name: "新団体名",
      slug: "tokyo-men-choir",
    });
    const user = userEvent.setup();
    render(
      <OrgSettingsForm
        orgSlug="tokyo-men-choir"
        initialName="東京男声合唱団"
        initialSlug="tokyo-men-choir"
        canEdit={true}
      />,
    );

    const nameInput = screen.getByDisplayValue("東京男声合唱団");
    await user.clear(nameInput);
    await user.type(nameInput, "新団体名");
    await user.click(screen.getByText("保存する"));

    expect(settingsApi.update).toHaveBeenCalledWith("tokyo-men-choir", { name: "新団体名" });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("保存に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(settingsApi.update).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(
      <OrgSettingsForm
        orgSlug="tokyo-men-choir"
        initialName="東京男声合唱団"
        initialSlug="tokyo-men-choir"
        canEdit={true}
      />,
    );

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
  });

  it("スラッグ欄は常に読み取り専用", () => {
    render(
      <OrgSettingsForm
        orgSlug="tokyo-men-choir"
        initialName="東京男声合唱団"
        initialSlug="tokyo-men-choir"
        canEdit={true}
      />,
    );

    expect(screen.getByDisplayValue("tokyo-men-choir")).toHaveAttribute("readonly");
  });
});

describe("OrgSettingsForm（canEdit: false）", () => {
  it("団体名入力欄が読み取り専用になり「保存する」ボタンが表示されない", () => {
    render(
      <OrgSettingsForm
        orgSlug="tokyo-men-choir"
        initialName="東京男声合唱団"
        initialSlug="tokyo-men-choir"
        canEdit={false}
      />,
    );

    expect(screen.getByDisplayValue("東京男声合唱団")).toHaveAttribute("readonly");
    expect(screen.queryByText("保存する")).not.toBeInTheDocument();
    expect(screen.getByText("団体名の変更には管理者権限が必要です。")).toBeInTheDocument();
  });
});
