import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeadlineSection } from "../DeadlineSection";

describe("DeadlineSection", () => {
  it("hasDeadline=falseの場合: ヘルプテキストを表示し、日時入力は表示しない", () => {
    render(
      <DeadlineSection
        hasDeadline={false}
        deadlineDate=""
        deadlineTime="23:59"
        startDate="2026-07-20"
        onToggle={vi.fn()}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("締切を設定しない場合、出欠はイベント開始まで変更可能です。"),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("23:59")).not.toBeInTheDocument();
  });

  it("hasDeadline=trueの場合: 日付・時刻入力を表示する", () => {
    render(
      <DeadlineSection
        hasDeadline={true}
        deadlineDate="2026-07-18"
        deadlineTime="23:59"
        startDate="2026-07-20"
        onToggle={vi.fn()}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("2026-07-18")).toBeInTheDocument();
    expect(screen.getByDisplayValue("23:59")).toBeInTheDocument();
  });

  it("トグルクリックでonToggleが呼ばれる", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <DeadlineSection
        hasDeadline={false}
        deadlineDate=""
        deadlineTime="23:59"
        startDate="2026-07-20"
        onToggle={onToggle}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("出欠締切を設定する"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("日付入力のmax属性がstartDateと一致する", () => {
    render(
      <DeadlineSection
        hasDeadline={true}
        deadlineDate="2026-07-18"
        deadlineTime="23:59"
        startDate="2026-07-20"
        onToggle={vi.fn()}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("2026-07-18")).toHaveAttribute("max", "2026-07-20");
  });

  it("日付/時刻を変更するとonDateChange/onTimeChangeが呼ばれる", async () => {
    const onDateChange = vi.fn();
    const onTimeChange = vi.fn();
    render(
      <DeadlineSection
        hasDeadline={true}
        deadlineDate="2026-07-18"
        deadlineTime="23:59"
        startDate="2026-07-20"
        onToggle={vi.fn()}
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("2026-07-18"), {
      target: { value: "2026-07-19" },
    });
    expect(onDateChange).toHaveBeenCalledWith("2026-07-19");

    fireEvent.change(screen.getByDisplayValue("23:59"), { target: { value: "20:00" } });
    expect(onTimeChange).toHaveBeenCalledWith("20:00");
  });
});
