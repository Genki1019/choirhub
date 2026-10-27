import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryList } from "../CategoryList";
import { settingsApi, type EventCategory } from "@/lib/settings-api";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      updateEventCategory: vi.fn(),
      deleteEventCategory: vi.fn(),
    },
  };
});

function makeCats(): EventCategory[] {
  return [
    { id: "cat-1", name: "練習", slug: "rehearsal", color: "#10B981", sortOrder: 1 },
    { id: "cat-2", name: "合宿", slug: null, color: "#F97316", sortOrder: 2 },
  ];
}

function renderList(canEdit: boolean, overrides: Partial<Record<string, unknown>> = {}) {
  return render(
    <CategoryList
      categories={makeCats()}
      org="o"
      canEdit={canEdit}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      onReordered={vi.fn()}
      onError={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPointerCapture();
});

describe("CategoryList（canEdit: true）", () => {
  it("標準区分（slugあり）は削除ボタンを表示しない", () => {
    renderList(true);

    expect(screen.queryByLabelText("練習を削除")).not.toBeInTheDocument();
    expect(screen.getByLabelText("合宿を削除")).toBeInTheDocument();
  });

  it("標準区分も編集ボタンは表示される", () => {
    renderList(true);
    expect(screen.getByLabelText("練習を編集")).toBeInTheDocument();
  });

  it("編集して保存するとupdateEventCategoryが呼ばれる", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockResolvedValue({
      ...makeCats()[1],
      name: "合宿改",
    });
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderList(true, { onUpdated });

    await user.click(screen.getByLabelText("合宿を編集"));
    const input = screen.getByDisplayValue("合宿");
    await user.clear(input);
    await user.type(input, "合宿改");
    await user.click(screen.getByRole("button", { name: "区分を保存" }));

    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", {
      name: "合宿改",
      color: "#F97316",
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it("区分名で Enter を押すと保存し、Esc では保存せずに閉じて鉛筆にフォーカスを戻す", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockResolvedValue({
      ...makeCats()[1],
      name: "合宿2",
    });
    const user = userEvent.setup();
    renderList(true);

    await user.click(screen.getByLabelText("合宿を編集"));
    await user.type(screen.getByRole("textbox", { name: "区分名" }), "X{Escape}");
    expect(settingsApi.updateEventCategory).not.toHaveBeenCalled();
    expect(screen.getByLabelText("合宿を編集")).toHaveFocus();

    await user.click(screen.getByLabelText("合宿を編集"));
    await user.type(screen.getByRole("textbox", { name: "区分名" }), "2{Enter}");
    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", {
      name: "合宿2",
      color: "#F97316",
    });
  });

  it("色の入力欄でも Enter で保存し、Esc で閉じる", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockResolvedValue({
      ...makeCats()[1],
      color: "#000000",
    });
    const user = userEvent.setup();
    renderList(true);

    await user.click(screen.getByLabelText("合宿を編集"));
    fireEvent.input(screen.getByLabelText("区分の色"), { target: { value: "#000000" } });
    screen.getByLabelText("区分の色").focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("区分の色")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("合宿を編集"));
    fireEvent.input(screen.getByLabelText("区分の色"), { target: { value: "#000000" } });
    screen.getByLabelText("区分の色").focus();
    await user.keyboard("{Enter}");
    expect(settingsApi.updateEventCategory).toHaveBeenCalledTimes(1);
    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", {
      name: "合宿",
      color: "#000000",
    });
  });

  it("削除するとdeleteEventCategoryが呼ばれonDeletedが呼ばれる", async () => {
    vi.mocked(settingsApi.deleteEventCategory).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderList(true, { onDeleted });

    await user.click(screen.getByLabelText("合宿を削除"));
    expect(settingsApi.deleteEventCategory).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("alertdialog", { name: "予定の区分を削除しますか？" })).getByRole(
        "button",
        {
          name: "削除する",
        },
      ),
    );

    expect(settingsApi.deleteEventCategory).toHaveBeenCalledWith("o", "cat-2");
    expect(onDeleted).toHaveBeenCalledWith("cat-2");
  });

  it("削除を確認でキャンセルするとdeleteEventCategoryを呼ばない", async () => {
    const user = userEvent.setup();
    renderList(true);

    await user.click(screen.getByLabelText("合宿を削除"));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(settingsApi.deleteEventCategory).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("CategoryList（canEdit: false）", () => {
  it("並び替え・編集・削除ボタンを一切表示しない", () => {
    renderList(false);

    expect(screen.queryByLabelText("合宿をドラッグして並び替え")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("練習を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("合宿を削除")).not.toBeInTheDocument();
    expect(screen.getByText("練習")).toBeInTheDocument();
  });
});

// dnd-kitのドラッグ操作はjsdom上でpointer capture状態が後続テストのクリックに干渉するため、
// D&D関連のテストはファイル末尾にまとめる（FormationEditor.test.tsxと同じ方針）
describe("CategoryList（並び替え）", () => {
  it("ドラッグで並び替えるとupdateEventCategoryが変更された2件だけ呼ばれる", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockResolvedValue(makeCats()[0]);
    renderList(true);

    dragAndDrop(
      screen.getByLabelText("合宿をドラッグして並び替え"),
      screen.getByLabelText("練習をドラッグして並び替え"),
    );

    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", { sortOrder: 1 });
    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-1", { sortOrder: 2 });
  });

  it("並び替えに失敗したら元の順序にロールバックしonErrorを呼ぶ", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockRejectedValue(new Error("network error"));
    const onError = vi.fn();
    renderList(true, { onError });

    dragAndDrop(
      screen.getByLabelText("合宿をドラッグして並び替え"),
      screen.getByLabelText("練習をドラッグして並び替え"),
    );

    await vi.waitFor(() => {
      expect(onError).toHaveBeenLastCalledWith("並び替えに失敗しました。もう一度お試しください。");
    });
  });
});
