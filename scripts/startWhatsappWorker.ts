import "dotenv/config";
import { startCallWorker } from "../lib/workers/callWorker";
import { startWhatsAppWorker } from "../lib/workers/whatsappWorker";

startCallWorker();
startWhatsAppWorker();

console.log("[all-workers] Both call and WhatsApp workers started.");
