import { hash, verify } from "argon2";

const ARGON2_OPTIONS = {
  type: 2, // Argon2id
  memoryCost: 19456, // 19 MiB (OWASP minimum — serverless 環境でのタイムアウト対策)
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return verify(storedHash, password);
}
