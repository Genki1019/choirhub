import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartCard } from "../PartCard";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { PartSummary } from "@/lib/api-types";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      createPart: vi.fn(),
      updatePart: vi.fn(),
      deletePart: vi.fn(),
    },
  };
});

function makeParts(): PartSummary[] {
  return [
    { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
    { id: "part-2", name: "ベース", voiceType: "bass", sortOrder: 2 },
  ];
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PartCard（canEdit: true）", () => {
  it("↑↓で表示順を入れ替えるとupdatePartが2件呼ばれる", async () => {
    vi.mocked(settingsApi.updatePart).mockResolvedValue(makeParts()[0]);
    const user = userEvent.setup();
    render(<PartCard initialParts={makeParts()} org="o" canEdit={true} onToast={vi.fn()} />);

    await user.click(screen.getByLabelText("ベースを上に移動"));

    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-2", { sortOrder: 1 });
    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-1", { sortOrder: 2 });
  });

  it("「追加」クリックで入力欄が展開しaddPartでcreatePartが呼ばれる", async () => {
    vi.mocked(settingsApi.createPart).mockResolvedValue({
      id: "part-3",
      name: "バリトン",
      voiceType: "other",
      sortOrder: 3,
    });
    const user = userEvent.setup();
    render(<PartCard initialParts={makeParts()} org="o" canEdit={true} onToast={vi.fn()} />);

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "バリトン");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(settingsApi.createPart).toHaveBeenCalledWith("o", { name: "バリトン" });
    expect(await screen.findByText("バリトン")).toBeInTheDocument();
  });

  it("✏️クリックでインライン編集になり保存でupdatePartが呼ばれる", async () => {
    vi.mocked(settingsApi.updatePart).mockResolvedValue({
      id: "part-1",
      name: "テノール1改",
      voiceType: "tenor1",
      sortOrder: 1,
    });
    const user = userEvent.setup();
    render(<PartCard initialParts={makeParts()} org="o" canEdit={true} onToast={vi.fn()} />);

    await user.click(screen.getByLabelText("テノール1を編集"));
    const input = screen.getByDisplayValue("テノール1");
    await user.clear(input);
    await user.type(input, "テノール1改");
    await user.click(screen.getByLabelText("保存"));

    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-1", { name: "テノール1改" });
    expect(await screen.findByText("テノール1改")).toBeInTheDocument();
  });

  it("🗑️クリックで削除し409エラー時は専用メッセージをトーストする", async () => {
    vi.mocked(settingsApi.deletePart).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const onToast = vi.fn();
    const user = userEvent.setup();
    render(<PartCard initialParts={makeParts()} org="o" canEdit={true} onToast={onToast} />);

    await user.click(screen.getByLabelText("テノール1を削除"));

    expect(onToast).toHaveBeenCalledWith("在団メンバーが所属しているため削除できません");
  });
});

describe("PartCard（canEdit: false）", () => {
  it("追加ボタン・並び替え・編集・削除ボタンを一切表示しない", () => {
    render(<PartCard initialParts={makeParts()} org="o" canEdit={false} onToast={vi.fn()} />);

    expect(screen.queryByText("追加")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1を上に移動")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1を削除")).not.toBeInTheDocument();
    expect(screen.getByText("テノール1")).toBeInTheDocument();
  });
});
