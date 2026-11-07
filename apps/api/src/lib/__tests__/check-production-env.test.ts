import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const VALID_URL = "https://example-12345.upstash.io";
const VALID_TOKEN = "AbCdEf1234567890";

const packageJson = JSON.parse(readFileSync(join(API_DIR, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

let workDir: string;
let prismaLog: string;

function runBuild(env: Record<string, string>) {
  return spawnSync("sh", ["-c", packageJson.scripts["build:vercel"]], {
    cwd: API_DIR,
    encoding: "utf8",
    env: {
      PATH: [workDir, dirname(process.execPath), process.env.PATH].join(delimiter),
      PRISMA_LOG: prismaLog,
      ...env,
    },
  });
}

function prismaCommands(): string[] {
  return existsSync(prismaLog) ? readFileSync(prismaLog, "utf8").trim().split("\n") : [];
}

describe("build:vercel の環境変数の確認", () => {
  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "check-production-env-"));
    prismaLog = join(workDir, "prisma.log");
    const fakePrisma = join(workDir, "prisma");
    writeFileSync(fakePrisma, '#!/bin/sh\necho "$*" >> "$PRISMA_LOG"\n');
    chmodSync(fakePrisma, 0o755);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("本番で両方が正しく設定されていれば、マイグレーションまで進んで成功する", () => {
    const result = runBuild({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: VALID_URL,
      UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
    });

    expect(result.status).toBe(0);
    expect(prismaCommands()).toEqual(["generate", "migrate deploy"]);
  });

  it.each([
    ["URL が未設定", { UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN }, "UPSTASH_REDIS_REST_URL"],
    ["トークンが未設定", { UPSTASH_REDIS_REST_URL: VALID_URL }, "UPSTASH_REDIS_REST_TOKEN"],
    [
      "URL が引用符付き",
      { UPSTASH_REDIS_REST_URL: `"${VALID_URL}"`, UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "URL の前に空白",
      { UPSTASH_REDIS_REST_URL: ` ${VALID_URL}`, UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "URL の末尾に改行",
      { UPSTASH_REDIS_REST_URL: `${VALID_URL}\n`, UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "URL が https ではない",
      {
        UPSTASH_REDIS_REST_URL: "http://example-12345.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
      },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "URL のホストが1文字",
      { UPSTASH_REDIS_REST_URL: "https://a", UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "URL のホストが1文字で末尾にスラッシュ",
      { UPSTASH_REDIS_REST_URL: "https://a/", UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN },
      "UPSTASH_REDIS_REST_URL",
    ],
    [
      "トークンが全角文字",
      { UPSTASH_REDIS_REST_URL: VALID_URL, UPSTASH_REDIS_REST_TOKEN: "トークン" },
      "UPSTASH_REDIS_REST_TOKEN",
    ],
    [
      "トークンが引用符付き",
      { UPSTASH_REDIS_REST_URL: VALID_URL, UPSTASH_REDIS_REST_TOKEN: `"${VALID_TOKEN}"` },
      "UPSTASH_REDIS_REST_TOKEN",
    ],
    [
      "トークンの末尾に改行",
      { UPSTASH_REDIS_REST_URL: VALID_URL, UPSTASH_REDIS_REST_TOKEN: `${VALID_TOKEN}\n` },
      "UPSTASH_REDIS_REST_TOKEN",
    ],
  ])("本番で %s ならビルドを失敗させ、マイグレーションを流さない", (_label, env, name) => {
    const result = runBuild({ VERCEL_ENV: "production", ...env });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(name);
    expect(prismaCommands()).toEqual(["generate"]);
  });

  it("URL の末尾にスラッシュがあっても、正しい形なら通す", () => {
    const result = runBuild({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: `${VALID_URL}/`,
      UPSTASH_REDIS_REST_TOKEN: VALID_TOKEN,
    });

    expect(result.status).toBe(0);
  });

  it("失敗のメッセージに環境変数の値を出さない", () => {
    const result = runBuild({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: `"${VALID_URL}"`,
      UPSTASH_REDIS_REST_TOKEN: `"${VALID_TOKEN}"`,
    });

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(VALID_URL);
    expect(result.stdout + result.stderr).not.toContain(VALID_TOKEN);
  });

  it.each(["preview", "development"])(
    "%s では未設定でもビルドが通り、マイグレーションを流さない",
    (vercelEnv) => {
      const result = runBuild({ VERCEL_ENV: vercelEnv });

      expect(result.status).toBe(0);
      expect(prismaCommands()).toEqual(["generate"]);
    },
  );

  it("VERCEL_ENV が未設定ならビルドを失敗させる", () => {
    const result = runBuild({});

    expect(result.status).toBe(1);
    expect(prismaCommands()).toEqual(["generate"]);
  });
});
