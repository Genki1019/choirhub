import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaNeon } from "@prisma/adapter-neon";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!;
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocal) {
    return new PrismaClient({ datasourceUrl: connectionString });
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
