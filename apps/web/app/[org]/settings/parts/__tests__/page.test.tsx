import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { membersApi } from "@/lib/members-api";
import { settingsApi } from "@/lib/settings-api";
import type { PartSummary } from "@/lib/api-types";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

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

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      updatePart: vi.fn(),
    },
  };
});

function makeParts(): PartSummary[] {
  return [
    { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
    { id: "part-2", name: "ベース", voiceType: "bass", sortOrder: 2 },
  ];
}

function renderPage(roles: string[] = ["admin"], queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemberProvider memberId="member-self" roles={roles}>
        <PartsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPointerCapture();
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

    expect(await screen.findByText(/ドラッグして表示順を変更できます/)).toBeInTheDocument();
  });

  it("finance（admin以外）の場合は操作説明の案内文を表示しない", async () => {
    vi.mocked(membersApi.parts).mockResolvedValue(makeParts());
    renderPage(["finance"]);

    await screen.findByText("テノール1");
    expect(screen.queryByText(/ドラッグして表示順を変更できます/)).not.toBeInTheDocument();
  });

  it("並び替え後に画面を離れて戻っても新しい順序が反映される（サーバー側の状態を模したフェイクで検証）", async () => {
    // membersApi.parts / settingsApi.updatePart を「サーバー側の状態」を持つフェイクにし、
    // 画面を離れて戻った際にキャッシュヒット・再フェッチのどちらが起きても
    // 常に最新の並び順が表示されることを検証する
    let serverParts = makeParts();
    vi.mocked(membersApi.parts).mockImplementation(() => Promise.resolve(serverParts));
    vi.mocked(settingsApi.updatePart).mockImplementation((_org, id, data) => {
      serverParts = serverParts.map((p) => (p.id === id ? { ...p, ...data } : p));
      return Promise.resolve(serverParts.find((p) => p.id === id)!);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderPage(["admin"], queryClient);
    await screen.findByText("テノール1");

    dragAndDrop(
      screen.getByLabelText("ベースをドラッグして並び替え"),
      screen.getByLabelText("テノール1をドラッグして並び替え"),
    );
    await waitFor(() => expect(settingsApi.updatePart).toHaveBeenCalledTimes(2));
    expect([...serverParts].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.name)).toEqual([
      "ベース",
      "テノール1",
    ]);

    unmount();
    renderPage(["admin"], queryClient);
    await screen.findByText("テノール1");

    const rows = screen.getAllByText(/テノール1|ベース/);
    expect(rows.map((el) => el.textContent)).toEqual(["ベース", "テノール1"]);
  });
});
