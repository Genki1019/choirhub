import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "../Stepper";

describe("Stepper（表示）", () => {
  it("ラベルと現在値を表示する", () => {
    render(<Stepper label="大人" value={3} onChange={vi.fn()} />);

    expect(screen.getByText("大人")).toBeInTheDocument();
    expect(screen.getByLabelText("大人")).toHaveValue(3);
  });
});

describe("Stepper（操作）", () => {
  it("＋ボタンクリックでonChangeがvalue+1で呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Stepper label="大人" value={3} onChange={onChange} />);

    await user.click(screen.getByLabelText("大人を増やす"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("−ボタンクリックでonChangeがvalue-1で呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Stepper label="大人" value={3} onChange={onChange} />);

    await user.click(screen.getByLabelText("大人を減らす"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("0のときに−ボタンを押しても0未満にならない", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Stepper label="大人" value={0} onChange={onChange} />);

    await user.click(screen.getByLabelText("大人を減らす"));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("disabled: trueの場合は−／＋ボタン・入力欄が無効化される", () => {
    render(<Stepper label="大人" value={3} onChange={vi.fn()} disabled />);

    expect(screen.getByLabelText("大人を減らす")).toBeDisabled();
    expect(screen.getByLabelText("大人を増やす")).toBeDisabled();
    expect(screen.getByLabelText("大人")).toBeDisabled();
  });
});
