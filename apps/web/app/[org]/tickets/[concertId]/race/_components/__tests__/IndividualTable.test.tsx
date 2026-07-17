import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IndividualTable } from "../IndividualTable";
import type { RaceIndividual } from "@/lib/tickets-api";

function makeIndividual(overrides: Partial<RaceIndividual> = {}): RaceIndividual {
  return {
    memberId: "member-1",
    nameJa: "山田太郎",
    partId: "part-1",
    partName: "テノール1",
    allocated: 10,
    sold: 8,
    outreachCount: 3,
    rate: 0.8,
    rank: 1,
    ...overrides,
  };
}

describe("IndividualTable", () => {
  it("名前・パート・販売枚数・情宣回数・順位を表示する", () => {
    render(<IndividualTable individuals={[makeIndividual()]} />);

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("8枚")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("3回")).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
  });

  it("パート未設定の場合は「—」を表示する", () => {
    render(<IndividualTable individuals={[makeIndividual({ partId: null, partName: null })]} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("複数名を順位順に表示する", () => {
    render(
      <IndividualTable
        individuals={[
          makeIndividual({ memberId: "m1", nameJa: "山田太郎", rank: 1 }),
          makeIndividual({ memberId: "m2", nameJa: "鈴木花子", rank: 2 }),
        ]}
      />,
    );

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("鈴木花子")).toBeInTheDocument();
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
  });
});
