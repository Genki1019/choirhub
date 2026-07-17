import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MemberTypesPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { settingsApi, type MemberType } from "@/lib/settings-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      listMemberTypes: vi.fn(),
    },
  };
});

function makeTypes(): MemberType[] {
  return [
    { id: "type-1", name: "社会人", defaultFeeAmount: 3000, sortOrder: 1 },
    { id: "type-2", name: "学生", defaultFeeAmount: 1500, sortOrder: 2 },
  ];
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <MemberTypesPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MemberTypesPage", () => {
  it("区分一覧を表示する", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue(makeTypes());
    renderPage();

    expect(await screen.findByText("社会人")).toBeInTheDocument();
    expect(screen.getByText("¥3,000")).toBeInTheDocument();
  });

  it("adminの場合は追加ボタンを表示する", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue(makeTypes());
    renderPage(["admin"]);

    await screen.findByText("社会人");
    expect(screen.getByText("追加")).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は追加ボタンを表示しない", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue(makeTypes());
    renderPage(["finance"]);

    await screen.findByText("社会人");
    expect(screen.queryByText("追加")).not.toBeInTheDocument();
  });

  it("adminの場合は削除に関する案内文を表示する", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue(makeTypes());
    renderPage(["admin"]);

    expect(
      await screen.findByText(/団員が割り当てられている区分は削除できません/),
    ).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は削除に関する案内文を表示しない", async () => {
    vi.mocked(settingsApi.listMemberTypes).mockResolvedValue(makeTypes());
    renderPage(["finance"]);

    await screen.findByText("社会人");
    expect(
      screen.queryByText(/団員が割り当てられている区分は削除できません/),
    ).not.toBeInTheDocument();
  });
});
