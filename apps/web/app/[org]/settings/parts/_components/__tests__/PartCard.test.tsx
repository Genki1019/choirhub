import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartCard } from "../PartCard";
import { settingsApi } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import type { PartSummary } from "@/lib/api-types";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

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

function renderCard(canEdit: boolean, overrides: Partial<Record<string, unknown>> = {}) {
  return render(
    <PartCard
      parts={makeParts()}
      org="o"
      canEdit={canEdit}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      onCreated={vi.fn()}
      onReordered={vi.fn()}
      onToast={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPointerCapture();
});

describe("PartCard（canEdit: true）", () => {
  it("「追加」クリックで入力欄が展開しaddPartでcreatePartが呼ばれる", async () => {
    vi.mocked(settingsApi.createPart).mockResolvedValue({
      id: "part-3",
      name: "バリトン",
      voiceType: "other",
      sortOrder: 3,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderCard(true, { onCreated });

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("パート名を入力"), "バリトン");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(settingsApi.createPart).toHaveBeenCalledWith("o", { name: "バリトン" });
    expect(onCreated).toHaveBeenCalledWith({
      id: "part-3",
      name: "バリトン",
      voiceType: "other",
      sortOrder: 3,
    });
  });

  it("✏️クリックでインライン編集になり保存でupdatePartが呼ばれる", async () => {
    const updated = {
      id: "part-1",
      name: "テノール1改",
      voiceType: "tenor1",
      sortOrder: 1,
    };
    vi.mocked(settingsApi.updatePart).mockResolvedValue(updated);
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderCard(true, { onUpdated });

    await user.click(screen.getByLabelText("テノール1を編集"));
    const input = screen.getByDisplayValue("テノール1");
    await user.clear(input);
    await user.type(input, "テノール1改");
    await user.click(screen.getByLabelText("保存"));

    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-1", { name: "テノール1改" });
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("🗑️クリックで削除し409エラー時は専用メッセージをトーストする", async () => {
    vi.mocked(settingsApi.deletePart).mockRejectedValue(
      new ApiClientError("CONFLICT", "conflict", 409),
    );
    const onToast = vi.fn();
    const user = userEvent.setup();
    renderCard(true, { onToast });

    await user.click(screen.getByLabelText("テノール1を削除"));

    expect(onToast).toHaveBeenCalledWith("在団メンバーが所属しているため削除できません");
  });

  it("🗑️クリックで削除に成功するとonDeletedが呼ばれる", async () => {
    vi.mocked(settingsApi.deletePart).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderCard(true, { onDeleted });

    await user.click(screen.getByLabelText("テノール1を削除"));

    expect(settingsApi.deletePart).toHaveBeenCalledWith("o", "part-1");
    expect(onDeleted).toHaveBeenCalledWith("part-1");
  });
});

describe("PartCard（canEdit: false）", () => {
  it("追加ボタン・並び替え・編集・削除ボタンを一切表示しない", () => {
    renderCard(false);

    expect(screen.queryByText("追加")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1をドラッグして並び替え")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("テノール1を削除")).not.toBeInTheDocument();
    expect(screen.getByText("テノール1")).toBeInTheDocument();
  });
});

// dnd-kitのドラッグ操作はjsdom上でpointer capture状態が後続テストのクリックに干渉するため、
// D&D関連のテストはファイル末尾にまとめる（FormationEditor.test.tsxと同じ方針）
describe("PartCard（並び替え）", () => {
  it("ドラッグで並び替えるとupdatePartが変更された2件だけ呼ばれる", async () => {
    vi.mocked(settingsApi.updatePart).mockResolvedValue(makeParts()[0]);
    const onReordered = vi.fn();
    renderCard(true, { onReordered });

    dragAndDrop(
      screen.getByLabelText("ベースをドラッグして並び替え"),
      screen.getByLabelText("テノール1をドラッグして並び替え"),
    );

    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-2", { sortOrder: 1 });
    expect(settingsApi.updatePart).toHaveBeenCalledWith("o", "part-1", { sortOrder: 2 });
    expect(onReordered).toHaveBeenCalledWith([
      { id: "part-2", name: "ベース", voiceType: "bass", sortOrder: 1 },
      { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 2 },
    ]);
  });

  it("並び替えに失敗したら元の順序にロールバックしトーストする", async () => {
    vi.mocked(settingsApi.updatePart).mockRejectedValue(new Error("network error"));
    const onToast = vi.fn();
    const onReordered = vi.fn();
    renderCard(true, { onToast, onReordered });

    dragAndDrop(
      screen.getByLabelText("ベースをドラッグして並び替え"),
      screen.getByLabelText("テノール1をドラッグして並び替え"),
    );

    await vi.waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("並び替えに失敗しました");
    });
    expect(onReordered).toHaveBeenLastCalledWith(makeParts());
  });
});
