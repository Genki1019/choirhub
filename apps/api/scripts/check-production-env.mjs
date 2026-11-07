import process from "node:process";

const UPSTASH_URL_PATTERN = /^https:\/\/[^\s#$./?"'][^\s"']+$/;
const UPSTASH_TOKEN_PATTERN = /^[!#-&(-~]+$/;

const errors = [];

if (!UPSTASH_URL_PATTERN.test((process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, ""))) {
  errors.push("UPSTASH_REDIS_REST_URL が未設定か、https の URL の形式ではありません");
}
if (!UPSTASH_TOKEN_PATTERN.test(process.env.UPSTASH_REDIS_REST_TOKEN ?? "")) {
  errors.push(
    "UPSTASH_REDIS_REST_TOKEN が未設定か、使えない文字（引用符・空白・改行・全角文字など）を含んでいます",
  );
}

if (errors.length > 0) {
  process.stderr.write(`本番の環境変数を確認してください:\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
}
