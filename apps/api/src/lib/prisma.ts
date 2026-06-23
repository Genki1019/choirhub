import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!;
  const adapter = new PrismaNeonHTTP(connectionString, {});
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
