import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMemberPanel } from "../AddMemberPanel";
import { ticketsApi, type BatchDetail } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      allocate: vi.fn(),
    },
  };
});

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part: null,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
    ...overrides,
  };
}

function makeBatch(overrides: Partial<BatchDetail> = {}): BatchDetail {
  return {
    id: "batch-1",
    name: "一般",
    price: 2000,
    priceStudent: null,
    totalCount: 100,
    saleStart: null,
    saleEnd: null,
    allocations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddMemberPanel（表示）", () => {
  it("未配布メンバーが0件の場合は何も表示しない", () => {
    const { container } = render(
      <AddMemberPanel
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember({ status: "offstage" })]}
        onAdded={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("未配布の在籍中メンバーがいる場合は件数付きボタンを表示する", () => {
    render(
      <AddMemberPanel
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember(), makeMember({ id: "member-2", nameJa: "鈴木花子" })]}
        onAdded={vi.fn()}
      />,
    );
    expect(screen.getByText("団員を追加（2名未配布）")).toBeInTheDocument();
  });

  it("既に配布済みのメンバーは未配布数に含めない", () => {
    render(
      <AddMemberPanel
        batch={makeBatch({
          allocations: [
            {
              id: "a1",
              batchId: "batch-1",
              memberId: "member-1",
              requestedCount: null,
              nameJa: "山田太郎",
              partId: null,
              partName: null,
              partSortOrder: 0,
              partVoiceType: "",
              allocatedCount: 5,
              soldAdult: 0,
              soldStudent: 0,
              soldOther: 0,
              returnedCount: 0,
              outreachCount: 0,
              isOutreachExpensePaid: false,
              outreachExpensePaidAt: null,
              isCollected: false,
              reportedAt: null,
            },
          ],
        })}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember(), makeMember({ id: "member-2", nameJa: "鈴木花子" })]}
        onAdded={vi.fn()}
      />,
    );
    expect(screen.getByText("団員を追加（1名未配布）")).toBeInTheDocument();
  });
});

describe("AddMemberPanel（追加操作）", () => {
  it("ボタンクリックで展開し、団員未選択では追加ボタンが無効", async () => {
    const user = userEvent.setup();
    render(
      <AddMemberPanel
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember()]}
        onAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("団員を追加（1名未配布）"));
    expect(screen.getByText("追加")).toBeDisabled();
  });

  it("団員・枚数を指定して追加するとticketsApi.allocateが呼ばれonAddedが呼ばれる", async () => {
    vi.mocked(ticketsApi.allocate).mockResolvedValue({
      id: "alloc-new",
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 5,
      requestedCount: null,
    });
    const onAdded = vi.fn();
    const user = userEvent.setup();
    render(
      <AddMemberPanel
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember()]}
        onAdded={onAdded}
      />,
    );

    await user.click(screen.getByText("団員を追加（1名未配布）"));
    await user.selectOptions(screen.getByRole("combobox"), "member-1");
    const countInput = screen.getByPlaceholderText("枚数");
    await user.clear(countInput);
    await user.type(countInput, "5");
    await user.click(screen.getByText("追加"));

    expect(ticketsApi.allocate).toHaveBeenCalledWith("o", "concert-1", {
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 5,
    });
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ memberId: "member-1" }));
  });

  it("「パネルを閉じる」ボタンで展開前の状態に戻る", async () => {
    const user = userEvent.setup();
    render(
      <AddMemberPanel
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        allMembers={[makeMember()]}
        onAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByText("団員を追加（1名未配布）"));
    await user.click(screen.getByLabelText("パネルを閉じる"));

    expect(screen.getByText("団員を追加（1名未配布）")).toBeInTheDocument();
  });
});
