export type MemberStatus = "active" | "offstage" | "alumni" | "suspended";

export interface Part {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Member {
  id: string;
  nameJa: string;
  nameEn?: string;
  partId: string;
  status: MemberStatus;
  joinedAt: string;
  birthDate?: string;
  roles: string[];
  bio?: string;
  originGroup?: string;
  phone?: string;
  adminMemo?: string;
}

export const PARTS: Part[] = [
  { id: "t1", name: "Tenor I",  sortOrder: 1 },
  { id: "t2", name: "Tenor II", sortOrder: 2 },
  { id: "br", name: "Baritone", sortOrder: 3 },
  { id: "bs", name: "Bass",     sortOrder: 4 },
];

export const MEMBERS: Member[] = [
  {
    id: "1",
    nameJa: "山田 太郎", nameEn: "Taro Yamada",
    partId: "t1", status: "active", joinedAt: "2018-04-01",
    birthDate: "1990-03-15",
    roles: ["member"],
    bio: "テノールで歌っています。よろしくお願いします！",
    originGroup: "○○大学混声合唱団",
    phone: "090-1234-5678", adminMemo: "",
  },
  {
    id: "2",
    nameJa: "鈴木 一郎", nameEn: "Ichiro Suzuki",
    partId: "t1", status: "active", joinedAt: "2020-10-01",
    birthDate: "1995-07-22",
    roles: ["tech"],
    bio: "選曲・ステージ構成を担当しています。",
    originGroup: "△△高校コーラス部",
    phone: "080-9876-5432", adminMemo: "技術系リーダー",
  },
  {
    id: "3",
    nameJa: "佐藤 健", nameEn: "Ken Sato",
    partId: "t1", status: "active", joinedAt: "2015-04-01",
    birthDate: "1985-11-03",
    roles: ["member"],
    bio: "長く在籍しています。よろしく！",
    originGroup: "",
    phone: "090-2222-3333", adminMemo: "",
  },
  {
    id: "4",
    nameJa: "林 修", nameEn: "Osamu Hayashi",
    partId: "t1", status: "active", joinedAt: "2023-04-01",
    birthDate: "2000-01-10",
    roles: ["member"],
    bio: "新入団員です。よろしくお願いします。",
    originGroup: "○○大学グリークラブ",
    phone: "080-1111-2222", adminMemo: "2023年度新入団",
  },
  {
    id: "5",
    nameJa: "田中 誠", nameEn: "Makoto Tanaka",
    partId: "t2", status: "active", joinedAt: "2019-04-01",
    birthDate: "1992-05-20",
    roles: ["member"],
    bio: "テノールセカンドです。",
    originGroup: "□□市民合唱団",
    phone: "090-3333-4444", adminMemo: "",
  },
  {
    id: "6",
    nameJa: "高橋 浩二", nameEn: "Koji Takahashi",
    partId: "t2", status: "active", joinedAt: "2021-04-01",
    birthDate: "1998-09-14",
    roles: ["score"],
    bio: "楽譜管理を担当しています。",
    originGroup: "高校合唱部",
    phone: "080-4444-5555", adminMemo: "楽譜がかりリーダー",
  },
  {
    id: "7",
    nameJa: "渡辺 勇", nameEn: "Isamu Watanabe",
    partId: "t2", status: "offstage", joinedAt: "2017-04-01",
    birthDate: "1988-02-28",
    roles: ["member"],
    bio: "仕事の都合で休団中です。",
    originGroup: "",
    phone: "090-5555-6666", adminMemo: "2025年度より休団",
  },
  {
    id: "8",
    nameJa: "清水 大輔", nameEn: "Daisuke Shimizu",
    partId: "t2", status: "active", joinedAt: "2016-10-01",
    birthDate: "1987-06-11",
    roles: ["member"],
    bio: "",
    originGroup: "大学混声合唱団",
    phone: "080-6666-7777", adminMemo: "",
  },
  {
    id: "9",
    nameJa: "伊藤 哲也", nameEn: "Tetsuya Ito",
    partId: "br", status: "active", joinedAt: "2016-04-01",
    birthDate: "1986-08-05",
    roles: ["tech"],
    bio: "バリトンパートの声を担当しています。",
    originGroup: "○○合唱連盟",
    phone: "090-7777-8888", adminMemo: "",
  },
  {
    id: "10",
    nameJa: "中村 光", nameEn: "Hikaru Nakamura",
    partId: "br", status: "active", joinedAt: "2022-04-01",
    birthDate: "2001-04-01",
    roles: ["member"],
    bio: "歌うことが大好きです！",
    originGroup: "大学グリークラブ",
    phone: "080-8888-9999", adminMemo: "",
  },
  {
    id: "11",
    nameJa: "小林 実", nameEn: "Minoru Kobayashi",
    partId: "br", status: "active", joinedAt: "2019-10-01",
    birthDate: "1991-12-25",
    roles: ["member"],
    bio: "",
    originGroup: "",
    phone: "090-0000-1111", adminMemo: "",
  },
  {
    id: "12",
    nameJa: "池田 誠一", nameEn: "Seiichi Ikeda",
    partId: "br", status: "active", joinedAt: "2018-04-01",
    birthDate: "1989-03-30",
    roles: ["score"],
    bio: "楽譜管理も担当しています。",
    originGroup: "市民合唱団",
    phone: "080-1122-3344", adminMemo: "",
  },
  {
    id: "13",
    nameJa: "加藤 博", nameEn: "Hiroshi Kato",
    partId: "bs", status: "active", joinedAt: "2014-04-01",
    birthDate: "1982-07-19",
    roles: ["admin"],
    bio: "団の運営を担当しています。",
    originGroup: "○○男声合唱団OB",
    phone: "090-1234-0000", adminMemo: "最高管理者",
  },
  {
    id: "14",
    nameJa: "吉田 勉", nameEn: "Tsutomu Yoshida",
    partId: "bs", status: "active", joinedAt: "2020-04-01",
    birthDate: "1993-10-08",
    roles: ["member"],
    bio: "バスパートです。",
    originGroup: "",
    phone: "080-2233-4455", adminMemo: "",
  },
  {
    id: "15",
    nameJa: "木村 純", nameEn: "Jun Kimura",
    partId: "bs", status: "alumni", joinedAt: "2010-04-01",
    birthDate: "1978-04-15",
    roles: ["member"],
    bio: "OBとして時々顔を出しています。",
    originGroup: "",
    phone: "090-3344-5566", adminMemo: "OB会長",
  },
  {
    id: "16",
    nameJa: "橋本 健太", nameEn: "Kenta Hashimoto",
    partId: "bs", status: "active", joinedAt: "2019-04-01",
    birthDate: "1994-08-23",
    roles: ["member"],
    bio: "",
    originGroup: "大学合唱部",
    phone: "080-4455-6677", adminMemo: "",
  },
];

export const DEMO_SELF_ID = "13"; // 加藤 博（admin）

// ── イベント / 出欠 ──────────────────────────────────────

export type EventType = "rehearsal" | "concert" | "meeting" | "other";
export type AttendanceStatus = "attending" | "absent" | "maybe" | "undecided";

export interface Event {
  id: string;
  title: string;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  location?: string;
  locationUrl?: string;
  deadline?: string;
  pageMemo?: string;
  isLocked: boolean;
}

export interface Attendance {
  memberId: string;
  eventId: string;
  status: AttendanceStatus;
  arriveTime?: string;
  leaveTime?: string;
  dayMemo?: string;
}

export const EVENTS: Event[] = [
  {
    id: "e1",
    title: "第12回定期練習",
    eventType: "rehearsal",
    startsAt: "2026-06-07T14:00:00",
    endsAt: "2026-06-07T17:00:00",
    location: "○○文化センター 練習室3",
    locationUrl: "https://maps.google.com/",
    deadline: "2026-06-05T23:59:59",
    pageMemo: "今回は定演前最後の合同練習です。第2ステージを中心に通し練習を行います。楽譜必携。16時からパート練習あり。",
    isLocked: false,
  },
  {
    id: "e2",
    title: "第13回定期練習",
    eventType: "rehearsal",
    startsAt: "2026-06-14T14:00:00",
    endsAt: "2026-06-14T17:00:00",
    location: "○○文化センター 練習室3",
    locationUrl: "https://maps.google.com/",
    deadline: "2026-06-12T23:59:59",
    isLocked: false,
  },
  {
    id: "e3",
    title: "第14回定期練習",
    eventType: "rehearsal",
    startsAt: "2026-06-21T14:00:00",
    endsAt: "2026-06-21T17:00:00",
    location: "○○文化センター 練習室3",
    deadline: "2026-06-19T23:59:59",
    isLocked: false,
  },
  {
    id: "e4",
    title: "第15回定期練習",
    eventType: "rehearsal",
    startsAt: "2026-06-28T14:00:00",
    endsAt: "2026-06-28T17:00:00",
    location: "○○文化センター 練習室3",
    deadline: "2026-06-26T23:59:59",
    isLocked: true,
  },
  {
    id: "e5",
    title: "役員会議",
    eventType: "meeting",
    startsAt: "2026-06-15T19:00:00",
    endsAt: "2026-06-15T21:00:00",
    location: "オンライン（Zoom）",
    isLocked: false,
  },
  {
    id: "e6",
    title: "第〇回定期演奏会",
    eventType: "concert",
    startsAt: "2026-07-25T14:30:00",
    endsAt: "2026-07-25T18:00:00",
    location: "○○ホール 大ホール",
    isLocked: false,
  },
];

export const ATTENDANCES: Attendance[] = [
  // e1: 第12回定期練習
  { memberId: "1",  eventId: "e1", status: "attending" },
  { memberId: "2",  eventId: "e1", status: "maybe", arriveTime: "15:00", dayMemo: "仕事の都合で15時頃到着" },
  { memberId: "3",  eventId: "e1", status: "attending" },
  { memberId: "4",  eventId: "e1", status: "absent", dayMemo: "用事があり欠席します" },
  { memberId: "5",  eventId: "e1", status: "attending" },
  { memberId: "6",  eventId: "e1", status: "attending" },
  { memberId: "7",  eventId: "e1", status: "absent" },
  { memberId: "8",  eventId: "e1", status: "attending" },
  { memberId: "9",  eventId: "e1", status: "attending" },
  { memberId: "10", eventId: "e1", status: "undecided" },
  { memberId: "11", eventId: "e1", status: "attending" },
  { memberId: "12", eventId: "e1", status: "maybe", leaveTime: "16:00", dayMemo: "16時に退席" },
  { memberId: "13", eventId: "e1", status: "attending" },
  { memberId: "14", eventId: "e1", status: "absent" },
  { memberId: "15", eventId: "e1", status: "undecided" },
  { memberId: "16", eventId: "e1", status: "attending" },
  // e2: 第13回定期練習（一部のみ）
  { memberId: "1",  eventId: "e2", status: "attending" },
  { memberId: "2",  eventId: "e2", status: "attending" },
  { memberId: "3",  eventId: "e2", status: "absent" },
  { memberId: "5",  eventId: "e2", status: "attending" },
  { memberId: "9",  eventId: "e2", status: "attending" },
  { memberId: "13", eventId: "e2", status: "attending" },
];
