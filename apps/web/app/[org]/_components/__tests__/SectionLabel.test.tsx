import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionLabel } from "../SectionLabel";

describe("SectionLabel", () => {
  it("iconとlabelを表示する", () => {
    render(<SectionLabel icon={<span data-testid="icon" />} label="日時" />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("日時")).toBeInTheDocument();
  });
});
