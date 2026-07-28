import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoringSettingsModal } from "../ScoringSettingsModal";
import type { RaceScoringConfig } from "@/lib/tickets-api";

function makeScoring(): RaceScoringConfig {
  return {
    avgSales: { label: "平均販売枚数", enabled: true, points: [10, 8, 6, 4] },
    speed5: {
      label: "速さ（5枚×3名）",
      enabled: true,
      threshold: 5,
      minCount: 3,
      points: [5, 4, 3, 2],
    },
    speed10: {
      label: "速さ（10枚×3名）",
      enabled: true,
      threshold: 10,
      minCount: 3,
      points: [5, 4, 3, 2],
    },
    zeroRatio: { label: "ゼロ販売割合", enabled: true, points: [4, 3, 2, 1] },
    outreach: { label: "情宣回数", enabled: false, points: [5, 4, 3, 2] },
  };
}

describe("ScoringSettingsModal", () => {
  it("初期値をフォームに表示する", () => {
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByDisplayValue("10, 8, 6, 4")).toBeInTheDocument();
    const outreachCheckbox = screen.getByLabelText("情宣回数");
    expect(outreachCheckbox).not.toBeChecked();
    const avgSalesCheckbox = screen.getByLabelText("平均販売枚数");
    expect(avgSalesCheckbox).toBeChecked();
  });

  it("有効/無効を切り替えてから保存すると、その値でonSubmitが呼ばれる", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    await user.click(screen.getByLabelText("情宣回数"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outreach: { enabled: true, points: [5, 4, 3, 2] } }),
    );
  });

  it("配点に不正な値を入力するとエラーメッセージを表示し、onSubmitを呼ばない", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    const avgSalesInput = screen.getByDisplayValue("10, 8, 6, 4");
    await user.clear(avgSalesInput);
    await user.type(avgSalesInput, "abc");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      screen.getByText(
        "配点は10個以内のカンマ区切りの整数で、閾値・人数は1以上の整数で入力してください",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("配点が10個を超えるとエラーメッセージを表示し、onSubmitを呼ばない", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    const avgSalesInput = screen.getByDisplayValue("10, 8, 6, 4");
    await user.clear(avgSalesInput);
    await user.type(avgSalesInput, "1,2,3,4,5,6,7,8,9,10,11");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      screen.getByText(
        "配点は10個以内のカンマ区切りの整数で、閾値・人数は1以上の整数で入力してください",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("保存失敗時はサーバーのエラーメッセージを表示する", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("レース公開後は採点設定を変更できません"));
    const user = userEvent.setup();
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={onSubmit} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("レース公開後は採点設定を変更できません")).toBeInTheDocument();
  });

  it("キャンセルクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoringSettingsModal initialScoring={makeScoring()} onSubmit={vi.fn()} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
