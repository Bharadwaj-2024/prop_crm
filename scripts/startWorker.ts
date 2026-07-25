/**
 * /scripts/startWorker.ts
 *
 * Entry point to run the BullMQ worker as a standalone Node.js process.
 * This MUST run separately from Next.js (not inside the app server).
 *
 * Usage:
 *   npx ts-node --project tsconfig.server.json scripts/startWorker.ts
 *   OR after build:
 *   node dist/scripts/startWorker.js
 *
 * On Vercel: deploy this as a separate service or use a Railway/Render worker dyno.
 * See PROJECT_OVERVIEW.md for deployment guidance.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { startCallWorker } from "../lib/workers/callWorker";
import { startFollowUpWorker } from "../lib/workers/followUpWorker";

const worker = startCallWorker();
const followUpWorker = startFollowUpWorker();

// Graceful shutdown on SIGTERM (e.g. from Docker / Railway)
process.on("SIGTERM", async () => {
  console.log("[startWorker] SIGTERM received. Shutting down gracefully...");
  await worker.close();
  await followUpWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[startWorker] SIGINT received. Shutting down...");
  await worker.close();
  await followUpWorker.close();
  process.exit(0);
});
