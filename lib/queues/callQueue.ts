/**
 * /lib/queues/callQueue.ts
 *
 * Defines the BullMQ Queue that receives Exotel call-processing jobs.
 * Uses Upstash Redis via the IORedis-compatible connection string.
 *
 * WHY: BullMQ needs an IORedis instance, but Upstash only exposes a
 * REST API natively.  We connect via Upstash's redis:// TLS endpoint
 * (the same URL you'd use with ioredis) — NOT the REST URL.
 * Set UPSTASH_REDIS_URL=rediss://:password@host:6379 in .env.local
 */

import { Queue } from "bullmq";
import * as dotenv from "dotenv";

// Load .env.local explicitly, before we read any env vars below.
// This file can be imported very early in the module chain (before
// any other dotenv.config() call has run), so it must not depend on
// another file having loaded the env first.
dotenv.config({ path: ".env.local" });

// ---------- Redis connection ----------
// BullMQ bundles its own ioredis, so we pass plain connection options rather
// than an IORedis instance to avoid the dual-version type conflict.

const redisUrl = process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error(
    "[callQueue] UPSTASH_REDIS_URL is not set. Check that it exists in .env.local " +
      "and that this process is loading that file."
  );
}

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "6379", 10),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null as null, // required by BullMQ
    enableReadyCheck: false,            // Upstash doesn't support CLIENT INFO
    lazyConnect: true,
  };
}

export const redisConnection = parseRedisUrl(redisUrl);

// ---------- Queue ----------
export const CALL_QUEUE_NAME = "call-processing";

export const callQueue = new Queue<CallJobPayload>(CALL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000, // starts at 3 s → 6 s → 12 s → 24 s → 48 s
    },
    removeOnComplete: { count: 100 }, // keep last 100 completed jobs for debugging
    removeOnFail: { count: 200 },
  },
});

// ---------- Job payload type ----------
export interface CallJobPayload {
  callSid: string;        // Exotel CallSid
  from: string;           // caller's phone number  e.g. "+919876543210"
  to: string;             // broker's number
  direction: "inbound" | "outbound";
  durationSec: number;
  recordingUrl?: string;  // may be populated later if Exotel sends it in webhook
  webhookReceivedAt: string; // ISO timestamp
}