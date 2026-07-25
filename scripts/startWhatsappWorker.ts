import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { startWhatsAppWorker } from "../lib/workers/whatsappWorker";

const worker = startWhatsAppWorker();

process.on("SIGTERM", async () => {
  console.log("[startWhatsAppWorker] SIGTERM received. Shutting down gracefully...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[startWhatsAppWorker] SIGINT received. Shutting down...");
  await worker.close();
  process.exit(0);
});