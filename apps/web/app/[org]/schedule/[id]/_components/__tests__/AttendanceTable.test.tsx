import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceTable, type LocalAttendance } from "../AttendanceTable";
import type { MemberProfile, PartSummary } from "@/lib/members-api";

const partTenor: PartSummary = { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 };
const partBass: PartSummary = { id: "part-2", name: "Bass", voiceType: "bass", sortOrder: 2 };

function makeMember(id: string, nameJa: string, part: PartSummary | null): MemberProfile {
  return {
    id,
    nameJa,
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
  };
}

const selfMember = makeMember("member-self", "自分", partTenor);
const otherMember = makeMember("member-other", "他人", partTenor);
const bassMember = makeMember("member-bass", "ベース君", partBass);

function att(status: LocalAttendance["status"], overrides: Partial<LocalAttendance> = {}) {
  return { status, arriveTime: null, leaveTime: null, dayMemo: null, ...overrides };
}

const baseProps = {
  isLocked: false,
  expandedId: null,
  saving: false,
  onCycleStatus: vi.fn(),
  onSaveMemo: vi.fn(),
  onSetExpandedId: vi.fn(),
};

describe("AttendanceTable（グルーピング・集計）", () => {
  it("パートごとにグルーピングし、パート別集計を表示する", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[
          { part: partTenor, members: [selfMember, otherMember] },
          { part: partBass, members: [bassMember] },
        ]}
        unassigned={[]}
        attendances={{
          "member-self": att("attending"),
          "member-other": att("maybe"),
          "member-bass": att("absent"),
        }}
        selfId="member-self"
      />,
    );
    expect(screen.getByText("Tenor I")).toBeInTheDocument();
    expect(screen.getByText("Bass")).toBeInTheDocument();
    expect(screen.getByText("○1 △1 ✕0")).toBeInTheDocument(); // Tenor I
    expect(screen.getByText("○0 △0 ✕1")).toBeInTheDocument(); // Bass
  });

  it("パート未設定メンバーがいる場合: 「パート未設定」グループを追加する", () => {
    const unassignedMember = makeMember("member-none", "未設定君", null);
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[unassignedMember]}
        attendances={{ "member-self": att("undecided"), "member-none": att("undecided") }}
        selfId="member-self"
      />,
    );
    expect(screen.getByText("パート未設定")).toBeInTheDocument();
    expect(screen.getByText("未設定君")).toBeInTheDocument();
  });

  it("パート未設定メンバーがいない場合: 「パート未設定」グループを表示しない", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("undecided") }}
        selfId="member-self"
      />,
    );
    expect(screen.queryByText("パート未設定")).not.toBeInTheDocument();
  });

  it("全体集計を計算して表示する", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [selfMember, otherMember] }]}
        unassigned={[bassMember]}
        attendances={{
          "member-self": att("attending"),
          "member-other": att("absent"),
          "member-bass": att("maybe"),
        }}
        selfId="member-self"
      />,
    );
    const summaryRow = screen.getByText("集計").closest("div")!;
    expect(within(summaryRow).getByText("○1")).toBeInTheDocument();
    expect(within(summaryRow).getByText("△1")).toBeInTheDocument();
    expect(within(summaryRow).getByText("✕1")).toBeInTheDocument();
    expect(within(summaryRow).getByText("—0")).toBeInTheDocument();
  });
});

describe("AttendanceTable（クリック操作）", () => {
  it("自分の行はクリック可能なスタイルになる", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("undecided") }}
        selfId="member-self"
      />,
    );
    const cell = screen.getByTitle("クリックで変更");
    expect(cell).toHaveClass("cursor-pointer");
    expect(cell).not.toBeDisabled();
  });

  it("自分以外の行はクリック不可なスタイルになる", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [otherMember] }]}
        unassigned={[]}
        attendances={{ "member-other": att("undecided") }}
        selfId="member-self"
      />,
    );
    const cell = screen.getByTitle("未回答");
    expect(cell).toHaveClass("cursor-default");
    expect(cell).toBeDisabled();
  });

  it("クリックでonCycleStatusが正しいmemberIdで呼ばれる", async () => {
    const onCycleStatus = vi.fn();
    const user = userEvent.setup();
    render(
      <AttendanceTable
        {...baseProps}
        onCycleStatus={onCycleStatus}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("undecided") }}
        selfId="member-self"
      />,
    );
    await user.click(screen.getByTitle("クリックで変更"));
    expect(onCycleStatus).toHaveBeenCalledWith("member-self");
  });

  it("isLocked=trueの場合、自分の行もdisabledになる", () => {
    render(
      <AttendanceTable
        {...baseProps}
        isLocked={true}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("undecided") }}
        selfId="member-self"
      />,
    );
    expect(screen.getByTitle("未回答")).toBeDisabled();
  });
});

