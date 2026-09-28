import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { toCsv, csvResponse, csvFilename } from "../csv.js";

describe("toCsv", () => {
  it("BOM付き・CRLF区切りで出力する", () => {
    const csv = toCsv(["氏名", "金額"], [["山田", 1000]]);
    expect(csv).toBe("﻿氏名,金額\r\n山田,1000\r\n");
  });

  it("null/undefined は空文字になる", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("﻿a,b\r\n,\r\n");
  });

  it("カンマ・ダブルクォート・改行を含む値はクォートしエスケープする", () => {
    const csv = toCsv(["memo"], [["a,b"], ['say "hi"'], ["1行目\n2行目"]]);
    expect(csv).toBe('﻿memo\r\n"a,b"\r\n"say ""hi"""\r\n"1行目\n2行目"\r\n');
  });

  it("数式として解釈される先頭文字の文字列には ' を付与する", () => {
    const csv = toCsv(["v"], [["=SUM(A1)"], ["+1"], ["-1"], ["@x"], ["\tx"]]);
    expect(csv).toBe("﻿v\r\n'=SUM(A1)\r\n'+1\r\n'-1\r\n'@x\r\n'\tx\r\n");
  });

  it("負の数値には ' を付与しない", () => {
    expect(toCsv(["v"], [[-500]])).toBe("﻿v\r\n-500\r\n");
  });
});

describe("csvResponse", () => {
  it("text/csv と UTF-8 ファイル名付きの Content-Disposition を返す", async () => {
    const app = new Hono().get("/", (c) => csvResponse(c, "名簿.csv", "x"));
    const res = await app.request("/");
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent("名簿.csv")}`,
    );
    expect(await res.text()).toBe("x");
  });
});

describe("csvFilename", () => {
  it("JSTの日付を付与する", () => {
    expect(csvFilename("members", new Date("2026-09-28T16:00:00Z"))).toBe("members_20260929.csv");
  });
});
