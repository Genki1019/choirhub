import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MailingPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { mailingApi, type MailSummary, type MailListResponse } from "@/lib/mailing-api";
import { membersApi } from "@/lib/members-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir" }),
}));

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
      list: vi.fn(),
    },
  };
});

vi.mock("@/lib/members-api", () => ({
  membersApi: {
    parts: vi.fn(),
  },
}));

function makeMail(overrides: Partial<MailSummary> = {}): MailSummary {
  return {
    id: "mail-1",
    sentBy: { id: "member-1", nameJa: "幹事花子", avatarUrl: null },
    sentAt: "2026-05-30T10:00:00+09:00",
    recipientCount: 32,
    subject: "6月練習のご案内",
    bodyPreview: "みなさんこんにちは。6月の練習日程を...",
    ...overrides,
  };
}

function makeResponse(
  data: MailSummary[],
  meta = { total: data.length, page: 1, perPage: 20 },
): MailListResponse {
  return { data, meta };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <MailingPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MailingPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(mailingApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("取得の失敗が4xxならAPIの理由を表示し、件数は出さない", async () => {
    vi.mocked(mailingApi.list).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "page・perPageは正の整数で指定してください", 400),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "page・perPageは正の整数で指定してください",
    );
    expect(screen.queryByText("0件")).not.toBeInTheDocument();
    expect(screen.queryByText("メールがありません")).not.toBeInTheDocument();
  });

  it("取得の失敗が5xxでも空でない文言を表示する", async () => {
    vi.mocked(mailingApi.list).mockRejectedValue(new ApiClientError("UNKNOWN", "", 500));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールの読み込みに失敗しました。ページを再読み込みしてください。",
    );
  });

  it("0件の場合は空表示を出す", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([]));
    renderPage();

    expect(await screen.findByText("メールがありません")).toBeInTheDocument();
  });
});

describe("MailingPage（一覧表示・件数）", () => {
  it("メールカードと総件数を表示する", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(
      makeResponse([makeMail()], { total: 1, page: 1, perPage: 20 }),
    );
    renderPage();

    expect(await screen.findByText("6月練習のご案内")).toBeInTheDocument();
    expect(screen.getByText("1件")).toBeInTheDocument();
  });

  it("ページネーション: 21件以上ある場合はPaginationを表示しクリックでページが変わる", async () => {
    vi.mocked(mailingApi.list).mockImplementation((_org, params) =>
      Promise.resolve(
        makeResponse([makeMail({ id: `mail-${params?.page}`, subject: `件名${params?.page}` })], {
          total: 25,
          page: params?.page ?? 1,
          perPage: 20,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("件名1")).toBeInTheDocument();
    await user.click(screen.getByLabelText("次のページ"));

    expect(await screen.findByText("件名2")).toBeInTheDocument();
    expect(mailingApi.list).toHaveBeenLastCalledWith("tokyo-men-choir", { page: 2, perPage: 20 });
  });

  it("ページを切り替えて読み込んでいる間も、直前の一覧を薄く表示したまま残す", async () => {
    vi.mocked(mailingApi.list)
      .mockResolvedValueOnce(
        makeResponse([makeMail({ subject: "件名1" })], { total: 25, page: 1, perPage: 20 }),
      )
      .mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("件名1")).toBeInTheDocument();
    await user.click(screen.getByLabelText("次のページ"));

    expect(screen.getByText("件名1")).toBeInTheDocument();
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    expect(screen.getByText("件名1").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("次のページ")).toBeInTheDocument();
  });
});

describe("MailingPage（メール作成ボタン）", () => {
  it("「メールを作成」クリックでComposeModalを開く", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([]));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("メールを作成"));
    expect(screen.getByText("新規メール")).toBeInTheDocument();
  });
});

describe("MailCard", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-01T12:00:00+09:00"));
  });

  it("件名・送信者名・受信者数・本文プレビューを表示し詳細へリンクする", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail()]));
    renderPage();

    await screen.findByText("6月練習のご案内");
    expect(screen.getByText("幹事花子")).toBeInTheDocument();
    expect(screen.getByText("32名")).toBeInTheDocument();
    expect(screen.getByText("みなさんこんにちは。6月の練習日程を...")).toBeInTheDocument();
    expect(screen.getByText("6月練習のご案内").closest("a")).toHaveAttribute(
      "href",
      "/tokyo-men-choir/mailing/mail-1",
    );
  });

  it("件名が空の場合は「（件名なし）」を表示する", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail({ subject: "" })]));
    renderPage();

    expect(await screen.findByText("（件名なし）")).toBeInTheDocument();
  });

  it("avatarUrlが無い場合は名前の頭文字アバターを表示する", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail()]));
    renderPage();

    expect(await screen.findByText("幹")).toBeInTheDocument();
  });

  it("送信日時が当日の場合は時刻表示になる", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(
      makeResponse([makeMail({ sentAt: "2026-06-01T09:30:00+09:00" })]),
    );
    renderPage();

    expect(await screen.findByText("9:30")).toBeInTheDocument();
  });

  it("送信日時が7日以上前の場合は年/月/日表示になる", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(
      makeResponse([makeMail({ sentAt: "2026-05-01T09:30:00+09:00" })]),
    );
    renderPage();

    expect(await screen.findByText("2026/5/1")).toBeInTheDocument();
  });

  it("受信者数が0件の場合は受信者数を表示しない", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail({ recipientCount: 0 })]));
    renderPage();

    await screen.findByText("6月練習のご案内");
    expect(screen.queryByText(/名$/)).not.toBeInTheDocument();
  });
});

describe("MailingPage（権限）", () => {
  it("客演には「メールを作成」を出さず、受け取ったメールは表示する", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail()]));
    renderPage(["guest"]);

    expect(await screen.findByText("6月練習のご案内")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /メールを作成/ })).not.toBeInTheDocument();
  });

  it("一般団員には「メールを作成」を出す", async () => {
    vi.mocked(mailingApi.list).mockResolvedValue(makeResponse([makeMail()]));
    renderPage(["member"]);

    expect(await screen.findByRole("button", { name: /メールを作成/ })).toBeInTheDocument();
  });
});
