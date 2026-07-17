import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryList } from "../CategoryList";
import { settingsApi, type EventCategory } from "@/lib/settings-api";

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

  it("↑↓で表示順を入れ替えるとupdateEventCategoryが2件呼ばれる", async () => {
    vi.mocked(settingsApi.updateEventCategory).mockResolvedValue(makeCats()[0]);
    const user = userEvent.setup();
    renderList(true);

    await user.click(screen.getByLabelText("合宿を上に移動"));

    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", { sortOrder: 1 });
    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-1", { sortOrder: 2 });
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
    await user.click(screen.getByLabelText("保存"));

    expect(settingsApi.updateEventCategory).toHaveBeenCalledWith("o", "cat-2", {
      name: "合宿改",
      color: "#F97316",
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it("削除するとdeleteEventCategoryが呼ばれonDeletedが呼ばれる", async () => {
    vi.mocked(settingsApi.deleteEventCategory).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderList(true, { onDeleted });

    await user.click(screen.getByLabelText("合宿を削除"));

    expect(settingsApi.deleteEventCategory).toHaveBeenCalledWith("o", "cat-2");
    expect(onDeleted).toHaveBeenCalledWith("cat-2");
  });
});

describe("CategoryList（canEdit: false）", () => {
  it("並び替え・編集・削除ボタンを一切表示しない", () => {
    renderList(false);

    expect(screen.queryByLabelText("合宿を上に移動")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("練習を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("合宿を削除")).not.toBeInTheDocument();
    expect(screen.getByText("練習")).toBeInTheDocument();
  });
});
