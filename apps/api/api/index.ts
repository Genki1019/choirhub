import { app } from "../src/app.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { api: { bodyParser: false } };

type VercelRequest = IncomingMessage & { body?: Buffer | string | Record<string, unknown> };

async function readBody(req: VercelRequest): Promise<Buffer | null> {
  if (req.method === "GET" || req.method === "HEAD") return null;

  // Vercel Lambda may pre-buffer the body in req.body even with bodyParser:false
  const pre = req.body;
  if (pre != null) {
    if (Buffer.isBuffer(pre)) return pre;
    if (typeof pre === "string") return Buffer.from(pre, "utf-8");
    return Buffer.from(JSON.stringify(pre), "utf-8");
  }

  // Fall back to reading the stream
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  const bodyBuf = await readBody(req);

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = (req.headers["host"] as string | undefined) ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val == null) continue;
    if (Array.isArray(val)) val.forEach((v) => headers.append(key, v));
    else headers.set(key, val);
  }

  const webReq = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: bodyBuf?.length ? new Uint8Array(bodyBuf) : null,
  });

  const webRes = await app.fetch(webReq);

  res.statusCode = webRes.status;

  // set-cookie は複数値になり得るので個別に処理
  const setCookies: string[] = [];
  webRes.headers.forEach((val, key) => {
    if (key.toLowerCase() === "set-cookie") {
      setCookies.push(val);
    } else {
      res.setHeader(key, val);
    }
  });
  if (setCookies.length > 0) res.setHeader("set-cookie", setCookies);

  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}
