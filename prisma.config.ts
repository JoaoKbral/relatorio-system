import { defineConfig } from "@prisma/config";
import { config } from "dotenv";

config();

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // DATABASE_URL may be absent during `prisma generate` on the Vercel build step.
  // The datasource block is only needed for migrate/push/seed, not for code generation.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
