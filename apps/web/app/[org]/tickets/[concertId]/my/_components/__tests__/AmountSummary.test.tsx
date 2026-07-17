import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmountSummary } from "../AmountSummary";

describe("AmountSummary", () => {
  it("預かり・販売済み・販売金額・手元残を表示する", () => {
    render(
      <AmountSummary
        allocatedCount={10}
        soldAdult={6}
        soldStudent={1}
        returnedCount={0}
        price={2000}
        priceStudent={1000}
      />,
    );

    expect(screen.getByText("10枚")).toBeInTheDocument();
    expect(screen.getByText("7枚")).toBeInTheDocument(); // 6+1
    expect(screen.getByText("¥13,000")).toBeInTheDocument(); // 6*2000 + 1*1000
    expect(screen.getByText("3枚")).toBeInTheDocument(); // 10-7-0
  });

  it("priceStudentがnullの場合は学生も一般単価で計算する", () => {
    render(
      <AmountSummary
        allocatedCount={10}
        soldAdult={2}
        soldStudent={1}
        returnedCount={0}
        price={2000}
        priceStudent={null}
      />,
    );

    expect(screen.getByText("¥6,000")).toBeInTheDocument(); // (2+1)*2000
  });

  it("手元残がマイナスの場合は赤字表示になる", () => {
    render(
      <AmountSummary
        allocatedCount={5}
        soldAdult={4}
        soldStudent={0}
        returnedCount={3}
        price={2000}
        priceStudent={null}
      />,
    );

    expect(screen.getByText("-2枚")).toHaveClass("text-red-500");
  });
});
