import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import type { PartSummary } from "@/lib/api-types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      parts: vi.fn(),
    },
  };
});

function makeParts(): PartSummary[] {
  return [
    { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
    { id: "part-2", name: "ベース", voiceType: "bass", sortOrder: 2 },
  ];
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <PartsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PartsPage", () => {
  it("パート一覧を表示する", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage();

    expect(await screen.findByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("ベース")).toBeInTheDocument();
  });

  it("adminの場合は追加ボタンを表示する", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage(["admin"]);

    await screen.findByText("テノール1");
    expect(screen.getByText("追加")).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は追加ボタンを表示しない", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage(["finance"]);

    await screen.findByText("テノール1");
    expect(screen.queryByText("追加")).not.toBeInTheDocument();
  });

  it("adminの場合は操作説明の案内文を表示する", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage(["admin"]);

    expect(await screen.findByText(/↑↓ で表示順を変更できます/)).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は操作説明の案内文を表示しない", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage(["finance"]);

    await screen.findByText("テノール1");
    expect(screen.queryByText(/↑↓ で表示順を変更できます/)).not.toBeInTheDocument();
  });
});
