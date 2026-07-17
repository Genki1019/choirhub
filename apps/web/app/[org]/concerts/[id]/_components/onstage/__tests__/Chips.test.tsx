import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartColorLegend, SeatContainer, GridCell, ReadOnlyChip } from "../Chips";
import type { PartColor, SlotItem } from "../types";

const tenorColor: PartColor = { bg: "bg-blue-50", border: "border-blue-200" };
const bassColor: PartColor = { bg: "bg-purple-50", border: "border-purple-200" };
const partColorMap = new Map<string, PartColor>([
  ["テノール1", tenorColor],
  ["ベース", bassColor],
]);

function makeItem(overrides: Partial<SlotItem> = {}): SlotItem {
  return {
    key: "i:a",
    memberId: "m1",
    label: null,
    name: "山田太郎",
    partName: "テノール1",
    ...overrides,
  };
}

describe("PartColorLegend", () => {
  it("0件の場合は何も表示しない", () => {
    const { container } = render(<PartColorLegend partColorMap={new Map()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("パート名を表示する", () => {
    render(<PartColorLegend partColorMap={partColorMap} />);
    expect(screen.getByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("ベース")).toBeInTheDocument();
  });
});

describe("SeatContainer", () => {
  it("0件でplaceholderが指定されている場合はplaceholderを表示する", () => {
    render(<SeatContainer id="box-1" items={[]} placeholder="ドラッグして配置" />);
    expect(screen.getByText("ドラッグして配置")).toBeInTheDocument();
  });

  it("アイテムのラベル・フルネームを表示する", () => {
    render(<SeatContainer id="box-1" items={[makeItem()]} partColorMap={partColorMap} />);
    expect(screen.getByTitle("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("山田")).toBeInTheDocument();
  });

  it("onTapRemoveが設定されている場合はチップクリックで呼ばれる", async () => {
    const onTapRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <SeatContainer
        id="box-1"
        items={[makeItem()]}
        partColorMap={partColorMap}
        chipProps={() => ({ onTapRemove })}
      />,
    );

    await user.click(screen.getByTitle("山田太郎（クリックで未配置に戻す）"));
    expect(onTapRemove).toHaveBeenCalled();
  });

  it("onEdit・onRemoveが設定されている場合は各ボタンクリックで呼ばれる", async () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <SeatContainer
        id="box-1"
        items={[makeItem()]}
        partColorMap={partColorMap}
        chipProps={() => ({ onEdit, onRemove })}
      />,
    );

    await user.click(screen.getByTitle("表示名を編集"));
    expect(onEdit).toHaveBeenCalled();
    await user.click(screen.getByTitle("削除"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("GridCell", () => {
  it("itemが無い場合は空のマスを表示する", () => {
    const { container } = render(<GridCell row="r1" col={1} item={undefined} />);
    expect(container.querySelector(".border-dashed")).toBeInTheDocument();
  });

  it("itemがある場合はチップを表示し、onTapRemove・onEditが動作する", async () => {
    const onTapRemove = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <GridCell
        row="r1"
        col={1}
        item={makeItem()}
        partColorMap={partColorMap}
        onTapRemove={onTapRemove}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByTitle("表示名を編集"));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ key: "i:a" }), expect.anything());

    await user.click(screen.getByTitle("山田太郎（クリックで未配置に戻す）"));
    expect(onTapRemove).toHaveBeenCalledWith(expect.objectContaining({ key: "i:a" }));
  });
});

describe("ReadOnlyChip", () => {
  it("ラベル・title(fullName)を表示する", () => {
    render(<ReadOnlyChip item={makeItem()} colorClass={tenorColor} />);
    expect(screen.getByTitle("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("山田")).toBeInTheDocument();
  });

  it("labelが設定されている場合はlabelを表示する", () => {
    render(<ReadOnlyChip item={makeItem({ label: "ヤマ" })} />);
    expect(screen.getByText("ヤマ")).toBeInTheDocument();
  });
});
