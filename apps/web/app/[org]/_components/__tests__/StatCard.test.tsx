import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("label・value・subをそのまま表示する", () => {
    render(
      <StatCard label="次回練習まで" value="3日" valueClass="text-teal-500" sub="第12回定期練習" />,
    );

    expect(screen.getByText("次回練習まで")).toBeInTheDocument();
    expect(screen.getByText("3日")).toBeInTheDocument();
    expect(screen.getByText("第12回定期練習")).toBeInTheDocument();
  });
});
