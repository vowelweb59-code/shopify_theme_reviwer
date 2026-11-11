import { connectToDatabase } from "@/lib/db/connect";
import { createRepeatingJob } from "@/lib/jobs/repeatingJob";
import { intervalMs } from "@/lib/jobs/intervalMinutes";
import { ServiceChatConnection } from "@/models/service-chat";
import { syncAttendance } from "./sync";

// Reads the attendance space every 30 minutes (the last two months, for late or edited posts) while the Service Chat connection
// is active. Skipped until Chat is connected.
const INTERVAL_MS = intervalMs(process.env.ATTENDANCE_SYNC_MINUTES, 30);

/** Called once from instrumentation.ts on server boot. */
export const startAttendanceScheduler = createRepeatingJob("attendance-sync", "attendance", INTERVAL_MS, async () => {
  await connectToDatabase();
  const conn = await ServiceChatConnection.findOne({ key: "service-chat" }).select("status").lean<{ status: string } | null>();
  if (conn?.status === "active") await syncAttendance(2);
});
