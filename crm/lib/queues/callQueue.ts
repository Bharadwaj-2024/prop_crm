import { Queue, type ConnectionOptions } from "bullmq";

// ---------- Job payload type ----------
export interface CallJobPayload {
  callSid: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  durationSec: number;
  recordingUrl?: string;
  webhookReceivedAt: string;
}

// ---------- Redis connection ----------
const redisUrl =
  process.env.REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  "redis://127.0.0.1:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
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
      delay: 3000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});