describe("AttendanceTable（メモ展開・表示）", () => {
  it("expandedIdが一致しstatus=maybeの場合: メモ入力欄を表示する", () => {
    render(
      <AttendanceTable
        {...baseProps}
        expandedId="member-self"
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe") }}
        selfId="member-self"
      />,
    );
    expect(screen.getByText("△ 詳細を入力してください")).toBeInTheDocument();
  });

  it("expandedIdが一致してもstatusがmaybeでなければメモ入力欄を表示しない", () => {
    render(
      <AttendanceTable
        {...baseProps}
        expandedId="member-self"
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("attending") }}
        selfId="member-self"
      />,
    );
    expect(screen.queryByText("△ 詳細を入力してください")).not.toBeInTheDocument();
  });

  it("hasMemoがある場合: 到着/退席/メモの要約テキストを表示する", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [otherMember] }]}
        unassigned={[]}
        attendances={{
          "member-other": att("maybe", { arriveTime: "19:00", dayMemo: "遅れます" }),
        }}
        selfId="member-self"
      />,
    );
    expect(screen.getAllByText("19:00着 / 遅れます").length).toBeGreaterThan(0);
  });

  it("自分の行がmaybeの場合: 「詳細を入力」ボタンでonSetExpandedIdが呼ばれる", async () => {
    const onSetExpandedId = vi.fn();
    const user = userEvent.setup();
    render(
      <AttendanceTable
        {...baseProps}
        onSetExpandedId={onSetExpandedId}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe") }}
        selfId="member-self"
      />,
    );
    const buttons = screen.getAllByText("詳細を入力");
    await user.click(buttons[0]);
    expect(onSetExpandedId).toHaveBeenCalledWith("member-self");
  });

  it("既にメモがある場合はボタンの文言が「詳細を編集」になる", () => {
    render(
      <AttendanceTable
        {...baseProps}
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe", { dayMemo: "遅れます" }) }}
        selfId="member-self"
      />,
    );
    expect(screen.getAllByText("詳細を編集").length).toBeGreaterThan(0);
  });
});

describe("AttendanceTable（メモ保存）", () => {
  it("保存ボタンクリックで、空文字をnullに変換してonSaveMemoが呼ばれる", async () => {
    const onSaveMemo = vi.fn();
    const user = userEvent.setup();
    render(
      <AttendanceTable
        {...baseProps}
        onSaveMemo={onSaveMemo}
        expandedId="member-self"
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe") }}
        selfId="member-self"
      />,
    );
    await user.click(screen.getByText("保存"));
    expect(onSaveMemo).toHaveBeenCalledWith("member-self", {
      arriveTime: null,
      leaveTime: null,
      dayMemo: null,
    });
  });

  it("入力した値でonSaveMemoが呼ばれる", async () => {
    const onSaveMemo = vi.fn();
    const user = userEvent.setup();
    render(
      <AttendanceTable
        {...baseProps}
        onSaveMemo={onSaveMemo}
        expandedId="member-self"
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe") }}
        selfId="member-self"
      />,
    );
    await user.type(screen.getByLabelText("メモ"), "遅れます");
    await user.click(screen.getByText("保存"));
    expect(onSaveMemo).toHaveBeenCalledWith("member-self", {
      arriveTime: null,
      leaveTime: null,
      dayMemo: "遅れます",
    });
  });

  it("saving=trueの場合: 保存ボタンがdisabledになる", () => {
    render(
      <AttendanceTable
        {...baseProps}
        saving={true}
        expandedId="member-self"
        partGroups={[{ part: partTenor, members: [selfMember] }]}
        unassigned={[]}
        attendances={{ "member-self": att("maybe") }}
        selfId="member-self"
      />,
    );
    expect(screen.getByText("保存").closest("button")).toBeDisabled();
  });
});
