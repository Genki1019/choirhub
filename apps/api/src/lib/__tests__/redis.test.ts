import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { evalMock, delMock, RedisMock } = vi.hoisted(() => {
  const evalMock = vi.fn();
  const delMock = vi.fn();
  const RedisMock = vi.fn(function (_config: unknown) {
    return { eval: evalMock, del: delMock };
  });
  return { evalMock, delMock, RedisMock };
});

vi.mock("@upstash/redis", () => ({ Redis: RedisMock }));
vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "../logger.js";

const IP = "203.0.113.7";
const USER_ID = "cm1234567890user";

async function loadWithRedis() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret-token");
  vi.resetModules();
  return import("../redis.js");
}

async function loadWithoutRedis() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.resetModules();
  return import("../redis.js");
}

function loggedText(): string {
  return [...vi.mocked(logger.error).mock.calls, ...vi.mocked(logger.warn).mock.calls]
    .flat()
    .map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack}` : JSON.stringify(arg)))
    .join(" ");
}

describe("redis のレート制限", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("再試行せず、1回の問い合わせを2秒で打ち切る", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    await loadWithRedis();

    const config = RedisMock.mock.calls[0]?.[0] as {
      retry: { retries: number };
      signal: () => AbortSignal;
    };
    expect(config.retry).toEqual({ retries: 0 });
    expect(config.signal()).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(2000);

    timeoutSpy.mockRestore();
  });

  it("上限ちょうどの回は通し、超えた回から弾く", async () => {
    const { checkLoginRateLimit } = await loadWithRedis();

    evalMock.mockResolvedValueOnce(5);
    await expect(checkLoginRateLimit(IP)).resolves.toBe(true);

    evalMock.mockResolvedValueOnce(6);
    await expect(checkLoginRateLimit(IP)).resolves.toBe(false);
  });

  it("回数の更新と有効期限の設定を1回のスクリプトで行う", async () => {
    const { checkLoginRateLimit } = await loadWithRedis();
    evalMock.mockResolvedValueOnce(1);

    await checkLoginRateLimit(IP);

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, keys, args] = evalMock.mock.calls[0];
    expect(script).toContain('redis.call("INCR", KEYS[1])');
    expect(script).toContain('redis.call("TTL", KEYS[1]) == -1');
    expect(script).toContain('redis.call("EXPIRE", KEYS[1], ARGV[1])');
    expect(keys).toEqual([`rl:login:${IP}`]);
    expect(args).toEqual([900]);
  });

  it("Redis が失敗したらリクエストを通し、対象とエラーの種類だけをログに残す", async () => {
    const { checkLoginRateLimit } = await loadWithRedis();
    const error = new Error(`ERR, command was: ["EVAL","rl:login:${IP}","secret-token"]`);
    error.name = "UpstashError";
    evalMock.mockRejectedValueOnce(error);

    await expect(checkLoginRateLimit(IP)).resolves.toBe(true);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain("target=login");
    expect(loggedText()).toContain("error=UpstashError");
    expect(loggedText()).not.toContain(IP);
    expect(loggedText()).not.toContain("secret-token");
  });

  it("ユーザー単位の制限でも、失敗のログにユーザーIDを出さない", async () => {
    const { checkOrgDeleteRateLimit } = await loadWithRedis();
    evalMock.mockRejectedValueOnce(new Error(`command was: rl:org-delete:${USER_ID}`));

    await expect(checkOrgDeleteRateLimit(USER_ID)).resolves.toBe(true);

    expect(loggedText()).toContain("target=org-delete");
    expect(loggedText()).not.toContain(USER_ID);
  });

  it("打ち切りで中断されたらリクエストを通してログに残す", async () => {
    const { checkLoginRateLimit } = await loadWithRedis();
    evalMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));

    await expect(checkLoginRateLimit(IP)).resolves.toBe(true);

    expect(loggedText()).toContain("error=TimeoutError");
  });

  it.each([[null], ["1"], [undefined]])(
    "スクリプトの戻り値が数値でない %s のときは、通してログに残す",
    async (response) => {
      const { checkLoginRateLimit } = await loadWithRedis();
      evalMock.mockResolvedValueOnce(response);

      await expect(checkLoginRateLimit(IP)).resolves.toBe(true);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(loggedText()).toContain("error=TypeError");
    },
  );

  it("回数の削除に失敗してもリクエストを止めず、警告をログに残す", async () => {
    const { clearLoginRateLimit } = await loadWithRedis();
    delMock.mockRejectedValueOnce(new Error(`command was: rl:login:${IP}`));

    await expect(clearLoginRateLimit(IP)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain("target=login");
    expect(loggedText()).not.toContain(IP);
  });

  it("Redis の環境変数がなければ、接続せずに通し、ログも出さない", async () => {
    const { checkLoginRateLimit, clearLoginRateLimit } = await loadWithoutRedis();

    await expect(checkLoginRateLimit(IP)).resolves.toBe(true);
    await expect(clearLoginRateLimit(IP)).resolves.toBeUndefined();

    expect(RedisMock).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
