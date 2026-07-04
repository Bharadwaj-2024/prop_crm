import { Queue } from "bullmq";
import { redisConnection } from "@/lib/queues/callQueue";

export const WHATSAPP_QUEUE_NAME = "whatsapp-processing";

export const whatsappQueue = new Queue<WhatsAppJobPayload>(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export interface WhatsAppJobPayload {
  wamid: string;
  fromPhone: string;
  senderName: string;
  messageType: string;
  messageBody: string;
  mediaId?: string;
  timestamp: string;
}
