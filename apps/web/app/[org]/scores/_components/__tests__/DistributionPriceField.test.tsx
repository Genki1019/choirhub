import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistributionPriceField } from "../DistributionPriceField";

describe("DistributionPriceField", () => {
  it("価格を表示し、編集できる人にだけ鉛筆を出す", () => {
    const { rerender } = render(
      <DistributionPriceField price={1200} canEdit={false} onSave={vi.fn()} />,
    );
    expect(screen.getByText("¥1,200")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "配布価格を編集" })).not.toBeInTheDocument();

    rerender(<DistributionPriceField price={1200} canEdit onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "配布価格を編集" })).toBeInTheDocument();
  });

  it("未設定は、編集できる人には「+ 価格を設定」、それ以外には「未設定」を出す", () => {
    const { rerender } = render(
      <DistributionPriceField price={null} canEdit={false} onSave={vi.fn()} />,
    );
    expect(screen.getByText("未設定")).toBeInTheDocument();

    rerender(<DistributionPriceField price={null} canEdit onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "+ 価格を設定" })).toBeInTheDocument();
  });

  it.each(["-1", "-", "1e3", "300円"])("「%s」は保存せず理由を出し、入力を残す", async (input) => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<DistributionPriceField price={500} canEdit onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "配布価格を編集" }));
    await user.clear(screen.getByRole("textbox", { name: "配布価格" }));
    await user.type(screen.getByRole("textbox", { name: "配布価格" }), `${input}{Enter}`);

    expect(screen.getByRole("alert")).toHaveTextContent("価格は0以上の整数で入力してください");
    expect(screen.getByRole("textbox", { name: "配布価格" })).toHaveValue(input);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("数としては同じ値（0500・前後の空白）なら、保存せずに閉じる", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<DistributionPriceField price={500} canEdit onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "配布価格を編集" }));
    await user.clear(screen.getByRole("textbox", { name: "配布価格" }));
    await user.type(screen.getByRole("textbox", { name: "配布価格" }), " 0500 {Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "配布価格" })).not.toBeInTheDocument();
  });

  it("スマホでは数字のキーボードを出す", async () => {
    const user = userEvent.setup();
    render(<DistributionPriceField price={500} canEdit onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "配布価格を編集" }));

    expect(screen.getByRole("textbox", { name: "配布価格" })).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });
});
