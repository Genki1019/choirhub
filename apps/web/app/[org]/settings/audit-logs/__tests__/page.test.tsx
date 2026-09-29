import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditLogsPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { auditLogsApi, type AuditLogItem } from "@/lib/audit-logs-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/audit-logs-api", () => ({
  auditLogsApi: { list: vi.fn(), actors: vi.fn(), exportCsv: vi.fn() },
}));

function makeLog(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: "log-1",
    createdAt: "2026-09-01T01:00:00.000Z",
    actorType: "member",
    actorMemberId: "member-1",
    actorName: "山田 太郎",
    action: "member.roles_changed",
    category: "access",
    targetType: "member",
    targetId: "member-2",
    targetLabel: "佐藤 花子",
    changes: { roles: { before: ["member"], after: ["member", "finance"] } },
    ipAddress: "203.0.113.1",
    userAgent: "Mozilla/5.0 test",
    ...overrides,
  };
}

function renderPage(roles: string[] = ["admin"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <AuditLogsPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auditLogsApi.actors).mockResolvedValue([
    { type: "member", memberId: "member-1", name: "山田 太郎" },
    { type: "system_admin", name: "システム管理者" },
  ]);
});

describe("AuditLogsPage", () => {
  it("admin以外には一覧を表示せず、APIも呼ばない", () => {
    renderPage(["finance"]);

    expect(screen.getByText("操作履歴は管理者のみ閲覧できます")).toBeInTheDocument();
    expect(auditLogsApi.list).not.toHaveBeenCalled();
    expect(auditLogsApi.actors).not.toHaveBeenCalled();
  });

  it("初回の取得中は読み込み中を表示する", () => {
    vi.mocked(auditLogsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("操作者で「システム管理者」を選ぶと操作者の種別で絞り込み、団員を選び直すと種別の条件を外す", async () => {
    vi.mocked(auditLogsApi.list).mockResolvedValue({
      data: [makeLog()],
      meta: { total: 1, page: 1, perPage: 50 },
    });
    renderPage();
    await screen.findByText("ロール変更");

    await userEvent.selectOptions(screen.getByLabelText("操作者"), "system_admin");
    await waitFor(() =>
      expect(vi.mocked(auditLogsApi.list).mock.lastCall?.[1]).toEqual({
        actorType: "system_admin",
        actorId: undefined,
        page: 1,
      }),
    );

    await userEvent.selectOptions(screen.getByLabelText("操作者"), "member-1");
    await waitFor(() =>
      expect(vi.mocked(auditLogsApi.list).mock.lastCall?.[1]).toEqual({
        actorType: undefined,
        actorId: "member-1",
        page: 1,
      }),
    );
  });

  it("操作・対象・操作者・IPアドレスを一覧表示し、展開すると変更差分を表示する", async () => {
    vi.mocked(auditLogsApi.list).mockResolvedValue({
      data: [makeLog()],
      meta: { total: 1, page: 1, perPage: 50 },
    });
    renderPage();

    expect(await screen.findByText("ロール変更")).toBeInTheDocument();
    expect(screen.getByText("佐藤 花子")).toBeInTheDocument();
    expect(screen.getByText(/山田 太郎 ・ 203\.0\.113\.1/)).toBeInTheDocument();
    expect(screen.queryByText("一般、会計")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("ロール")).toBeInTheDocument();
    expect(screen.getByText("一般")).toBeInTheDocument();
    expect(screen.getByText("一般、会計")).toBeInTheDocument();
    expect(screen.getByText("Mozilla/5.0 test")).toBeInTheDocument();
  });

  it("絞り込みの再取得中も入力欄と直前の結果を表示したままにする", async () => {
    vi.mocked(auditLogsApi.list)
      .mockResolvedValueOnce({ data: [makeLog()], meta: { total: 1, page: 1, perPage: 50 } })
      .mockReturnValue(new Promise(() => {}));
    renderPage();
    await screen.findByText("ロール変更");

    await userEvent.selectOptions(screen.getByLabelText("分類"), "finance");

    await waitFor(() => expect(auditLogsApi.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    expect(screen.getByLabelText("分類")).toHaveValue("finance");
    expect(screen.getByText("ロール変更")).toBeInTheDocument();
    expect(screen.getByRole("list").parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("履歴が1件もなければ、何が記録されるかを案内する", async () => {
    vi.mocked(auditLogsApi.list).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, perPage: 50 },
    });
    renderPage();

    expect(await screen.findByText("まだ操作履歴はありません")).toBeInTheDocument();
    expect(screen.getByText(/ロールの変更、会計記録の編集、CSV出力など/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "条件をクリア" })).not.toBeInTheDocument();
  });

  it("絞り込み中に0件なら一致しない旨を表示し、「条件をクリア」で全件表示に戻す", async () => {
    vi.mocked(auditLogsApi.list).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, perPage: 50 },
    });
    renderPage();
    await screen.findByText("まだ操作履歴はありません");

    await userEvent.selectOptions(screen.getByLabelText("分類"), "export");
    expect(await screen.findByText("条件に一致する操作履歴はありません")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "条件をクリア" }));

    await waitFor(() =>
      expect(auditLogsApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", { page: 1 }),
    );
    expect(screen.getByLabelText("分類")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "条件をクリア" })).not.toBeInTheDocument();
  });

  it("取得エラー時はエラーメッセージを表示する", async () => {
    vi.mocked(auditLogsApi.list).mockRejectedValue(new Error("Forbidden"));
    renderPage();

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("分類・操作者で絞り込むと1ページ目から再取得し、CSV出力にも同じ条件を渡し、出力後は一覧を再取得する", async () => {
    vi.mocked(auditLogsApi.list).mockResolvedValue({
      data: [makeLog()],
      meta: { total: 1, page: 1, perPage: 50 },
    });
    vi.mocked(auditLogsApi.exportCsv).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("ロール変更");

    await userEvent.selectOptions(screen.getByLabelText("分類"), "finance");
    await userEvent.selectOptions(screen.getByLabelText("操作者"), "member-1");

    await waitFor(() =>
      expect(auditLogsApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", {
        category: "finance",
        actorId: "member-1",
        page: 1,
      }),
    );

    const callsBeforeExport = vi.mocked(auditLogsApi.list).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "CSV出力" }));
    expect(auditLogsApi.exportCsv).toHaveBeenCalledWith("tokyo-men-choir", {
      category: "finance",
      actorId: "member-1",
    });
    await waitFor(() =>
      expect(vi.mocked(auditLogsApi.list).mock.calls.length).toBeGreaterThan(callsBeforeExport),
    );
  });
});
