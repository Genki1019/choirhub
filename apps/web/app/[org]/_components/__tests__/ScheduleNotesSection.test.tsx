import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ScheduleNotesSection,
  ScheduleNotesDisplay,
  type ScheduleNotesValues,
} from "../ScheduleNotesSection";

const emptyValues: ScheduleNotesValues = {
  rehearsalContent: "",
  timeSchedule: "",
  practiceVenue: "",
  otherNotes: "",
};

describe("ScheduleNotesSection", () => {
  it("4項目すべてのテキストエリアを表示する", () => {
    render(<ScheduleNotesSection values={emptyValues} onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText(/新曲『○○』の初見合わせ/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/集合 \/ 18:15 発声/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/3階 大会議室/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/個人ボイトレ希望者/)).toBeInTheDocument();
  });

  it("既存の値をそれぞれのテキストエリアに表示する", () => {
    render(
      <ScheduleNotesSection
        values={{
          rehearsalContent: "新曲の初見合わせ",
          timeSchedule: "18:00 集合",
          practiceVenue: "2階 練習室",
          otherNotes: "楽譜を持参してください",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("新曲の初見合わせ")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18:00 集合")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2階 練習室")).toBeInTheDocument();
    expect(screen.getByDisplayValue("楽譜を持参してください")).toBeInTheDocument();
  });

  it("練習曲の内容を入力するとonChangeがkey='rehearsalContent'で呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ScheduleNotesSection values={emptyValues} onChange={onChange} />);

    await user.type(screen.getByPlaceholderText(/新曲『○○』の初見合わせ/), "A");
    expect(onChange).toHaveBeenCalledWith("rehearsalContent", "A");
  });
});

describe("ScheduleNotesDisplay", () => {
  it("4項目すべて空の場合: 何も表示しない", () => {
    const { container } = render(<ScheduleNotesDisplay values={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("nullの項目のみの場合: 何も表示しない", () => {
    const { container } = render(
      <ScheduleNotesDisplay
        values={{
          rehearsalContent: null,
          timeSchedule: null,
          practiceVenue: null,
          otherNotes: null,
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("値がある項目のみラベル付きで表示する", () => {
    render(
      <ScheduleNotesDisplay
        values={{ rehearsalContent: "新曲『○○』の初見合わせ", timeSchedule: null }}
      />,
    );

    expect(screen.getByText("練習曲の内容")).toBeInTheDocument();
    expect(screen.getByText("新曲『○○』の初見合わせ")).toBeInTheDocument();
    expect(screen.queryByText("タイムスケジュール")).not.toBeInTheDocument();
  });

  it("改行を含む値はwhite-space: pre-wrapで保持する", () => {
    render(<ScheduleNotesDisplay values={{ otherNotes: "1行目\n2行目" }} />);

    const text = screen.getByText((_, el) => el?.textContent === "1行目\n2行目");
    expect(text).toHaveClass("whitespace-pre-wrap");
  });
});
