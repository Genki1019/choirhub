import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // env() はconfig読み込み時に未設定だと即例外になり、DBに繋がない`prisma generate`まで巻き込んで失敗する
    // （CIはDATABASE_DIRECT_URLを設定していない）ため、素のprocess.envで未設定時はundefinedを許容する
    url: process.env.DATABASE_DIRECT_URL,
  },
});
